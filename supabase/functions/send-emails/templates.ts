// Email templates for the `send-emails` worker.
//
// Table layout only, every style inline, no <style> block — this is what
// actually survives Outlook, Gmail's clipped inbox HTML, and every other
// email client that ignores or strips modern CSS. The Eternity wordmark and
// the SIS/SCU marks are referenced as hosted PNGs (SVG doesn't render in
// most mail clients) from SITE_URL, which must be a public, reachable URL —
// see index.ts for how that env var is read.
//
// Design contract carries over from the site: void/chrome/gold tokens, one
// gold accent per screen. Here that accent is the single rule under the
// wordmark — every other emphasis (totals, order codes, the CTA button) is
// chrome, matching "gold means act on this, never decoration" and keeping
// exactly one gold element per email regardless of which template.

const VOID = '#050507';
const CHROME = '#E8EAF0';
const DUST = '#8A8FA0';
const DUST_DIM = '#565b6b';
const GOLD = '#F2B01E';
const LINE = 'rgba(232,234,240,.15)';

const MONO = "'Chivo Mono',Courier,monospace";
const SERIF = "Georgia,'Times New Roman',serif";
const SANS = 'Arial,Helvetica,sans-serif';

const WHATSAPP = [
  { who: 'Alex', wa: '94706544700', display: '+94 70 654 4700' },
  { who: 'Harith', wa: '94768570754', display: '+94 76 857 0754' },
  { who: 'Minol', wa: '94765373271', display: '+94 76 537 3271' },
];

export interface EmailSettings {
  bank_account_name: string;
  bank_account_no: string;
  bank_branch: string;
  collection_point: string;
}

export interface OrderItemPayload {
  product: string;
  size: string | null;
  qty: number;
  unit: number;
}

export interface OrderEmailPayload {
  code: string;
  total: number;
  name: string;
  batch: string;
  due: string | null;
  reason: string | null;
  items: OrderItemPayload[] | null;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function esc(s: string | null | undefined): string {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(n: number): string {
  return 'Rs ' + Math.round(n).toLocaleString('en-LK');
}

function textFooter(): string {
  const wa = WHATSAPP.map((w) => `${w.who} ${w.display}`).join(' · ');
  return `\n\n—\nWhatsApp: ${wa}\nEternity · SCU Get Together 2026 · 18 September · Colombo`;
}

function layout(opts: {
  siteUrl: string;
  eyebrow: string;
  heading: string;
  bodyHtml: string;
  ctaText?: string;
  ctaHref?: string;
}): string {
  const { siteUrl, eyebrow, heading, bodyHtml, ctaText, ctaHref } = opts;

  const cta = ctaText && ctaHref
    ? `
  <tr><td style="padding:32px 28px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="border:1px solid ${CHROME};border-radius:999px;">
        <a href="${ctaHref}" style="display:inline-block;padding:13px 28px;font-family:${MONO};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${CHROME};text-decoration:none;">${esc(ctaText)}</a>
      </td>
    </tr></table>
  </td></tr>`
    : '';

  const whatsapp = WHATSAPP.map(
    (w) => `<a href="https://wa.me/${w.wa}" style="color:${DUST};text-decoration:underline;">${w.who}</a>`
  ).join(' &nbsp;&middot;&nbsp; ');

  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background-color:${VOID};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${VOID};">
<tr><td align="center" style="padding:48px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:${VOID};">
  <tr><td align="center" style="padding:0 0 26px;">
    <img src="${siteUrl}/img/eternity-logo.png" width="200" alt="Eternity" style="display:block;width:200px;max-width:60%;height:auto;border:0;" />
  </td></tr>
  <tr><td style="padding:0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="height:2px;line-height:2px;font-size:2px;background-color:${GOLD};">&nbsp;</td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:34px 28px 4px;font-family:${MONO};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${DUST};">${esc(eyebrow)}</td></tr>
  <tr><td style="padding:6px 28px 22px;font-family:${SERIF};font-size:26px;line-height:1.3;color:${CHROME};">${esc(heading)}</td></tr>
  <tr><td style="padding:0 28px;font-family:${SANS};font-size:15px;line-height:1.65;color:${CHROME};">
    ${bodyHtml}
  </td></tr>
  ${cta}
  <tr><td style="padding:44px 28px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="border-top:1px solid ${LINE};font-size:1px;line-height:1px;">&nbsp;</td>
    </tr></table>
  </td></tr>
  <tr><td align="center" style="padding:22px 28px 6px;font-family:${MONO};font-size:11px;letter-spacing:1px;color:${DUST};">
    ${whatsapp}
  </td></tr>
  <tr><td align="center" style="padding:18px 28px 8px;">
    <img src="${siteUrl}/img/sis-logo.png" height="30" alt="Student Interactive Society" style="display:inline-block;height:30px;width:auto;border:0;vertical-align:middle;margin:0 10px;" />
    <img src="${siteUrl}/img/scu-25.png" height="24" alt="SCU 25 Years of Trust" style="display:inline-block;height:24px;width:auto;border:0;vertical-align:middle;margin:0 10px;" />
  </td></tr>
  <tr><td align="center" style="padding:10px 28px 40px;font-family:${MONO};font-size:9.5px;letter-spacing:1px;color:${DUST_DIM};">
    ETERNITY &middot; SCU GET TOGETHER 2026 &middot; 18 SEPTEMBER &middot; COLOMBO
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function bankBox(settings: EmailSettings): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${LINE};margin:0 0 22px;">
      <tr><td style="padding:18px 20px;">
        <p style="margin:0 0 4px;font-family:${MONO};font-size:9.5px;letter-spacing:1.5px;text-transform:uppercase;color:${DUST};">Account name</p>
        <p style="margin:0 0 14px;font-family:${SANS};font-size:14px;color:${CHROME};">${esc(settings.bank_account_name)}</p>
        <p style="margin:0 0 4px;font-family:${MONO};font-size:9.5px;letter-spacing:1.5px;text-transform:uppercase;color:${DUST};">Account number</p>
        <p style="margin:0 0 14px;font-family:${MONO};font-size:15px;color:${CHROME};">${esc(settings.bank_account_no)}</p>
        <p style="margin:0 0 4px;font-family:${MONO};font-size:9.5px;letter-spacing:1.5px;text-transform:uppercase;color:${DUST};">Bank</p>
        <p style="margin:0;font-family:${SANS};font-size:14px;color:${CHROME};">${esc(settings.bank_branch)}</p>
      </td></tr>
    </table>`;
}

function orderReceived(p: OrderEmailPayload, settings: EmailSettings, siteUrl: string): RenderedEmail {
  const items = p.items ?? [];
  const itemRows = items
    .map(
      (i) => `
      <tr>
        <td style="padding:10px 0;border-top:1px solid ${LINE};font-family:${SANS};font-size:14px;color:${CHROME};">${esc(i.product)}${i.size ? ` (${esc(i.size)})` : ''}</td>
        <td style="padding:10px 0;border-top:1px solid ${LINE};font-family:${MONO};font-size:13px;color:${DUST};text-align:center;">&times;${i.qty}</td>
        <td style="padding:10px 0;border-top:1px solid ${LINE};font-family:${MONO};font-size:13px;color:${CHROME};text-align:right;">${money(i.unit * i.qty)}</td>
      </tr>`
    )
    .join('');

  const bodyHtml = `
    <p style="margin:0 0 20px;">Order <b style="color:${CHROME};">${esc(p.code)}</b> is reserved for <b style="color:${CHROME};">${esc(p.batch)}</b>.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;">
      ${itemRows}
      <tr>
        <td colspan="2" style="padding:16px 0 0;font-family:${MONO};font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:${DUST};">Total to deposit</td>
        <td style="padding:16px 0 0;text-align:right;font-family:${MONO};font-size:21px;color:${CHROME};">${money(p.total)}</td>
      </tr>
    </table>
    ${bankBox(settings)}
    <p style="margin:0;font-family:${SANS};color:${DUST};">Upload your slip within 24 hours or the reservation is released.</p>`;

  const text = `We've got your order, ${p.name}

Order ${p.code} — ${p.batch}
${items.map((i) => `${i.product}${i.size ? ` (${i.size})` : ''} x${i.qty} — ${money(i.unit * i.qty)}`).join('\n')}
Total to deposit: ${money(p.total)}

Deposit to:
${settings.bank_account_name}
${settings.bank_account_no}
${settings.bank_branch}

Upload your slip within 24 hours or the reservation is released.
Manage your order: ${siteUrl}/my-orders${textFooter()}`;

  return {
    subject: `We've got your order, ${p.name}`,
    html: layout({
      siteUrl,
      eyebrow: 'Order received',
      heading: `We've got your order, ${p.name}`,
      bodyHtml,
      ctaText: 'View your order',
      ctaHref: `${siteUrl}/my-orders`,
    }),
    text,
  };
}

function paymentVerified(p: OrderEmailPayload, _settings: EmailSettings, siteUrl: string): RenderedEmail {
  const bodyHtml = `
    <p style="margin:0 0 18px;">We've verified <b style="color:${CHROME};">${money(p.total)}</b> for order <b style="color:${CHROME};">${esc(p.code)}</b>.</p>
    <p style="margin:0;font-family:${SANS};color:${DUST};">We'll email you again when it's printed and ready to collect.</p>`;

  const text = `Payment verified — you're in

We've verified ${money(p.total)} for order ${p.code}.
We'll email you again when it's printed and ready to collect.

Your order: ${siteUrl}/my-orders${textFooter()}`;

  return {
    subject: `Payment verified — you're in`,
    html: layout({
      siteUrl,
      eyebrow: 'Payment verified',
      heading: `You're in, ${p.name}`,
      bodyHtml,
      ctaText: 'View your order',
      ctaHref: `${siteUrl}/my-orders`,
    }),
    text,
  };
}

function paymentRejected(p: OrderEmailPayload, _settings: EmailSettings, siteUrl: string): RenderedEmail {
  const reason = p.reason || 'The slip could not be matched to this order.';
  const bodyHtml = `
    <p style="margin:0 0 18px;">We couldn't verify the payment slip for order <b style="color:${CHROME};">${esc(p.code)}</b>.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-left:2px solid ${CHROME};background-color:rgba(232,234,240,.06);margin:0 0 20px;">
      <tr><td style="padding:14px 16px;font-family:${SANS};font-size:14px;color:${CHROME};">${esc(reason)}</td></tr>
    </table>
    <p style="margin:0;font-family:${SANS};color:${DUST};">Upload a new slip from your account page to continue.</p>`;

  const text = `We couldn't verify your slip

Order ${p.code}: ${reason}
Upload a new slip to continue: ${siteUrl}/my-orders${textFooter()}`;

  return {
    subject: `We couldn't verify your slip`,
    html: layout({
      siteUrl,
      eyebrow: 'Action needed',
      heading: `Order ${p.code} needs a new slip`,
      bodyHtml,
      ctaText: 'Re-upload your slip',
      ctaHref: `${siteUrl}/my-orders`,
    }),
    text,
  };
}

function readyForCollection(p: OrderEmailPayload, settings: EmailSettings, siteUrl: string): RenderedEmail {
  const bodyHtml = `
    <p style="margin:0 0 20px;">Order <b style="color:${CHROME};">${esc(p.code)}</b> is printed and waiting for you.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${LINE};margin:0 0 6px;">
      <tr><td style="padding:18px 20px;">
        <p style="margin:0 0 4px;font-family:${MONO};font-size:9.5px;letter-spacing:1.5px;text-transform:uppercase;color:${DUST};">Where</p>
        <p style="margin:0 0 14px;font-family:${SANS};font-size:15px;color:${CHROME};">${esc(settings.collection_point)}</p>
        <p style="margin:0 0 4px;font-family:${MONO};font-size:9.5px;letter-spacing:1.5px;text-transform:uppercase;color:${DUST};">When</p>
        <p style="margin:0 0 14px;font-family:${SANS};font-size:15px;color:${CHROME};">Any time before 18 September</p>
        <p style="margin:0 0 4px;font-family:${MONO};font-size:9.5px;letter-spacing:1.5px;text-transform:uppercase;color:${DUST};">Bring</p>
        <p style="margin:0;font-family:${MONO};font-size:15px;color:${CHROME};">Your order code — ${esc(p.code)}</p>
      </td></tr>
    </table>`;

  const text = `Your order is ready to collect

Order ${p.code}
Where: ${settings.collection_point}
When: Any time before 18 September
Bring: your order code, ${p.code}

Manage your order: ${siteUrl}/my-orders${textFooter()}`;

  return {
    subject: `Your order is ready to collect`,
    html: layout({
      siteUrl,
      eyebrow: 'Ready for collection',
      heading: `${p.name}, come get it`,
      bodyHtml,
      ctaText: 'View your order',
      ctaHref: `${siteUrl}/my-orders`,
    }),
    text,
  };
}

const RENDERERS: Record<string, (p: OrderEmailPayload, s: EmailSettings, siteUrl: string) => RenderedEmail> = {
  order_received: orderReceived,
  payment_verified: paymentVerified,
  payment_rejected: paymentRejected,
  ready_for_collection: readyForCollection,
};

export function renderTemplate(
  template: string,
  payload: OrderEmailPayload,
  settings: EmailSettings,
  siteUrl: string
): RenderedEmail {
  const renderer = RENDERERS[template];
  if (!renderer) throw new Error(`Unknown email template: ${template}`);
  return renderer(payload, settings, siteUrl);
}
