// supabase/functions/send-emails/index.ts
//
// Drains `email_outbox` over SMTP. Deploy with:
//   supabase functions deploy send-emails
//
// Required secrets (`supabase secrets set NAME=value` — never in the repo):
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
//   SITE_URL          public site origin, e.g. https://eternity.scu.lk
//                     (used to build /my-orders links and hosted image URLs
//                     — email clients won't render the site's own SVG mark,
//                     so we point at the PNGs already served from
//                     eternity-web's public/img/)
//   REPLY_TO_EMAIL    a real, monitored inbox — students should be able to
//                     just hit reply
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically by
// the Supabase runtime for every edge function — do not set them by hand,
// and never let the service_role key anywhere near the frontend. It only
// ever lives here, server-side, to bypass RLS so this worker can read
// every user's queued email and update their orders' outbox rows.
//
// Scheduling: supabase-setup.sql §13 wires this up via pg_cron, once a
// minute, rather than a Database Webhook — see the comment there for why.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';
import { renderTemplate, type EmailSettings } from './templates.ts';

const BATCH_SIZE = 20;
const MAX_ATTEMPTS = 5;

interface OutboxRow {
  id: number;
  to_email: string;
  to_name: string | null;
  template: string;
  payload: unknown;
  attempts: number;
}

function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing required secret: ${name}`);
  return v;
}

Deno.serve(async (_req: Request) => {
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const siteUrl = requireEnv('SITE_URL').replace(/\/+$/, '');
  const replyTo = requireEnv('REPLY_TO_EMAIL');

  // service_role bypasses RLS — this is the only place in the whole
  // project that key is allowed to be used.
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: settings, error: settingsError } = await supabase
    .from('settings')
    .select('bank_account_name, bank_account_no, bank_branch, collection_point, early_bird_ends_at')
    .eq('id', 1)
    .single();

  if (settingsError || !settings) {
    return new Response(JSON.stringify({ error: 'Could not load settings' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  // Claims rows atomically (UPDATE ... FOR UPDATE SKIP LOCKED under the
  // hood, see claim_queued_emails in supabase-setup.sql) — marks them
  // 'sending' in the same statement that selects them, so an overlapping
  // cron run can't grab the same row and double-send.
  const { data: rows, error: claimError } = await supabase.rpc('claim_queued_emails', {
    batch_size: BATCH_SIZE,
  });

  if (claimError) {
    return new Response(JSON.stringify({ error: claimError.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  const queued = (rows ?? []) as OutboxRow[];
  if (queued.length === 0) {
    return new Response(JSON.stringify({ processed: 0, sent: 0, failed: 0 }), {
      headers: { 'content-type': 'application/json' },
    });
  }

  const port = Number(Deno.env.get('SMTP_PORT') ?? '587');
  const client = new SMTPClient({
    connection: {
      hostname: requireEnv('SMTP_HOST'),
      port,
      // 465 is implicit TLS from connection start; 587 (the common case —
      // Gmail, SendGrid, Mailgun, SES relays) is plaintext-then-STARTTLS,
      // which denomailer upgrades automatically. Hardcoding `true` here
      // breaks every STARTTLS provider on 587.
      tls: port === 465,
      auth: {
        username: requireEnv('SMTP_USER'),
        password: requireEnv('SMTP_PASS'),
      },
    },
  });

  const from = requireEnv('SMTP_FROM');
  let sent = 0;
  let failed = 0;

  for (const row of queued) {
    try {
      const email = renderTemplate(row.template, row.payload, settings as EmailSettings, siteUrl);

      await client.send({
        from,
        to: row.to_name ? `${row.to_name} <${row.to_email}>` : row.to_email,
        replyTo,
        subject: email.subject,
        content: email.text,
        html: email.html,
      });

      await supabase
        .from('email_outbox')
        .update({ status: 'sent', sent_at: new Date().toISOString(), error: null })
        .eq('id', row.id);

      sent++;
    } catch (err) {
      const attempts = row.attempts + 1;
      const message = err instanceof Error ? err.message : String(err);

      await supabase
        .from('email_outbox')
        .update({
          attempts,
          error: message,
          // Give up after 5 attempts — otherwise it stays `queued` and the
          // next run tries again.
          status: attempts >= MAX_ATTEMPTS ? 'failed' : 'queued',
        })
        .eq('id', row.id);

      failed++;
    }
  }

  await client.close();

  return new Response(JSON.stringify({ processed: queued.length, sent, failed }), {
    headers: { 'content-type': 'application/json' },
  });
});
