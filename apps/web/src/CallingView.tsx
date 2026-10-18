import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { IconPhone, IconCopy } from '@tabler/icons-react';
import { request } from './api';
import { currentAssignment, leadCategoryLabels, lostReasonOptions, ownerId, type Lead, type User, type LeadCategory } from './domain';
import { callingRows, callTab, callMetrics, localDay, callResults, callResultTones, callingCsv, type CallingRecord, type CallRow, type CallResult } from './callingModel';
import './callingView.css';

function samples(leads: Lead[]): CallingRecord[] {
  return leads.map(lead => ({ id: lead.id, name: lead.name, category: lead.category ?? 'not_available', status: lead.status, qualification: lead.qualification, source: lead.source, ownerId: ownerId(lead) ?? null, assignedAt: currentAssignment(lead)?.at ?? null, blocked: Boolean(lead.routingPaused) || ['incorrect','duplicate','do_not_contact','won','lost','not_interested'].includes(lead.status), methods: (lead.discoveredContactMethods ?? (lead.phone ? [{type: 'phone' as const, value: lead.phone}] : [])).map((method,index) => ({ ...method, id: `${lead.id}-${index}`, health: 'unverified', focus: 'active', restricted: false })), events: [], followUps: lead.followUps.filter(item => item.status === 'open').map(item => ({ methodId: null, dueAt: item.dueAt })) }));
}

export function CallingView({ leads, viewer, session, ready, onDetails, onSaved }: { leads: Lead[]; viewer: User; session?: Session; ready: boolean; onDetails: (id: string) => void; onSaved: (leadId:string,result:CallResult,note:string,due:string) => void }) {
  const [records, setRecords] = useState<CallingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState('todo');
  const [outcomes, setOutcomes] = useState<string[]>([]);
  const [service, setService] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string>();
  const [clock, setClock] = useState(new Date());
  const [reportDay, setReportDay] = useState(localDay(new Date()));
  const [revision, setRevision] = useState(0);
  const [exporting, setExporting] = useState(false);
  const scope = leads.map(lead => lead.id).sort().join(',');
  const identity = `${session?.user.id ?? 'sample'}:${viewer.id}:${scope}`;
  const identityRef = useRef(identity); identityRef.current = identity;
  const filterKey = `elevanta-calling-status-filters:${viewer.id}`;
  useEffect(() => { try { const saved = JSON.parse(localStorage.getItem(filterKey) ?? 'null'); if (Array.isArray(saved)) setOutcomes(saved.filter(value => value === 'never' || value in callResults)); } catch { /* Use all results when no saved preference exists. */ } }, [filterKey]);
  useEffect(() => { localStorage.setItem(filterKey, JSON.stringify(outcomes)); }, [filterKey, outcomes]);
  useEffect(() => { const timer = window.setInterval(() => setClock(new Date()), 30000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    let active = true; setRecords([]); setLoading(true); setError(''); setExpanded(undefined);
    if (session && !ready) { setLoading(false); setError('Reconnect to the CRM before opening the calling view.'); return; }
    if (!session) {
      let cached: CallingRecord[] = []; try { cached = JSON.parse(localStorage.getItem(`elevanta-sample-calls:${viewer.id}`) ?? '[]'); } catch { /* Fresh sample workspace. */ }
      setRecords(samples(leads).map(record => { const saved=cached.find(item=>item.id===record.id); return saved ? {...record,methods:saved.methods,events:saved.events,followUps:saved.followUps,blocked:saved.blocked} : record; })); setLoading(false); return;
    }
    const ids = scope ? scope.split(',') : [];
    void (async () => {
      const result: CallingRecord[] = [];
      for (let offset = 0; offset < ids.length; offset += 400) {
        const responses = await Promise.all([0,100,200,300].filter(step => offset+step < ids.length).map(step => request<{records: CallingRecord[]}>(session, '/v1/calling-list', { method: 'POST', body: JSON.stringify({ids: ids.slice(offset+step, offset+step+100)}) })));
        if (!active) return;
        result.push(...responses.flatMap(response => response.records));
      }
      if (active) { setRecords(result); setLoading(false); }
    })().catch(err => { if (active) { setError(err instanceof Error ? err.message : 'Calling list could not load.'); setLoading(false); } });
    return () => { active = false; };
  }, [identity, revision, ready]);
  useEffect(() => { if (!session && !loading) localStorage.setItem(`elevanta-sample-calls:${viewer.id}`,JSON.stringify(records)); }, [session,loading,records,viewer.id]);
  const today = localDay(clock);
  const rows = callingRows(records, today);
  const matching = rows.filter(row => (!outcomes.length || outcomes.includes(row.latest?.outcome ?? 'never')) && (service === 'all' || row.record.category === service) && row.record.name.toLowerCase().includes(query.trim().toLowerCase()));
  const filtered = matching.filter(row => callTab(row, tab, clock));
  const metrics = callMetrics(records, reportDay, viewer.role === 'sales_agent' ? viewer.id : undefined);
  const pageIndex = Math.min(page, Math.max(0, Math.ceil(filtered.length/30)-1));
  useEffect(() => { setPage(0); }, [tab,outcomes,service,query]);
  async function exportRows() {
    setExporting(true); setError('');
    try {
      const ids = [...new Set(filtered.map(row => row.record.id))];
      const result = session ? await request<{records:CallingRecord[]}>(session, '/v1/calling-list/export', {method:'POST', body:JSON.stringify({ids, filters:JSON.stringify({tab,outcomes,service,query})})}) : {records};
      const keys = new Set(filtered.map(row => row.key));
      const selected = result.records.map(record => ({...record, methods:record.methods.filter(method => keys.has(`${record.id}:${method.id}`))}));
      const url = URL.createObjectURL(new Blob([callingCsv(selected)], {type:'text/csv;charset=utf-8;'}));
      const link = document.createElement('a'); link.href = url; link.download = `calling-list-${today}.csv`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice('Filtered calling list downloaded.');
    } catch(err) { setError(err instanceof Error ? err.message : 'Download failed.'); } finally { setExporting(false); }
  }
  async function save(row: CallRow, result: CallResult, note: string, due: string, reason: string, requestId: string) {
    const captured = identity;
    if (session) {
      await request(session, '/v1/calling-list/result', {method:'POST', body:JSON.stringify({opportunityId:row.record.id, contactMethodId:row.method.id, requestId, outcome:result, body:note || undefined, followUpAt:due ? new Date(due).toISOString() : undefined, lostReason:reason || undefined})});
      if (identityRef.current !== captured) return;
    }
    const at = new Date().toISOString();
    setRecords(current => current.map(record => record.id !== row.record.id ? record : ({...record, blocked: record.blocked || result === 'not_interested', methods:record.methods.map(method => method.id === row.method.id && result === 'wrong_number' ? {...method, health:'wrong_person', focus:'removed'} : method), events:[{id:requestId,methodId:row.method.id,actorId:viewer.id,at,outcome:result,body:note},...record.events], followUps:due ? [...record.followUps,{methodId:row.method.id,dueAt:new Date(due).toISOString()}] : record.followUps})));
    setExpanded(undefined); setNotice(`${row.record.name}: ${callResults[result]} saved to the lead log.`); onSaved(row.record.id,result,note,due);
  }
  const canAct = viewer.role === 'sales_agent' && (!session || session.user.id === viewer.id);
  return <section className="panel calling-view" aria-label="Calling view">
    <div className="panel-heading"><div><h2>Calling view</h2><p>Call, record the result, and continue with the next row.</p></div><button className="quiet" disabled={loading || exporting || !filtered.length} onClick={() => void exportRows()}>{exporting ? 'Preparing download…' : 'Download filtered leads'}</button></div>
    <div className="calling-metrics"><label>Report date<input type="date" value={reportDay} max={today} onChange={event => setReportDay(event.target.value || today)} /></label><span><b>{metrics.attempts}</b> Logged calls</span><span><b>{metrics.unique}</b> Unique numbers</span><span><b>{metrics.connected}</b> Reached contacts</span><span><b>{metrics.rate}%</b> Connection rate</span></div>
    <small>Based on manually logged calls in your local timezone. A Dial click is not counted.</small>
    <nav className="calling-tabs" aria-label="Calling lists">{[['todo','To Call'],['called','Called Today'],['followup','Follow-up Needed']].map(([key,label]) => <button className={tab === key ? 'primary' : 'quiet'} aria-pressed={tab === key} key={key} onClick={() => {setTab(key);setExpanded(undefined);}}>{label} <b>{matching.filter(row => callTab(row,key,clock)).length}</b></button>)}</nav>
    <div className="calling-filters"><label>Search<input placeholder="Lead name" value={query} onChange={event => setQuery(event.target.value)} /></label><details className="calling-status-filter"><summary>Last call result {outcomes.length ? `(${outcomes.length} selected)` : '(All results)'}</summary><div className="calling-status-options"><label><input type="checkbox" checked={outcomes.includes('never')} onChange={event => setOutcomes(current => event.target.checked ? [...current, 'never'] : current.filter(value => value !== 'never'))} /> <span className="calling-result result-gray">Never called</span></label>{Object.entries(callResults).map(([key,label]) => <label key={key}><input type="checkbox" checked={outcomes.includes(key)} onChange={event => setOutcomes(current => event.target.checked ? [...current, key] : current.filter(value => value !== key))} /> <span className={`calling-result result-${callResultTones[key as CallResult]}`}>{label}</span></label>)}<button type="button" className="quiet" onClick={() => setOutcomes([])}>Clear status filters</button></div></details><label>Service<select aria-label="Service" value={service} onChange={event => setService(event.target.value)}><option value="all">All services</option>{Object.entries(leadCategoryLabels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label><button className="quiet" disabled={loading || Boolean(expanded)} onClick={() => setRevision(value => value+1)}>Refresh</button></div>
    {notice && <p role="status">{notice}</p>}{error && <p role="alert">{error}</p>}
    {loading ? <p role="status">Loading contact health and call history…</p> : <><div className="calling-table"><div className="calling-heading"><span>Lead</span><span>Service</span><span>Last result</span><span>Actions</span></div>{filtered.slice(pageIndex*30,pageIndex*30+30).map(row => <div className="calling-entry" key={row.key}><div className="calling-row"><button className="calling-name" onClick={() => onDetails(row.record.id)}>{row.record.name}</button><span>{leadCategoryLabels[row.record.category as LeadCategory] ?? 'Not available'}</span><span className={`calling-result result-${callResultTones[row.latest?.outcome as CallResult] ?? 'gray'}`}>{row.latest ? callResults[row.latest.outcome as CallResult] ?? row.latest.outcome : 'Never called'}</span><div className="calling-actions"><button className="quiet" disabled={!row.usable} aria-label={`Copy number for ${row.record.name}`} onClick={() => void navigator.clipboard.writeText(row.method.value).then(() => setNotice('Number copied.')).catch(() => setError('Clipboard access failed. Use Details to copy the number manually.'))}><IconCopy size={17}/> Copy</button>{row.usable && canAct && row.record.ownerId === viewer.id && <a className="primary calling-call" href={`tel:${row.method.value.trim().startsWith('+') ? '+' : ''}${row.method.value.replace(/\D/g,'')}`} onClick={() => setExpanded(row.key)}><IconPhone size={20}/> Call</a>}{canAct && row.usable && row.record.ownerId === viewer.id && <button className="quiet" onClick={() => setExpanded(expanded === row.key ? undefined : row.key)}>Log result</button>}<button className="quiet" onClick={() => onDetails(row.record.id)}>Details</button></div></div>{expanded === row.key && <CallResultForm key={row.key} onSave={(result,note,due,reason,id) => save(row,result,note,due,reason,id)} onCancel={() => setExpanded(undefined)} />}</div>)}{!filtered.length && <p className="calling-empty">No numbers match this list. Try another tab or filter.</p>}</div><div className="calling-pagination"><button className="quiet" disabled={!pageIndex} onClick={() => setPage(pageIndex-1)}>Previous</button><span>{filtered.length} numbers · Page {pageIndex+1} of {Math.max(1,Math.ceil(filtered.length/30))}</span><button className="quiet" disabled={(pageIndex+1)*30 >= filtered.length} onClick={() => setPage(pageIndex+1)}>Next</button></div></>}
  </section>;
}

function CallResultForm({ onSave, onCancel }: {onSave:(result:CallResult,note:string,due:string,reason:string,id:string)=>Promise<void>;onCancel:()=>void}) {
  const [note,setNote] = useState(''); const [choice,setChoice] = useState<CallResult>(); const [due,setDue] = useState(''); const [reason,setReason] = useState(''); const [busy,setBusy] = useState(false); const [error,setError] = useState('');
  const pending = useRef<{id:string;result:CallResult;note:string;due:string;reason:string} | undefined>(undefined);
  const locked = useRef(false);
  async function submit(result:CallResult) {
    if (locked.current) return;
    if (!pending.current && result === 'callback_requested' && (!due || Date.parse(due) <= Date.now())) {setError('Choose a future callback date and time.');return;}
    if (!pending.current && result === 'not_interested' && !reason) {setError('Choose a reason.');return;}
    pending.current ??= {id:crypto.randomUUID(),result,note,due:result === 'callback_requested' ? due : '',reason:result === 'not_interested' ? reason : ''};
    locked.current = true; setBusy(true); setError('');
    try { const value=pending.current; await onSave(value.result,value.note,value.due,value.reason,value.id); }
    catch(err) {setError(err instanceof Error ? err.message : 'Save failed. Retry to save this result.');}
    finally {locked.current=false;setBusy(false);}
  }
  return <div className="call-result-form"><strong>What happened?</strong><label>Optional note<input maxLength={5000} value={note} disabled={busy || Boolean(pending.current)} onChange={event=>setNote(event.target.value)} placeholder="Add context before choosing the result" /></label><div className="call-result-buttons">{Object.entries(callResults).map(([key,label])=><button className={choice===key?'primary':'quiet'} key={key} disabled={busy || Boolean(pending.current)} onClick={()=>{const result=key as CallResult;setChoice(result);setError('');if(!['callback_requested','not_interested','wrong_number'].includes(result))void submit(result);}}>{label}</button>)}</div>{choice==='callback_requested' && <label>Callback date and time<input type="datetime-local" value={due} disabled={busy || Boolean(pending.current)} onChange={event=>setDue(event.target.value)} /></label>}{choice==='not_interested' && <label>Reason<select value={reason} disabled={busy || Boolean(pending.current)} onChange={event=>setReason(event.target.value)}><option value="">Choose reason</option>{lostReasonOptions.map(value=><option key={value}>{value}</option>)}</select></label>}{choice==='wrong_number' && <p>This removes this number from active calling. The lead and its other contact methods stay in the CRM.</p>}{choice && ['callback_requested','not_interested','wrong_number'].includes(choice) && !pending.current && <button className="primary" disabled={busy} onClick={()=>void submit(choice)}>Save result</button>}{busy && <span role="status">Saving…</span>}{error && <p role="alert">{error}</p>}{pending.current && !busy && error && <button className="primary" onClick={()=>void submit(pending.current!.result)}>Retry same save</button>}<button className="quiet" disabled={busy} onClick={onCancel}>Close</button></div>;
}
