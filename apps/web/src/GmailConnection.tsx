import { useEffect,useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getGmailHealth,saveGmailMailbox,connectGmail,enableGmail,syncGmailNow,type GmailHealth } from './api';

export function GmailConnection({session}:{session:Session}) {
 const [health,setHealth]=useState<GmailHealth>(); const [busy,setBusy]=useState(false); const [message,setMessage]=useState('');
 const [mailbox,setMailbox]=useState('');
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
 <p id="gmail-mailbox-help">{health?.connected?'This address is connected and cannot be changed here.':'Saving the address does not authorize Gmail or turn on intake. No password is needed.'}</p>
 </form>
 <p>Activation imports only messages received from that moment. Re-enabling starts a new intake window. {health?.lastSyncAt&&`Last sync: ${new Date(health.lastSyncAt).toLocaleString()}`} {health?.lastError&&`Attention: ${health.lastError}`}</p>
 <div className="research-toolbar"><button disabled={busy||!health?.mailbox||!health.setupReady||mailbox.trim().toLowerCase()!==health.mailbox} onClick={()=>action('connect')}>{health?.connected?'Reconnect Gmail':'Authorize Gmail later'}</button><button disabled={busy||!health?.connected||(!health.enabled&&!health.activationApproved)} onClick={()=>action('toggle')}>{health?.enabled?'Disable intake':'Activate new-email intake'}</button><button disabled={busy||!health?.enabled} onClick={()=>action('sync')}>Sync now</button><button disabled={busy} onClick={()=>action('refresh')}>Refresh status</button></div>
 {health&&!health.setupReady&&<p>Your email can be saved now. Google authorization setup is still pending.</p>}
 {!health?.activationApproved&&<p>Live activation is waiting for the documented release approvals.</p>}
 {!!health?.failures?.length&&<details><summary>Emails requiring parser review ({health.failures.length}, latest 20)</summary><ul>{health.failures.map(item=><li key={item.provider_message_id}>{item.provider_message_id}: {item.failure_code} · {new Date(item.received_at).toLocaleString()}</li>)}</ul></details>}
 {message&&<p role="status">{message}</p>}</section>;
}
