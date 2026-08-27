// supabase/functions/send-emails/index.ts
//
// Drains `email_outbox` over SMTP. Deploy with:
//   supabase functions deploy send-emails
//
// Required secrets (`supabase secrets set NAME=value` — never in the repo):
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
//   SITE_URL          public site origin, e.g. https://eternity.scu.lk
//                     (used to build /my-orders and /#order links — the
//                     wordmark and SIS/SCU marks are hosted separately, see
//                     below)
//   REPLY_TO_EMAIL    a real, monitored inbox — students should be able to
//                     just hit reply
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically by
// the Supabase runtime for every edge function — do not set them by hand,
// and never let the service_role key anywhere near the frontend. It only
// ever lives here, server-side, to bypass RLS so this worker can read
// every user's queued email and update their orders' outbox rows.
//
// Images are read from the public `merch` storage bucket (SUPABASE_URL +
// /storage/v1/object/public/merch/<file>) rather than the site's own
// public/img — email clients won't render the site's SVG mark, and a
// storage bucket URL doesn't depend on eternity-web's deploy host at all.
//
// Scheduling: supabase-setup.sql §13 wires this up via pg_cron, once a
// minute, rather than a Database Webhook — see the comment there for why.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';
import { renderTemplate, type EmailSettings, type OrderEmailPayload } from './templates.ts';

const BATCH_SIZE = 20;

// These four templates all render live order data — see the comment on
// queue_order_email() in supabase-setup.sql for why the payload only ever
// carries a `code` and everything else is looked up fresh below.
const ORDER_TEMPLATES = new Set(['order_received', 'payment_verified', 'payment_rejected', 'ready_for_collection']);

interface OutboxRow {
  id: number;
  to_email: string;
  to_name: string | null;
  template: string;
  payload: unknown;
  attempts: number;
}

interface OrderItemRow {
  product_name: string;
  size: string | null;
  qty: number;
  unit_price: number;
}

interface OrderRow {
  code: string;
  full_name: string;
  batch: string;
  total: number;
  rejection_reason: string | null;
  payment_due_at: string;
  order_items: OrderItemRow[];
}

function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing required secret: ${name}`);
  return v;
}

Deno.serve(async (_req: Request) => {
  // Every required env var is read up front, and any throw from here is
  // caught below and turned into a clean 500 naming exactly which one is
  // missing — a silent no-op here wastes hours of "why didn't the email
  // send" before anyone thinks to check secrets.
  try {
    const supabaseUrl = requireEnv('SUPABASE_URL');
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const siteUrl = requireEnv('SITE_URL').replace(/\/+$/, '');
    const replyTo = requireEnv('REPLY_TO_EMAIL');
    const assetsUrl = `${supabaseUrl}/storage/v1/object/public/merch`;

    const smtpHost = requireEnv('SMTP_HOST');
    const smtpPortRaw = requireEnv('SMTP_PORT');
    const smtpUser = requireEnv('SMTP_USER');
    const smtpPass = requireEnv('SMTP_PASS');
    const smtpFrom = requireEnv('SMTP_FROM');
    const smtpPort = Number(smtpPortRaw);
    if (!Number.isFinite(smtpPort)) {
      throw new Error(`SMTP_PORT must be a number, got: "${smtpPortRaw}"`);
    }

    // service_role bypasses RLS — this is the only place in the whole
    // project that key is allowed to be used.
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('bank_account_name, bank_account_no, bank_branch, collection_point, early_bird_ends_at')
      .eq('id', 1)
      .single();

    if (settingsError || !settings) {
      return new Response(JSON.stringify({ error: settingsError?.message ?? 'Could not load settings' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      });
    }

    // Claims rows atomically — this RPC does UPDATE ... WHERE id IN
    // (SELECT ... FOR UPDATE SKIP LOCKED) under the hood (see
    // claim_queued_emails in supabase-setup.sql), marking them 'sending' in
    // the same statement that selects them. Selecting from email_outbox
    // directly here would let two overlapping cron runs both grab the same
    // queued row and send it twice.
    const { data: rows, error: claimError } = await supabase.rpc('claim_queued_emails', {
      batch_size: BATCH_SIZE,
    });

    if (claimError) {
      return new Response(JSON.stringify({ error: claimError.message }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      });
    }

    const claimed = (rows ?? []) as OutboxRow[];
    if (claimed.length === 0) {
      return new Response(JSON.stringify({ claimed: 0, sent: 0, failed: 0 }), {
        headers: { 'content-type': 'application/json' },
      });
    }

    let sent = 0;
    let failed = 0;

    // Every row this loop touches must end in 'sent' or 'failed' — never
    // left at 'sending', which is why the try/catch/finally below always
    // writes a final status no matter where it breaks.
    //
    // A fresh SMTPClient is opened per row rather than one connection
    // shared across the whole batch. denomailer's connection is a stateful
    // command sequence: once a "invalid cmd" protocol error happens on it
    // (a bad AUTH, a rejected recipient, a mid-handshake TLS/port mismatch),
    // that connection is desynced and every later command on it fails the
    // same way — which is exactly how one bad message was taking down the
    // rest of the batch. Isolating each send to its own connection means a
    // failure can only ever affect the row that caused it.
    for (const row of claimed) {
      let client: SMTPClient | null = null;
      try {
        let templatePayload: unknown = row.payload;

        // Order-related templates never trust the queued payload for
        // money or line items — it only ever carries `code` (see
        // queue_order_email() in supabase-setup.sql). Look the order up
        // fresh right now, at send time, and refuse to send rather than
        // ever showing a student Rs 0.
        if (ORDER_TEMPLATES.has(row.template)) {
          const code = (row.payload as { code?: unknown } | null)?.code;
          if (typeof code !== 'string' || !code) {
            throw new Error(`Outbox row ${row.id} (${row.template}) has no order code in its payload`);
          }

          const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('code, full_name, batch, total, rejection_reason, payment_due_at, order_items(product_name, size, qty, unit_price)')
            .eq('code', code)
            .single();

          if (orderError || !order) {
            throw new Error(`Could not look up order ${code}: ${orderError?.message ?? 'not found'}`);
          }

          const o = order as unknown as OrderRow;
          if (!o.total || o.total <= 0) {
            throw new Error(`Order ${code} has a zero or missing total — refusing to send an email with a wrong amount`);
          }

          templatePayload = {
            code: o.code,
            name: o.full_name,
            batch: o.batch,
            total: o.total,
            due: o.payment_due_at,
            reason: o.rejection_reason,
            items: (o.order_items ?? []).map((i) => ({
              product: i.product_name,
              size: i.size,
              qty: i.qty,
              unit: i.unit_price,
            })),
          } satisfies OrderEmailPayload;
        }

        const email = renderTemplate(row.template, templatePayload, settings as EmailSettings, siteUrl, assetsUrl);

        client = new SMTPClient({
          connection: {
            hostname: smtpHost,
            port: smtpPort,
            // 465 is implicit TLS from connection start; 587 (the common
            // case — Gmail, SendGrid, Mailgun, SES relays) is
            // plaintext-then-STARTTLS, which denomailer upgrades
            // automatically. Hardcoding either breaks the other — this has
            // to be derived from the actual configured port every time.
            tls: smtpPort === 465,
            auth: { username: smtpUser, password: smtpPass },
          },
        });

        await client.send({
          from: smtpFrom,
          to: row.to_name ? `${row.to_name} <${row.to_email}>` : row.to_email,
          replyTo,
          subject: email.subject,
          // Built explicitly rather than passed via the `content`/`html`
          // shortcuts: same quoted-printable + charset denomailer applies
          // by default, just spelled out here instead of left implicit, so
          // it can't silently drift if that default ever changes.
          mimeContent: [
            { mimeType: 'text/plain; charset="utf-8"', content: email.text, transferEncoding: 'quoted-printable' },
            { mimeType: 'text/html; charset="utf-8"', content: email.html, transferEncoding: 'quoted-printable' },
          ],
        });

        await supabase
          .from('email_outbox')
          .update({ status: 'sent', sent_at: new Date().toISOString(), error: null })
          .eq('id', row.id);

        sent++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);

        await supabase
          .from('email_outbox')
          .update({ status: 'failed', attempts: row.attempts + 1, error: message })
          .eq('id', row.id);

        failed++;
      } finally {
        if (client) {
          // A connection that just errored may already be half-closed —
          // closing it again is best-effort cleanup, not something that
          // should override the outcome already recorded above.
          try {
            await client.close();
          } catch {
            // already dead — nothing to clean up
          }
        }
      }
    }

    return new Response(JSON.stringify({ claimed: claimed.length, sent, failed }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
});
