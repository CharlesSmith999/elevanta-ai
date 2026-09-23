import { useEffect,useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getGmailHealth,saveGmailMailbox,replaceGmailMailbox,connectGmail,enableGmail,syncGmailNow,type GmailHealth } from './api';

export function GmailConnection({session}:{session:Session}) {
 const [health,setHealth]=useState<GmailHealth>(); const [busy,setBusy]=useState(false); const [message,setMessage]=useState('');
 const [mailbox,setMailbox]=useState('');
 const [changing,setChanging]=useState(false); const [replacement,setReplacement]=useState(''); const [confirmed,setConfirmed]=useState(false);
 async function replace(event:FormEvent<HTMLFormElement>){
  event.preventDefault(); if(busy||!confirmed||!health?.settingsRevision)return;
  setBusy(true);setMessage('');
  try{await replaceGmailMailbox(session,replacement.trim(),health.settingsRevision);setChanging(false);setReplacement('');setConfirmed(false);await refresh();setMessage('Mailbox changed. Existing leads are safe. Authorize the new Google account, then activate intake.');}
  catch(error){setMessage(error instanceof Error?error.message:'Mailbox could not be changed.');}
  finally{setBusy(false);}
 }
 async function refresh(){const result=await getGmailHealth(session);setHealth(result);setMailbox(result.mailbox);}
 useEffect(()=>{let active=true;getGmailHealth(session).then(v=>{if(active){setHealth(v);setMailbox(v.mailbox);}}).catch(()=>{if(active)setMessage('Gmail setup is not available yet.');});return()=>{active=false};},[session]);
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;setBusy(true);setMessage('');
  try{await saveGmailMailbox(session,mailbox.trim());await refresh();setMessage('Email saved. No emails are being imported. You can authorize this mailbox later.');}
  catch(error){setMessage(error instanceof Error?error.message:'Email could not be saved.');}
  finally{setBusy(false);}
 }
 async function action(kind:'connect'|'toggle'|'sync'|'refresh'){
  if(busy)return;setBusy(true);setMessage('');
  try{
   if(kind==='connect'){const result=await connectGmail(session);const url=new URL(result.url);if(url.origin!=='https://accounts.google.com')throw new Error('Invalid authorization destination.');window.location.assign(url.href);return;}
   if(kind==='toggle')await enableGmail(session,!health?.enabled);
   if(kind==='sync'){const result=await syncGmailNow(session);setMessage(result.state==='synced'?'Sync completed. Refresh the queue to see new leads.':result.state==='idle'?'Intake is disabled or another sync is running.':'Sync needs attention. Check the connection status.');}
   await refresh();
  }catch(error){setMessage(error instanceof Error?error.message:'Gmail operation failed.');}
  finally{setBusy(false);}
 }
 return <section className="research-card" aria-label="Admin Gmail connection"><h3>Gmail intake</h3><p>{health?.enabled?'Automatic intake enabled':health?.connected?'Connected, intake disabled':'Not connected'}. Direct Gmail intake, not Google Sheets. Once activated, scheduled checks run every minute; delivery can take longer. Use Sync now for an immediate check.</p>
 <form onSubmit={save} className="research-mailbox-form">
 <label htmlFor="gmail-mailbox">Lead inbox email</label>
 <div className="research-mailbox-controls"><input id="gmail-mailbox" name="mailbox" type="email" autoComplete="email" required maxLength={254} value={mailbox} onChange={event=>setMailbox(event.target.value)} placeholder="Enter the email address when ready" disabled={busy||!health||health.connected} aria-describedby="gmail-mailbox-help" /><button className="primary" type="submit" disabled={busy||!health||health.connected||!mailbox.trim()}>{busy?'Please wait…':'Save email for later'}</button></div>
 <p id="gmail-mailbox-help">{health?.connected?'Use Change connected email below to replace this mailbox safely.':'Saving the address does not authorize Gmail or turn on intake. No password is needed.'}</p>
 </form>
 {health?.mailbox&&health.settingsRevision&&!changing&&<button className="quiet" disabled={busy} onClick={()=>{setChanging(true);setReplacement('');setConfirmed(false);}}>Change connected email</button>}
 {changing&&<form onSubmit={replace} className="research-mailbox-form" aria-label="Change connected email">
  <h4>Change connected email</h4><p>Current mailbox: {health?.mailbox}. This stops intake and removes the old connection from this CRM. Existing leads and their history stay unchanged.</p>
  <label htmlFor="gmail-replacement">New Gmail address</label><input id="gmail-replacement" type="email" required maxLength={254} value={replacement} disabled={busy} onChange={e=>setReplacement(e.target.value)} />
  <p>The new account must authorize read-only access. Intake stays off until activated. While Google setup is in testing mode, the new account must also be added to the Google test-user list.</p>
  <label><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)} /> I confirm: stop the current connection and require fresh authorization.</label>
  <div className="research-toolbar"><button className="primary" disabled={busy||!confirmed||!replacement.trim()||replacement.trim().toLowerCase()===health?.mailbox}>Confirm email change</button><button type="button" disabled={busy} onClick={()=>setChanging(false)}>Cancel</button></div>
  <p>This removes the CRM's stored token, not Google's permission grant. You can also remove Elevanta AI from the old Google account's third-party connections.</p>
 </form>}
 <p>Activation imports only messages received from that moment. Re-enabling starts a new intake window. {health?.lastSyncAt&&`Last sync: ${new Date(health.lastSyncAt).toLocaleString()}`} {health?.lastError&&`Attention: ${health.lastError}`}</p>
 <div className="research-toolbar"><button disabled={busy||!health?.mailbox||!health.setupReady||mailbox.trim().toLowerCase()!==health.mailbox} onClick={()=>action('connect')}>{health?.connected?'Reconnect Gmail':'Authorize Gmail later'}</button><button disabled={busy||!health?.connected||(!health.enabled&&!health.activationApproved)} onClick={()=>action('toggle')}>{health?.enabled?'Disable intake':'Activate new-email intake'}</button><button disabled={busy||!health?.enabled} onClick={()=>action('sync')}>Sync now</button><button disabled={busy} onClick={()=>action('refresh')}>Refresh status</button></div>
 {health&&!health.setupReady&&<p>Your email can be saved now. Google authorization setup is still pending.</p>}
 {!health?.activationApproved&&<p>Live activation is waiting for the documented release approvals.</p>}
 {!!health?.failures?.length&&<details><summary>Emails requiring parser review ({health.failures.length}, latest 20)</summary><ul>{health.failures.map(item=><li key={item.provider_message_id}>{item.provider_message_id}: {item.failure_code} · {new Date(item.received_at).toLocaleString()}</li>)}</ul></details>}
 {message&&<p role="status">{message}</p>}</section>;
}
