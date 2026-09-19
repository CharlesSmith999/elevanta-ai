import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {seal,unseal,validSchedulerSecret,gmailConfig} from './gmailConnector.js';
test('Gmail secrets are encrypted, authenticated and workspace bound',()=>{
 const key=randomBytes(32);const token=seal('synthetic-refresh-token',key,'workspace-a');
 assert.ok(!token.includes('synthetic'));assert.equal(unseal(token,key,'workspace-a'),'synthetic-refresh-token');
 assert.throws(()=>unseal(token,key,'workspace-b'));assert.throws(()=>unseal(token,randomBytes(32),'workspace-a'));
 assert.notEqual(token,seal('synthetic-refresh-token',key,'workspace-a'));
 const parts=token.split('.');parts[2]=Buffer.from('tampered').toString('base64url');assert.throws(()=>unseal(parts.join('.'),key,'workspace-a'));
});
test('Scheduler denies missing, short and incorrect credentials',()=>{
 const secret='a'.repeat(32);
 assert.equal(validSchedulerSecret('Bearer '+secret,secret),true);
 for(const actual of [undefined,'Bearer wrong','Bearer '+secret+'x'])assert.equal(validSchedulerSecret(actual,secret),false);
 assert.equal(validSchedulerSecret('Bearer short','short'),false);assert.equal(validSchedulerSecret('Bearer anything',undefined),false);
});
test('Gmail configuration fails closed without exposing credentials',()=>{
 assert.throws(()=>gmailConfig({}),/incomplete/);
 const env={GOOGLE_GMAIL_CLIENT_ID:'id',GOOGLE_GMAIL_CLIENT_SECRET:'secret',GMAIL_EXPECTED_MAILBOX:'owner@example.invalid',GMAIL_TOKEN_KEY:randomBytes(32).toString('base64'),GMAIL_REDIRECT_URI:'https://crm.example.invalid/api/v1/inbound/gmail/callback'};
 assert.equal(gmailConfig(env).mailbox,'owner@example.invalid');
 assert.throws(()=>gmailConfig({...env,GMAIL_REDIRECT_URI:'http://crm.example.invalid/callback'}),/callback/);
 assert.throws(()=>gmailConfig({...env,GMAIL_TOKEN_KEY:'bad'}),/encryption/);
});
