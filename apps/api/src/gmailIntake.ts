// Read-only primitives. No polling or persistence is enabled by importing this module.
export const barkParserVersion = 'bark-mime-v2';
export type GmailPart = { mimeType?: string; body?: { data?: string; size?: number }; parts?: GmailPart[]; headers?: { name: string; value: string }[] };
export type GmailMessage = { id: string; threadId?: string; internalDate: string; labelIds?: string[]; payload?: GmailPart };
export type BarkLead = { name: string; category: 'app' | 'web' | 'smm'; receivedAt: string; maskedPhone?: string; maskedEmail?: string; address?: string; credits?: number; description?: string; details?: string };
export type ParseResult = { state: 'parsed'; lead: BarkLead } | { state: 'ignored' | 'needs_review'; code: string };

function header(message: GmailMessage, name: string) {
  return message.payload?.headers?.find(h => h.name.toLowerCase() === name)?.value ?? '';
}

export function htmlEmailText(html: string): string {
  // Convert inert text only. Never render email HTML or fetch embedded resources.
  const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—', colon: ':' };
  return html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|head)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(?:br|hr)\b[^>]*>|<\/(?:p|div|tr|table|h[1-6]|li|section)\s*>/gi, '\n')
    .replace(/<\/(?:td|th)\s*>/gi, ' ').replace(/<[^>]*>/g, '')
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (original, code: string) => {
      if (!code.startsWith('#')) return entities[code.toLowerCase()] ?? original;
      const point = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : '';
    }).replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n');
}

function mimeText(part: GmailPart, mime: 'text/plain' | 'text/html', depth = 0): string {
  if (depth > 12) throw new Error('mime_depth');
  if (part.mimeType === mime && part.body?.data) {
    if (part.body.data.length > 700000) throw new Error('body_too_large');
    return Buffer.from(part.body.data, 'base64url').toString('utf8');
  }
  if ((part.parts?.length ?? 0) > 100) throw new Error('mime_parts');
  return (part.parts ?? []).map(p => mimeText(p, mime, depth + 1)).filter(Boolean).join('\n');
}

export function parseBarkMessage(message: GmailMessage, activatedAt: string): ParseResult {
  const cutoff = Date.parse(activatedAt);
  if (!Number.isFinite(cutoff)) throw new Error('Invalid activation time');
  const received = Number(message.internalDate);
  if (!message.id || !Number.isFinite(received) || !Number.isFinite(new Date(received).getTime()) || received <= 0) return { state: 'needs_review', code: 'invalid_metadata' };
  if (received < cutoff) return { state: 'ignored', code: 'before_activation' };
  if (!message.labelIds?.some(l => l === 'INBOX' || l === 'SPAM') || message.labelIds.includes('TRASH')) return { state: 'ignored', code: 'outside_mailbox_scope' };
  const from = header(message, 'from').trim();
  const sender = (from.match(/<([^<>]+)>$/)?.[1] ?? from).toLowerCase();
  if (!/^[^\s<>@]+@(?:[a-z0-9-]+\.)*bark\.com$/.test(sender)) return { state: 'ignored', code: 'not_bark_sender' };
  let body: string;
  try {
    body = mimeText(message.payload ?? {}, 'text/plain');
    if (!body.trim()) body = htmlEmailText(mimeText(message.payload ?? {}, 'text/html'));
  } catch { return { state: 'needs_review', code: 'unsupported_mime_size' }; }
  if (!body.trim()) return { state: 'needs_review', code: 'message_text_missing' };
  if (body.length > 500000) return { state: 'needs_review', code: 'body_too_large' };
  body = body.replace(/[\u200B\u200C\u200D\uFEFF\u00AD]/g, '').replace(/\u00A0/g, ' ').replace(/\r\n?/g, '\n');
  // Strip paired emphasis, never the asterisks inside masked contacts.
  const text = body.replace(/(?<![\w*])\*\*([^*\n]*\p{L}[^*\n]*)\*\*(?!\*)/gu, '$1');
  const match = text.match(/^\s*([^\n]{1,160}?)\s+is looking for\s+(?:a\s+|an\s+)?(Mobile Software Developer|Software Developer|Web Developer|Web Designer|Social Media Marketing Expert)\b/im);
  if (!match) return { state: 'needs_review', code: 'unrecognized_lead_template' };
  const name = match[1].trim();
  const role = match[2].toLowerCase();
  const rest = text.slice((match.index ?? 0) + match[0].length);
  const creditsMatch = rest.match(/(\d+)\s*credits to respond/i);
  const credits = creditsMatch ? Number(creditsMatch[1]) : undefined;
  if (credits !== undefined && (!Number.isSafeInteger(credits) || credits > 2147483647)) return { state: 'needs_review', code: 'invalid_credits' };
  const contactBlock = creditsMatch ? rest.slice((creditsMatch.index ?? 0) + creditsMatch[0].length).split(/Project Details/i)[0] : '';
  const email = contactBlock.match(/[a-z0-9*._%+\-]+@[a-z0-9*.\-]+\.[a-z]{2,}/i)?.[0];
  const phone = contactBlock.split('\n').map(l => l.trim()).find(l => /^[+()\d][\d*() .+\-]{5,79}$/.test(l) && /\d/.test(l));
  const address = creditsMatch ? rest.slice(0, creditsMatch.index).trim().replace(/^image\s*/i, '') : undefined;
  const description = text.match(/[“"]([^“”"\n]+)[”"]/)?.[1];
  const details = text.match(/Project Details\s*([\s\S]*?)(?:\n\s*Contact\s+[^\n]+|$)/i)?.[1].trim();
  if ((address?.length ?? 0) > 500 || (details?.length ?? 0) > 12000 || (description?.length ?? 0) > 4000 || (email?.length ?? 0) > 254) return { state: 'needs_review', code: 'field_too_long' };
  return { state: 'parsed', lead: { name, category: role.includes('software') ? 'app' : role.includes('web') ? 'web' : 'smm', receivedAt: new Date(received).toISOString(), maskedPhone: phone, maskedEmail: email, address, credits, description, details } };
}

export class GmailReadError extends Error {
  constructor(public readonly code: 'authorization' | 'rate_limit' | 'temporary' | 'invalid_response') { super(`Gmail reader: ${code}`); }
}

export function createGmailReader(accessToken: string, request: typeof fetch = fetch) {
  if (!accessToken.trim()) throw new Error('Gmail authorization is required');
  async function get(path: string) {
    let response: Response;
    try { response = await request(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15000), redirect: 'error' }); }
    catch { throw new GmailReadError('temporary'); }
    if (!response.ok) throw new GmailReadError(response.status === 401 || response.status === 403 ? 'authorization' : response.status === 429 ? 'rate_limit' : 'temporary');
    try { return await response.json(); } catch { throw new GmailReadError('invalid_response'); }
  }
  return {
    async verifyMailbox(expectedEmail: string) {
      const value = await get('profile');
      if (typeof value.emailAddress !== 'string' || value.emailAddress.toLowerCase() !== expectedEmail.trim().toLowerCase()) throw new GmailReadError('authorization');
    },
    async list(activatedAt: string, pageToken?: string): Promise<{ messages: { id: string }[]; nextPageToken?: string }> {
      const cutoff = Date.parse(activatedAt);
      if (!Number.isFinite(cutoff)) throw new Error('Invalid activation time');
      // One-second overlap is filtered using internalDate by the parser.
      const query = new URLSearchParams({ q: `from:bark.com (in:inbox OR in:spam) after:${Math.floor(cutoff / 1000) - 1}`, includeSpamTrash: 'true', maxResults: '100' });
      if (pageToken) query.set('pageToken', pageToken);
      const value = await get(`messages?${query}`);
      if ((value.messages !== undefined && (!Array.isArray(value.messages) || value.messages.some((m: { id?: unknown }) => !m || typeof m.id !== 'string'))) || (value.nextPageToken !== undefined && typeof value.nextPageToken !== 'string')) throw new GmailReadError('invalid_response');
      return { messages: value.messages ?? [], nextPageToken: value.nextPageToken };
    },
    async message(id: string): Promise<GmailMessage> {
      if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('Invalid Gmail message ID');
      const value = await get(`messages/${encodeURIComponent(id)}?format=full`);
      if (value.id !== id || typeof value.internalDate !== 'string') throw new GmailReadError('invalid_response');
      return value;
    },
  };
}
