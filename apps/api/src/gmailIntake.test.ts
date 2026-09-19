import test from 'node:test';
import assert from 'node:assert/strict';
import { createGmailReader, parseBarkMessage, type GmailMessage } from './gmailIntake.js';
const start = '2026-09-18T12:00:00.000Z';
const body = `José O'Neil is looking for a Web Designer\nLondon\n15 credits to respond\n078** ******\njo.se+test@e*****.com\n“Please build a website”\nProject Details\nBudget: undecided\nContact José`;
function message(text = body): GmailMessage { return { id: 'abc123', internalDate: String(Date.parse(start)), labelIds: ['INBOX', 'BarkProcessed'], payload: { mimeType: 'text/plain', headers: [{ name: 'From', value: 'Bark <leads@bark.com>' }], body: { data: Buffer.from(text).toString('base64url') } } }; }
test('preserves full names, masks and original fields', () => {
  const result = parseBarkMessage(message(), start); assert.equal(result.state, 'parsed');
  if (result.state === 'parsed') { assert.equal(result.lead.name, "José O'Neil"); assert.equal(result.lead.maskedPhone, '078** ******'); assert.equal(result.lead.maskedEmail, 'jo.se+test@e*****.com'); assert.equal(result.lead.credits, 15); assert.equal(result.lead.details, 'Budget: undecided'); }
});
test('all supported categories and markdown emphasis', () => {
  for (const [role, category] of [['Software Developer','app'],['Mobile Software Developer','app'],['Web Developer','web'],['Social Media Marketing Expert','smm']]) {
    const result = parseBarkMessage(message(body.replace('Web Designer', role).replace("José O'Neil is", "**José O'Neil** is")), start);
    assert.equal(result.state === 'parsed' && result.lead.category, category);
  }
});
test('rejects older mail but accepts exact activation boundary and Spam', () => {
  const m = message(); m.internalDate = String(Date.parse(start) - 1); assert.deepEqual(parseBarkMessage(m, start), { state: 'ignored', code: 'before_activation' });
  m.internalDate = String(Date.parse(start)); m.labelIds = ['SPAM']; assert.equal(parseBarkMessage(m, start).state, 'parsed');
  m.labelIds = ['TRASH']; assert.equal(parseBarkMessage(m, start).state, 'ignored');
});
test('domain lookalikes and misleading display names are excluded', () => {
  for (const sender of ['leads@bark.com.evil.test', 'Bark <attacker@example.invalid>']) { const m = message(); m.payload!.headers![0].value = sender; assert.equal(parseBarkMessage(m, start).state, 'ignored'); }
});
test('unknown or HTML-only templates require review, never silent loss', () => {
  assert.equal(parseBarkMessage(message('new unrecognized template'), start).state, 'needs_review');
  const m = message(); m.payload!.mimeType = 'text/html'; assert.equal(parseBarkMessage(m, start).state, 'needs_review');
});
test('nested MIME plain part supported and oversized fields flagged', () => {
  const m = message(); const part = { ...m.payload!, headers: undefined }; m.payload = { headers: m.payload!.headers, mimeType: 'multipart/alternative', parts: [part] };
  assert.equal(parseBarkMessage(m, start).state, 'parsed'); assert.equal(parseBarkMessage(message(body.replace('London', 'a'.repeat(501))), start).state, 'needs_review');
});
test('reader is GET only, retains pagination and ignores sheet label', async () => {
  const calls: string[] = []; const reader = createGmailReader('synthetic', async (url, init) => { calls.push(String(url)); assert.equal(init?.method, 'GET'); return Response.json({ messages: [{ id: 'abc123' }], nextPageToken: 'next' }); });
  const result = await reader.list(start, 'prior'); assert.equal(result.nextPageToken, 'next'); const url = new URL(calls[0]); assert.equal(url.searchParams.get('pageToken'), 'prior'); assert.equal(url.searchParams.get('includeSpamTrash'), 'true'); assert.ok(!url.searchParams.get('q')!.includes('barkprocessed'));
});
test('mailbox mismatch, rate limit and malformed responses fail safely', async () => {
  await assert.rejects(createGmailReader('synthetic', async () => Response.json({ emailAddress: 'wrong@example.invalid' })).verifyMailbox('owner@example.invalid'), /authorization/);
  await assert.rejects(createGmailReader('synthetic', async () => new Response('secret details', { status: 429 })).list(start), /rate_limit/);
  await assert.rejects(createGmailReader('synthetic', async () => Response.json({ messages: 'bad' })).list(start), /invalid_response/);
});
