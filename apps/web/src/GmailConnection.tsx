import { useEffect,useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getGmailHealth,connectGmail,enableGmail,syncGmailNow,type GmailHealth } from './api';

export function GmailConnection({session}:{session:Session}) {
 const [health,setHealth]=useState<GmailHealth>(); const [busy,setBusy]=useState(false); const [message,setMessage]=useState('');
 async function refresh(){setHealth(await getGmailHealth(session));}
 useEffect(()=>{let active=true;getGmailHealth(session).then(v=>{if(active)setHealth(v)}).catch(()=>{if(active)setMessage('Gmail setup is not available yet.');});return()=>{active=false};},[session]);
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
 return <section className="research-card" aria-label="Admin Gmail connection"><h3>Gmail intake</h3><p>{health?.enabled?'Automatic intake enabled':health?.connected?'Connected, intake disabled':'Not connected'}. Direct Gmail intake, not Google Sheets. Daily scheduled sync; use Sync now for an immediate check.</p>
 <p>Activation imports only messages received from that moment. Re-enabling starts a new intake window. {health?.lastSyncAt&&`Last sync: ${new Date(health.lastSyncAt).toLocaleString()}`} {health?.lastError&&`Attention: ${health.lastError}`}</p>
 <div className="research-toolbar"><button disabled={busy} onClick={()=>action('connect')}>{health?.connected?'Reconnect Gmail':'Connect Gmail'}</button><button disabled={busy||!health?.connected||(!health.enabled&&!health.activationApproved)} onClick={()=>action('toggle')}>{health?.enabled?'Disable intake':'Activate new-email intake'}</button><button disabled={busy||!health?.enabled} onClick={()=>action('sync')}>Sync now</button><button disabled={busy} onClick={()=>action('refresh')}>Refresh status</button></div>
 {!health?.activationApproved&&<p>Live activation is waiting for the documented release approvals.</p>}
 {!!health?.failures?.length&&<details><summary>Emails requiring parser review ({health.failures.length}, latest 20)</summary><ul>{health.failures.map(item=><li key={item.provider_message_id}>{item.provider_message_id}: {item.failure_code} · {new Date(item.received_at).toLocaleString()}</li>)}</ul></details>}
 {message&&<p role="status">{message}</p>}</section>;
}
