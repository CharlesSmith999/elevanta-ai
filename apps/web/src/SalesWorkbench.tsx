import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { IconCopy, IconPhone, IconMail, IconBrandWhatsapp, IconArrowRight } from '@tabler/icons-react';
import { addRemoteNote, loadRemoteLead, logRemoteSalesActivity, updateRemoteStatus } from './api';
import { currentAssignment, leadCategoryLabels, lostReasonOptions, makeId, statusLabels, validStatusTransition, validWonFinancials, type Lead, type User } from './domain';
import { healthLabel, type LeadContactMethod } from './leadWorkflow';
import { contactLinks, nextWorkbenchId, outreachAllowed, workbenchHistory, workbenchMethods, workbenchOutcomes } from './workbenchModel';
import './salesWorkbench.css';

type Props = {
  leads: Lead[]; viewer: User; session?: Session; connected: boolean; selectedId?: string;
  onSelect: (id: string) => void; onAdvance: (id: string) => void; onDetails: (id: string) => void;
  onSaved: (lead: Lead) => void; onGuard: (dirty: boolean, saving: boolean) => void;
};
const terminal = ['won', 'lost', 'not_interested', 'incorrect', 'duplicate', 'do_not_contact'];
const dateLabel = (value: string) => Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : 'Not available';
const due = (lead: Lead) => Math.min(...lead.followUps.filter(f => f.status === 'open').map(f => Date.parse(f.dueAt)));

function ContactActions({ lead, method, onNotice, disabled = false }: { lead: Lead; method: LeadContactMethod; onNotice: (s: string) => void; disabled?: boolean }) {
  const links = contactLinks(method);
  const allowed = outreachAllowed(lead, method) && !disabled;
  async function copy() {
    try { await navigator.clipboard.writeText(method.value); onNotice('Contact copied.'); }
    catch { onNotice('Copy is unavailable. Select and copy the displayed contact instead.'); }
  }
  return <div className="workbench-contact">
    <span className="workbench-contact-value">{method.value}</span>
    <small className={`health-chip ${method.health}`}>{method.restricted ? 'Do not contact' : healthLabel[method.health]}</small>
    <div className="workbench-contact-actions">
      <button type="button" className="quiet" onClick={() => void copy()} aria-label={`Copy ${method.value}`}><IconCopy size={15} /> Copy</button>
      {allowed && links.call && <a href={links.call} aria-label={`Call ${method.value}`}><IconPhone size={15} /> Call</a>}
      {allowed && links.whatsapp && <a href={links.whatsapp} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${method.value}`}><IconBrandWhatsapp size={15} /> WhatsApp</a>}
      {allowed && links.email && <a href={links.email}><IconMail size={15} /> Email</a>}
    </div>
    {!allowed && <small>Outreach unavailable for this contact or lead.</small>}
    {allowed && links.call && !links.whatsapp && <small>WhatsApp needs a number with an explicit +country code.</small>}
  </div>;
}

export function SalesWorkbench(props: Props) {
  const { viewer, selectedId, onSelect } = props;
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [source, setSource] = useState('all');
  const [queue, setQueue] = useState('all');
  const [page, setPage] = useState(0);
  const [notice, setNotice] = useState('');
  // Scope again here so a selected ID or a role-preview change cannot expose another owner's record.
  const leads = useMemo(() => props.leads.filter(lead => currentAssignment(lead)?.ownerId === viewer.id), [props.leads, viewer.id]);
  const [fallbackId, setFallbackId] = useState(() => leads[0]?.id);
  useEffect(() => { if (!fallbackId && leads[0]) setFallbackId(leads[0].id); }, [leads, fallbackId]);
  const filtered = useMemo(() => leads.filter(lead => {
    const text = [lead.name, lead.source, ...workbenchMethods(lead).map(m => m.value)].join(' ').toLowerCase();
    return text.includes(query.trim().toLowerCase()) && (status === 'all' || lead.status === status)
      && (source === 'all' || lead.source === source)
      && (queue === 'all' || (queue === 'open' && !terminal.includes(lead.status)) || (queue === 'overdue' && due(lead) < Date.now()));
  }).sort((a, b) => due(a) - due(b) || a.name.localeCompare(b.name)), [leads, query, status, source, queue]);
  const lead = leads.find(item => item.id === (selectedId ?? fallbackId));
  const nextId = lead ? nextWorkbenchId(filtered.map(item => item.id), lead.id) : undefined;
  const maxPage = Math.max(0, Math.ceil(filtered.length / 40) - 1);
  const currentPage = Math.min(page, maxPage);
  useEffect(() => setPage(0), [query, status, source, queue]);
  useEffect(() => { if (!lead) props.onGuard(false, false); }, [lead, props.onGuard]);
  return <section className="sales-workbench" aria-label="Sales workbench">
    <header className="workbench-heading"><div><span className="eyebrow">SALES WORKBENCH</span><h2>Contact. Record. Continue.</h2><p>Work your assigned leads from one screen. Contact buttons open your apps; they do not log an activity.</p></div><span>{leads.length} assigned leads</span></header>
    {notice && <p className="workbench-notice" role="status">{notice}</p>}
    <div className="workbench-layout">
      <section className="workbench-queue" aria-label="Assigned lead list">
        <div className="workbench-filters"><label>Search<input aria-label="Search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Name, phone, email, source" /></label><div className="workbench-two"><label>Queue<select aria-label="Queue" value={queue} onChange={e => setQueue(e.target.value)}><option value="all">All assigned</option><option value="open">Open leads</option><option value="overdue">Overdue</option></select></label><label>Status<select aria-label="Status" value={status} onChange={e => setStatus(e.target.value)}><option value="all">All statuses</option>{Object.entries(statusLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label></div><label>Source<select aria-label="Source" value={source} onChange={e => setSource(e.target.value)}><option value="all">All sources</option>{[...new Set(leads.map(l => l.source))].sort().map(s => <option key={s}>{s}</option>)}</select></label><small>{filtered.length} results</small></div>
        <div className="workbench-rows">{filtered.slice(currentPage * 40, (currentPage + 1) * 40).map(item => {
          const methods = workbenchMethods(item);
          const primary = methods.find(m => m.type === 'phone' && outreachAllowed(item, m)) ?? methods.find(m => m.type === 'phone') ?? methods[0];
          return <article key={item.id} className={`workbench-row ${lead?.id === item.id ? 'selected' : ''}`}>
            <button className="workbench-select" aria-pressed={lead?.id === item.id} onClick={() => { if (lead?.id !== item.id) onSelect(item.id); }}><strong>{item.name}</strong><small>{item.source} · {statusLabels[item.status]}</small></button>
            {primary ? <ContactActions lead={item} method={primary} onNotice={setNotice} /> : <small>No verified contact inventory. Open full details to check contacts.</small>}
            {Number.isFinite(due(item)) && <small className={due(item) < Date.now() ? 'warning' : ''}>Next follow-up: {dateLabel(new Date(due(item)).toISOString())}</small>}
          </article>;
        })}{!filtered.length && <p className="empty">No leads match these filters.</p>}</div>
        <div className="workbench-pagination"><button className="quiet" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous page</button><small>{currentPage + 1} / {maxPage + 1}</small><button className="quiet" disabled={currentPage === maxPage} onClick={() => setPage(currentPage + 1)}>Next page</button></div>
      </section>
      {lead ? <WorkPanel key={`${viewer.id}:${lead.id}`} {...props} lead={lead} nextId={nextId} hiddenByFilter={!filtered.some(item => item.id === lead.id)} /> : <section className="workbench-panel"><h3>Select an assigned lead</h3><p>Contact details and updates will appear here. A lead reassigned to someone else will no longer be available.</p></section>}
    </div>
  </section>;
}

function WorkPanel({ lead, viewer, session, connected, nextId, hiddenByFilter, onSaved, onGuard, onAdvance, onDetails }: Props & { lead: Lead; nextId?: string; hiddenByFilter: boolean }) {
  const initialProgress = () => ({ status: lead.status, qualification: lead.qualification, reason: lead.lostReason ?? '', total: String(lead.totalProjectCost ?? ''), upfront: String(lead.upfrontPaymentAmount ?? '') });
  const [progress, setProgress] = useState(initialProgress);
  const [baseline, setBaseline] = useState(initialProgress);
  const [methodId, setMethodId] = useState('');
  const [type, setType] = useState('call');
  const [outcome, setOutcome] = useState('');
  const [note, setNote] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [followAction, setFollowAction] = useState('Call');
  const [followPurpose, setFollowPurpose] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [notice, setNotice] = useState('');
  const [refreshFailed, setRefreshFailed] = useState(false);
  const methods = workbenchMethods(lead);
  const usable = methods.filter(m => outreachAllowed(lead, m));
  const method = usable.find(m => m.id === methodId) ?? (!methodId ? usable[0] : undefined);
  const progressDirty = JSON.stringify(progress) !== JSON.stringify(baseline);
  const activityDirty = Boolean(outcome || note || followUp || followPurpose);
  const writable = (!session || (connected && session.user.id === viewer.id)) && currentAssignment(lead)?.ownerId === viewer.id && !lead.routingPaused;
  const dirty = progressDirty || activityDirty;
  const history = workbenchHistory(lead, viewer);
  useEffect(() => { onGuard(dirty, saving); return () => onGuard(false, false); }, [dirty, saving, onGuard]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty || saving) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, saving]);
  // Polling must not overwrite an agent's draft. Clean progress controls follow saved data.
  useEffect(() => {
    if (!progressDirty) { const next = initialProgress(); setProgress(next); setBaseline(next); }
  }, [lead.status, lead.qualification, lead.lostReason, lead.totalProjectCost, lead.upfrontPaymentAmount]);

  async function refresh(fallback?: Lead) {
    try { const saved = session ? await loadRemoteLead(session, lead.id) : fallback ?? lead; onSaved(saved); setRefreshFailed(false); return saved; }
    catch { setRefreshFailed(true); setNotice('Your save succeeded, but the refreshed record could not load. Refresh this lead before doing more work.'); return undefined; }
  }
  function begin() { if (savingRef.current || !writable || refreshFailed) return false; savingRef.current = true; setSaving(true); setNotice(''); return true; }
  function end() { savingRef.current = false; setSaving(false); }

  async function saveProgress(event: FormEvent) {
    event.preventDefault();
    if (!progressDirty || !begin()) return;
    try {
      if (lead.status !== progress.status && !validStatusTransition(lead.status, progress.status)) throw new Error('This status transition is not allowed.');
      if (progress.status === 'won' && (progress.total === '' || progress.upfront === '' || !validWonFinancials(Number(progress.total), Number(progress.upfront)))) throw new Error('Enter total and upfront amounts. Upfront cannot exceed the total.');
      if (['lost', 'not_interested'].includes(progress.status) && !progress.reason) throw new Error('Select a loss reason.');
      const body = { status: progress.status, ...(progress.qualification !== lead.qualification ? { qualification: progress.qualification } : {}), ...(progress.status === 'won' ? { totalProjectCost: Number(progress.total), upfrontPaymentAmount: Number(progress.upfront) } : {}), ...(['lost', 'not_interested'].includes(progress.status) ? { lostReason: progress.reason } : {}) };
      if (session) await updateRemoteStatus(session, lead.id, body);
      setBaseline(progress);
      const updated = await refresh({ ...lead, status: progress.status, qualification: progress.qualification, lostReason: progress.reason as Lead['lostReason'], ...(progress.status === 'won' ? { totalProjectCost: Number(progress.total), upfrontPaymentAmount: Number(progress.upfront) } : {}) });
      if (updated) setNotice('Progress saved.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Progress could not be saved. Your draft is kept.'); }
    finally { end(); }
  }

  async function saveActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activityDirty || !begin()) return;
    const advance = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'next';
    try {
      if (advance && progressDirty) throw new Error('Save or discard the progress changes before Save and Next.');
      const noteOnly = type === 'note';
      if (noteOnly && !note.trim()) throw new Error('Enter a note before saving.');
      if (!noteOnly && (!method || !outcome)) throw new Error('Choose an available contact and an outcome.');
      if (!noteOnly && ((type === 'email' && method?.type !== 'email') || (['call', 'sms'].includes(type) && method?.type !== 'phone'))) throw new Error('Choose a contact method that matches the activity.');
      if (followUp && (!Number.isFinite(Date.parse(followUp)) || Date.parse(followUp) <= Date.now())) throw new Error('Choose a future follow-up date and time.');
      const at = new Date().toISOString();
      if (session) {
        if (noteOnly) await addRemoteNote(session, lead.id, { body: note.trim() });
        else await logRemoteSalesActivity(session, lead.id, { contactMethodId: method!.id, type, outcome, body: note.trim() || undefined, followUpAt: followUp ? new Date(followUp).toISOString() : undefined, followUpAction: followUp ? followAction : undefined, followUpPurpose: followUp ? followPurpose || undefined : undefined });
      }
      const savedNote = note;
      const savedFollow = followUp;
      // Clear immediately after a confirmed write, so a read failure cannot resubmit the activity.
      setOutcome(''); setNote(''); setFollowUp(''); setFollowPurpose('');
      const connectedOutcome = !noteOnly && ['connected', 'replied', 'meeting_booked'].includes(outcome) && ['new', 'assigned', 'contacted', 'follow_up_required'].includes(lead.status);
      const updated = await refresh({ ...lead, status: connectedOutcome ? 'connected' : lead.status, activities: [...lead.activities, { id: makeId('activity'), at, actorId: viewer.id, kind: noteOnly ? 'note' : 'system', body: noteOnly ? savedNote : `${type}: ${outcome}${savedNote ? ` · ${savedNote}` : ''}` }], followUps: [...lead.followUps, ...(!noteOnly && savedFollow ? [{ id: makeId('followup'), ownerId: viewer.id, dueAt: new Date(savedFollow).toISOString(), action: followAction as 'Call' | 'Email' | 'SMS' | 'Task', status: 'open' as const }] : [])] });
      if (updated) {
        setNotice(noteOnly ? 'Note saved.' : 'Activity and any scheduled follow-up saved.');
        if (advance && nextId) { onGuard(false, false); onAdvance(nextId); }
      }
    } catch (error) { setNotice(`${error instanceof Error ? error.message : 'Save could not be confirmed.'} Your draft is kept. If the connection dropped, check history before retrying.`); }
    finally { end(); }
  }

  return <section className="workbench-panel" aria-label={`Work on ${lead.name}`} aria-busy={saving}>
    <header className="workbench-panel-head"><div><span className="eyebrow">CURRENT LEAD</span><h2>{lead.name}</h2><p>{lead.source} · {leadCategoryLabels[lead.category ?? 'not_available']} · {statusLabels[lead.status]} · {lead.qualification.toUpperCase().replace('_', ' ')}</p></div><button className="quiet" disabled={saving} onClick={() => onDetails(lead.id)}>Full details</button></header>
    {hiddenByFilter && <p className="workbench-notice">This lead is outside your current filters. It stays open so your work is not lost.</p>}
    {!writable && <p className="workbench-notice">{lead.routingPaused ? 'Routing is paused for Admin review.' : 'Read-only view. Sign in as the assigned agent to save sales activity.'}</p>}
    {notice && <p role="status" className="workbench-notice">{notice}</p>}
    {refreshFailed && <button className="quiet" onClick={() => void refresh()}>Refresh saved lead</button>}
    <section className="workbench-section"><h3>Contact details</h3><div className="workbench-methods">{methods.map(m => <ContactActions key={m.id} lead={lead} method={m} onNotice={setNotice} disabled={saving} />)}{!methods.length && <p>No contact methods loaded. You can save a note or use Full details to check the lead.</p>}</div></section>
    {(lead.description || lead.researchSummary) && <details className="workbench-section"><summary>Project and Marketing handoff</summary><p>{lead.description}</p><p>{lead.researchSummary}</p></details>}
    <form className="workbench-section" onSubmit={saveProgress} aria-label="Lead progress">
      <h3>Lead progress</h3><fieldset disabled={!writable || saving || refreshFailed || terminal.includes(lead.status)}><div className="workbench-two"><label>Status<select aria-label="Status" value={progress.status} onChange={e => setProgress({ ...progress, status: e.target.value as Lead['status'] })}>{Object.entries(statusLabels).filter(([value]) => value === lead.status || !['new', 'incorrect', 'duplicate', 'do_not_contact'].includes(value)).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Qualification<select aria-label="Qualification" value={progress.qualification} onChange={e => setProgress({ ...progress, qualification: e.target.value as Lead['qualification'] })}>{lead.qualification === 'mql' && <option value="mql">MQL (set by Marketing)</option>}<option value="not_available">Not available</option><option value="sql">SQL</option></select></label></div>
      {['lost', 'not_interested'].includes(progress.status) && <label>Loss reason<select aria-label="Loss reason" required value={progress.reason} onChange={e => setProgress({ ...progress, reason: e.target.value })}><option value="">Choose reason</option>{lostReasonOptions.map(reason => <option key={reason}>{reason}</option>)}</select></label>}
      {progress.status === 'won' && <div className="workbench-two"><label>Total project cost<input aria-label="Total project cost" type="number" min="0" step="0.01" required value={progress.total} onChange={e => setProgress({ ...progress, total: e.target.value })} /></label><label>Upfront payment<input aria-label="Upfront payment" type="number" min="0" step="0.01" required value={progress.upfront} onChange={e => setProgress({ ...progress, upfront: e.target.value })} /></label></div>}
      <div className="workbench-buttons"><button className="quiet" disabled={!progressDirty}>Save progress</button>{progressDirty && <button className="quiet" type="button" onClick={() => setProgress(baseline)}>Discard progress changes</button>}</div></fieldset>
      {terminal.includes(lead.status) && <small>Closed or restricted status. Contact your manager for a correction.</small>}
    </form>
    <form className="workbench-section" onSubmit={saveActivity} aria-label="Record activity">
      <h3>Record the outcome</h3><fieldset disabled={!writable || saving || refreshFailed}><div className="workbench-two"><label>Activity<select aria-label="Activity" value={type} onChange={e => { setType(e.target.value); setOutcome(''); if (e.target.value === 'note') { setFollowUp(''); setFollowPurpose(''); } }}><option value="call">Call</option><option value="sms">SMS</option><option value="email">Email</option><option value="meeting">Meeting</option><option value="note">Note only</option></select></label>{type !== 'note' && <label>Contact method<select aria-label="Contact method" value={method?.id ?? ''} onChange={e => setMethodId(e.target.value)} required><option value="" disabled>Select contact</option>{usable.map(m => <option key={m.id} value={m.id}>{m.value}</option>)}</select></label>}</div>
      {type !== 'note' && <label>Outcome<select aria-label="Outcome" required value={outcome} onChange={e => setOutcome(e.target.value)}><option value="" disabled>What happened?</option>{workbenchOutcomes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
      <label>Notes<textarea aria-label="Notes" rows={3} maxLength={3000} value={note} onChange={e => setNote(e.target.value)} required={type === 'note'} placeholder="Useful context for the next conversation" /></label>
      {type !== 'note' && <><div className="workbench-two"><label>Next follow-up (optional)<input aria-label="Next follow-up (optional)" type="datetime-local" value={followUp} onChange={e => setFollowUp(e.target.value)} /></label>{followUp && <label>Next action<select aria-label="Next action" value={followAction} onChange={e => setFollowAction(e.target.value)}><option>Call</option><option>Email</option><option>SMS</option><option>Task</option></select></label>}</div>{followUp && <label>Follow-up purpose<input aria-label="Follow-up purpose" maxLength={1000} value={followPurpose} onChange={e => setFollowPurpose(e.target.value)} /></label>}</>}
      {progressDirty && <p className="hint">Save or discard your progress changes before moving to the next lead.</p>}
      <div className="workbench-buttons"><button className="quiet" disabled={!activityDirty} value="stay">{saving ? 'Saving…' : type === 'note' ? 'Save note' : 'Save activity'}</button><button className="primary" disabled={!activityDirty || progressDirty || !nextId} value="next">Save and Next <IconArrowRight size={16} /></button></div>
      {!nextId && <small>Last lead in the current results. Save here or select another lead.</small>}</fieldset>
    </form>
    <section className="workbench-section"><h3>Upcoming follow-ups</h3>{lead.followUps.filter(f => f.status === 'open').map(f => <p key={f.id}>{f.action} · {dateLabel(f.dueAt)}</p>)}{!lead.followUps.some(f => f.status === 'open') && <p>No open follow-ups.</p>}</section>
    <details className="workbench-section"><summary>Recent activity ({history.length})</summary>{history.slice(0, 20).map(item => <article key={item.id}><small>{dateLabel(item.at)}</small><p>{item.body}</p></article>)}{!history.length && <p>No activity is visible in this assignment.</p>}</details>
  </section>;
}
