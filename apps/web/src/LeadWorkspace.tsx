import { FormEvent, useEffect, useMemo, useState } from 'react';
import { IconArrowLeft, IconAt, IconCheck, IconChevronDown, IconCircleCheck, IconClock, IconMail, IconMessage, IconPhone, IconPlus, IconRefresh, IconUser, IconX } from '@tabler/icons-react';
import type { Lead, Role, User } from './domain';
import { canRestore, focusForHealth, healthLabel, type ContactHealth, type LeadContactMethod } from './leadWorkflow';
import type { Session } from '@supabase/supabase-js';
import { addRemoteContactMethod, assessRemoteContactMethod, loadRemoteActivityHistory, loadRemoteContactMethods, logRemoteSalesActivity, restoreRemoteContactMethod } from './api';

const healthOptions: ContactHealth[] = ['verified', 'incorrect', 'wrong_person', 'reception_gatekeeper', 'do_not_contact'];
const firstMethods = (lead: Lead): LeadContactMethod[] => [
  ...(lead.phone ? [{ id: `${lead.id}-phone`, type: 'phone' as const, value: lead.phone, health: 'unverified' as const, focus: 'active' as const }] : []),
  ...(lead.email ? [{ id: `${lead.id}-email`, type: 'email' as const, value: lead.email, health: 'unverified' as const, focus: 'active' as const }] : []),
];

function actionIcon(type: string) { return type === 'email' ? <IconMail size={16} /> : type === 'sms' ? <IconMessage size={16} /> : <IconPhone size={16} />; }
function format(value: string) { return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value)); }
function hasMarketingControl(role: Role) { return role === 'marketer' || role === 'manager' || role === 'admin'; }
function isRemoteId(id: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id); }

export function LeadWorkspace({ lead, viewer, session, onBack, onStatus, onQualification, onReassign }: { lead: Lead; viewer: User; session?: Session; onBack: () => void; onStatus: (lead: Lead, status: Lead['status']) => void; onQualification: (lead: Lead, qualification: Lead['qualification']) => void; onReassign: (lead: Lead, event: FormEvent<HTMLFormElement>) => void; }) {
  const [methods, setMethods] = useState<LeadContactMethod[]>(() => firstMethods(lead));
  const [tab, setTab] = useState<'overview' | 'history'>('overview');
  const [activityOpen, setActivityOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [history, setHistory] = useState<Array<{ id: string; at: string; type: string; outcome: string; method?: string; note?: string }>>([]);
  const active = methods.filter((method) => method.focus === 'active');
  const secondary = methods.filter((method) => method.focus === 'secondary');
  const removed = methods.filter((method) => method.focus === 'removed');
  const sales = viewer.role === 'sales_agent';
  const canManage = sales || hasMarketingControl(viewer.role);
  const canCorrectQualification = viewer.role === 'manager' || viewer.role === 'admin';

  useEffect(() => { setMethods(firstMethods(lead)); setHistory([]); }, [lead.id]);
  useEffect(() => {
    if (!session) return;
    let alive = true;
    void Promise.all([loadRemoteContactMethods(session, lead.id), loadRemoteActivityHistory(session, lead.id)]).then(([methodResult, historyResult]) => {
      if (!alive) return;
      const remoteMethods = methodResult.contactMethods.flatMap((item) => {
        const method = item.contact_methods;
        return method ? [{ id: method.id, type: method.method_type, value: method.value, label: method.label ?? undefined, health: item.health, focus: item.focus, reason: item.assessment_reason ?? undefined, restricted: Boolean(method.globally_restricted), lastAttemptAt: item.last_assessed_at ?? undefined }] : [];
      });
      if (remoteMethods.length) setMethods(remoteMethods);
      setHistory(historyResult.activities.map((item) => ({ id: item.id, at: item.occurred_at ?? item.created_at, type: item.type, outcome: item.outcome ?? 'recorded', method: item.contact_methods?.value, note: item.body ?? undefined })));
    }).catch((error: unknown) => { if (alive) setNotice(error instanceof Error ? `CRM data could not load: ${error.message}` : 'CRM data could not load.'); });
    return () => { alive = false; };
  }, [session, lead.id]);

  function assess(method: LeadContactMethod, health: ContactHealth) {
    if (!canManage) return;
    const focus = focusForHealth(health);
    setMethods((items) => items.map((item) => item.id === method.id ? { ...item, health, focus, restricted: health === 'do_not_contact' } : item));
    if (session && isRemoteId(method.id)) void assessRemoteContactMethod(session, lead.id, method.id, { health }).catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'CRM could not update this contact method.'));
    setNotice(focus === 'removed' ? `${method.value} was moved out of your active focus.` : `${method.value} was updated.`);
  }
  function restore(method: LeadContactMethod) {
    if (!canRestore(method, viewer.role)) return setNotice('This method can be restored only by Lead Gen, Manager, or Admin.');
    setMethods((items) => items.map((item) => item.id === method.id ? { ...item, health: 'unverified', focus: 'active', restricted: false } : item));
    if (session && isRemoteId(method.id)) void restoreRemoteContactMethod(session, lead.id, method.id, { reason: 'Restored for reassignment or renewed outreach.' }).catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'CRM could not restore this contact method.'));
    setNotice(`${method.value} was restored to active contact methods.`);
  }
  function addContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); const type = String(data.get('type')) as 'phone' | 'email'; const value = String(data.get('value') ?? '').trim();
    if (!value) return; if (methods.some((method) => method.value.toLowerCase() === value.toLowerCase())) return setNotice('This contact method is already listed.');
    setMethods((items) => [...items, { id: `${lead.id}-${Date.now()}`, type, value, label: String(data.get('label') ?? '').trim() || undefined, health: 'unverified', focus: 'active' }]);
    if (session) void addRemoteContactMethod(session, lead.id, { methodType: type, value, label: String(data.get('label') ?? '').trim() || undefined }).then((result) => {
      setMethods((items) => items.map((item) => item.value === value && item.type === type ? { ...item, id: result.contactMethodId } : item));
    }).catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'CRM could not add this contact method.'));
    event.currentTarget.reset(); setContactOpen(false); setNotice('Contact method added. It starts as Unverified.');
  }
  function logActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); const methodId = String(data.get('method') ?? ''); const outcome = String(data.get('outcome') ?? 'other'); const type = String(data.get('type') ?? 'call'); const note = String(data.get('note') ?? '').trim(); const method = methods.find((item) => item.id === methodId);
    if (!method) return setNotice('Choose a contact method first.');
    const at = new Date().toISOString();
    setHistory((items) => [{ id: `${Date.now()}`, at, type, outcome, method: method.value, note: note || undefined }, ...items]);
    setMethods((items) => items.map((item) => item.id === method.id ? { ...item, lastAttemptAt: at, lastOutcome: outcome } : item));
    if (session && isRemoteId(method.id)) void logRemoteSalesActivity(session, lead.id, { contactMethodId: method.id, type, outcome, body: note || undefined }).catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'CRM could not save this activity.'));
    if (outcome === 'connected' || outcome === 'replied' || outcome === 'meeting_booked') onStatus(lead, 'connected');
    setActivityOpen(false); setNotice('Activity logged. Your history and follow-up context are updated.');
  }

  return <section className="lead-workspace">
    <header className="lead-workspace-head"><button className="quiet icon-label" onClick={onBack}><IconArrowLeft size={17} /> Lead inbox</button><div><span className="eyebrow">LEAD WORKSPACE</span><h1>{lead.name}</h1><p>{lead.source} · Assigned to {lead.assignments.find((assignment) => !assignment.endedAt)?.ownerId ?? 'Unassigned'}</p></div><span className={`status ${lead.status}`}>{lead.status.replaceAll('_', ' ')}</span></header>
    {notice && <div className="workflow-notice"><IconCircleCheck size={18} />{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><IconX size={15} /></button></div>}
    <nav className="lead-workspace-tabs"><button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>Overview</button><button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>Activity history <small>{history.length}</small></button></nav>
    {tab === 'history' ? <ActivityHistory history={history} onBack={() => setTab('overview')} /> : <>
      <div className="lead-workspace-grid">
        <section className="workflow-card contact-summary"><div className="workflow-heading"><div><span className="eyebrow">CONTACT DETAILS</span><h2>Work the methods that remain</h2><p>Mark a number or email anytime. Removed methods stay in history and are never deleted.</p></div>{canManage && <button className="primary" onClick={() => setContactOpen(true)}><IconPlus size={17} /> Add contact</button>}</div>
          <MethodGroup title="Active contact methods" methods={active} sales={sales} canManage={canManage} onAssess={assess} onLog={() => setActivityOpen(true)} />
          {secondary.length > 0 && <MethodGroup title="Secondary methods" methods={secondary} sales={sales} canManage={canManage} onAssess={assess} onLog={() => setActivityOpen(true)} />}
          <details className="removed-methods"><summary>Removed from active focus ({removed.length}) <small>Incorrect, wrong person, or do-not-contact methods remain auditable.</small></summary>{removed.map((method) => <div className="removed-method" key={method.id}><span>{method.type === 'phone' ? <IconPhone size={16} /> : <IconMail size={16} />}</span><div><b>{method.value}</b><small>{healthLabel[method.health]}{method.restricted ? ' · Globally restricted' : ''}</small></div>{canRestore(method, viewer.role) && <button className="quiet" onClick={() => restore(method)}><IconRefresh size={15} /> Restore</button>}</div>)}</details>
        </section>
        <aside className="workflow-card action-rail"><span className="eyebrow">NEXT ACTION</span><h2>{lead.followUps.find((item) => item.status === 'open') ? 'Follow-up due' : 'Choose the next step'}</h2><p>{lead.followUps.find((item) => item.status === 'open') ? 'A scheduled follow-up is waiting in your task list.' : 'Log the first contact attempt, then set a focused follow-up.'}</p><button className="primary full" disabled={!sales || !active.length} onClick={() => setActivityOpen(true)}>{actionIcon(active.find((method) => method.type === 'phone') ? 'call' : 'email')} Log activity</button>
          <div className="lead-stage-control"><label>Sales lifecycle</label><select value={lead.status} disabled={!sales} onChange={(event) => onStatus(lead, event.target.value as Lead['status'])}><option value="assigned">Assigned</option><option value="contacted">Contacted</option><option value="connected">Connected</option><option value="follow_up_required">Follow-up required</option><option value="qualified">Qualified</option><option value="proposal_sent">Proposal sent</option><option value="won">Won</option><option value="lost">Lost</option></select></div>
          <div className="lead-stage-control"><label>Qualification</label><select value={lead.qualification} disabled={!sales && !hasMarketingControl(viewer.role)} onChange={(event) => onQualification(lead, event.target.value as Lead['qualification'])}>{canCorrectQualification ? <><option value="not_available">Not available</option><option value="mql">MQL</option><option value="sql">SQL</option></> : sales ? <><option value="not_available">Not available</option><option value="sql">SQL</option></> : <><option value="not_available">Not available</option><option value="mql">MQL</option></>}</select></div>
        </aside>
      </div>
      {hasMarketingControl(viewer.role) && <section className="workflow-card leadgen-panel"><div><span className="eyebrow">LEAD GEN CONTROL</span><h2>Monitor quality and reassign with context</h2><p>Lead Gen can see every contact method and Sales progress, but cannot create Sales activities or set SQL.</p></div><div className="leadgen-actions"><span><IconCheck size={16} /> {active.length} active</span><span><IconClock size={16} /> {secondary.length} secondary</span><span><IconUser size={16} /> {removed.length} removed</span></div><details><summary>Reassign lead</summary><form className="reassign-mini" onSubmit={(event) => onReassign(lead, event)}><select name="owner" defaultValue=""><option value="" disabled>Choose sales agent</option><option value="mustabeen">Mustabeen</option><option value="asad">Asad</option><option value="obaid">Obaid</option><option value="owais">Owais</option></select><select name="visibility" defaultValue="full_context"><option value="full_context">Share full context</option><option value="fresh_start">Fresh working view</option></select><input name="reason" placeholder="Reason for handoff" required /><button className="primary">Reassign</button></form><p className="hint">A fresh working view hides conversations only. It never restores removed or restricted contact methods.</p></details></section>}
    </>}
    {activityOpen && <ActivityDrawer methods={[...active, ...secondary]} onClose={() => setActivityOpen(false)} onSubmit={logActivity} />}
    {contactOpen && <ContactModal onClose={() => setContactOpen(false)} onSubmit={addContact} />}
  </section>;
}

function MethodGroup({ title, methods, sales, canManage, onAssess, onLog }: { title: string; methods: LeadContactMethod[]; sales: boolean; canManage: boolean; onAssess: (method: LeadContactMethod, health: ContactHealth) => void; onLog: () => void }) { return <div className="method-group"><h3>{title}</h3>{methods.length ? methods.map((method) => <article className="method-row" key={method.id}><span className={`method-icon ${method.type}`}>{method.type === 'phone' ? <IconPhone size={19} /> : <IconAt size={19} />}</span><div className="method-main"><b>{method.value}</b><small>{method.label ?? healthLabel[method.health]}{method.lastOutcome ? ` · Last: ${method.lastOutcome}` : ''}</small></div><span className={`health-chip ${method.health}`}>{healthLabel[method.health]}</span>{sales && <button className="quiet method-log" onClick={onLog}>{actionIcon(method.type === 'phone' ? 'call' : 'email')} Log</button>}{canManage && <label className="method-assess"><span className="sr-only">Update method health</span><select value={method.health} onChange={(event) => onAssess(method, event.target.value as ContactHealth)}><option value="unverified">Mark method</option>{healthOptions.map((health) => <option key={health} value={health}>{healthLabel[health]}</option>)}</select><IconChevronDown size={14} /></label>}</article>) : <p className="empty">No methods in this group.</p>}</div>; }
function ActivityDrawer({ methods, onClose, onSubmit }: { methods: LeadContactMethod[]; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) { return <div className="workflow-modal-backdrop" role="presentation"><section className="workflow-drawer" role="dialog" aria-modal="true" aria-label="Log sales activity"><header><div><span className="eyebrow">SALES ACTIVITY</span><h2>Log what happened</h2><p>One quick entry keeps the lead history useful for you, your manager, and Xaviar.</p></div><button className="quiet" onClick={onClose} aria-label="Close"><IconX /></button></header><form onSubmit={onSubmit}><label>Contact method<select name="method" required>{methods.map((method) => <option value={method.id} key={method.id}>{method.type === 'phone' ? 'Phone' : 'Email'} · {method.value}</option>)}</select></label><div className="two-fields"><label>Activity<select name="type"><option value="call">Call</option><option value="sms">SMS</option><option value="email">Email</option><option value="meeting">Meeting</option></select></label><label>Outcome<select name="outcome"><option value="connected">Connected</option><option value="no_answer">No answer</option><option value="voicemail">Voicemail</option><option value="busy">Busy</option><option value="callback_requested">Callback requested</option><option value="email_sent">Email sent</option><option value="replied">Replied</option><option value="meeting_booked">Meeting booked</option><option value="not_interested">Not interested</option><option value="other">Other</option></select></label></div><label>Notes<textarea name="note" rows={4} placeholder="What happened? Keep it short and useful for the next follow-up." /></label><div className="drawer-actions"><button type="button" className="quiet" onClick={onClose}>Cancel</button><button className="primary">Save activity</button></div></form></section></div>; }
function ContactModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) { return <div className="workflow-modal-backdrop"><section className="workflow-modal" role="dialog" aria-modal="true" aria-label="Add a contact method"><header><div><span className="eyebrow">CONTACT DETAILS</span><h2>Add a phone or email</h2></div><button className="quiet" onClick={onClose} aria-label="Close"><IconX /></button></header><form onSubmit={onSubmit}><label>Type<select name="type"><option value="phone">Phone number</option><option value="email">Email address</option></select></label><label>Value<input name="value" placeholder="Phone number or email" required /></label><label>Label <input name="label" placeholder="Optional, for example Direct line" /></label><div className="drawer-actions"><button type="button" className="quiet" onClick={onClose}>Cancel</button><button className="primary">Add contact</button></div></form></section></div>; }
function ActivityHistory({ history, onBack }: { history: Array<{ id: string; at: string; type: string; outcome: string; method?: string; note?: string }>; onBack: () => void }) { return <section className="workflow-card activity-history"><div className="workflow-heading"><div><span className="eyebrow">FULL HISTORY</span><h2>Every activity, in order</h2><p>Use this when you need context. The Overview stays focused on the work to do now.</p></div><button className="quiet" onClick={onBack}>Back to overview</button></div>{history.length ? <ol>{history.map((item) => <li key={item.id}><span>{actionIcon(item.type)}</span><div><b>{item.type} · {item.outcome.replaceAll('_', ' ')}</b><p>{item.method}{item.note ? ` · ${item.note}` : ''}</p></div><time>{format(item.at)}</time></li>)}</ol> : <p className="empty">No activities have been logged for this lead yet.</p>}</section>; }
