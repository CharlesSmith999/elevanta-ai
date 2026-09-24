import test from 'node:test';
import assert from 'node:assert/strict';
import { createGmailReader, htmlEmailText, parseBarkMessage, type GmailMessage } from './gmailIntake.js';
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
test('unknown templates and empty bodies require review', () => {
  assert.equal(parseBarkMessage(message('new unrecognized template'), start).state, 'needs_review');
  assert.equal(parseBarkMessage(message(''), start).state, 'needs_review');
});
test('HTML-only Bark message becomes a research lead with masks preserved', () => {
 const m=message(`<html><head><style>.x{}</style></head><body><script>ignore()</script><h2>Jos&#233; O&#39;Neil <b>is looking for a Web Designer</b></h2><p>London</p><div>15 credits to respond</div><p>078** ******</p><p>jo.se+test@e*****.com</p><p>&ldquo;Please build a website&rdquo;</p><h3>Project Details</h3><p>Budget: undecided</p><p>Contact José</p></body></html>`);
 m.payload!.mimeType='text/html';
 const result=parseBarkMessage(m,start);assert.equal(result.state,'parsed');
 if(result.state==='parsed'){assert.equal(result.lead.name,"José O'Neil");assert.equal(result.lead.maskedPhone,'078** ******');assert.equal(result.lead.maskedEmail,'jo.se+test@e*****.com');assert.equal(result.lead.description,'Please build a website');assert.equal(result.lead.details,'Budget: undecided');}
 assert.equal(htmlEmailText('<script>bad()</script><p>&lt;img src=x&gt; &amp; &#x110000;</p>').trim(),'<img src=x> &');
});
test('multipart prefers plain text and otherwise falls back to nested HTML',()=>{
 const m=message();const plain={...m.payload!,headers:undefined};m.payload={headers:m.payload!.headers,mimeType:'multipart/alternative',parts:[{mimeType:'text/html',body:{data:Buffer.from('<p>Wrong is looking for a Web Designer</p>').toString('base64url')}},plain]};
 const result=parseBarkMessage(m,start);assert.equal(result.state==='parsed'&&result.lead.name,"José O'Neil");
 m.payload.parts=[{mimeType:'multipart/related',parts:[{mimeType:'text/html',body:{data:Buffer.from('<h2>Alex is looking for a Web Designer</h2><p>London</p><p>15 credits to respond</p>').toString('base64url')}}]}];assert.equal(parseBarkMessage(m,start).state,'parsed');
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
