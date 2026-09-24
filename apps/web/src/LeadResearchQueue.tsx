import { FormEvent, useEffect, useMemo, useState } from 'react';
import { GmailConnection } from './GmailConnection';
import { researchRefresh } from './researchRefresh';
import { IconArrowLeft, IconCircleCheck, IconExternalLink, IconMail, IconPhone, IconSearch, IconSend, IconShieldLock, IconTrash } from '@tabler/icons-react';
import type { Session } from '@supabase/supabase-js';
import type { LeadCategory, User } from './domain';
import { leadCategoryLabels, leadCategoryOptions } from './domain';
import { loadResearchLeads, publishResearchLead, updateResearchLead } from './api';
import { researchAlertRefreshEvent } from './LeadAlertController';
import { canViewResearchLead, isReadyForSales, researchStateLabels, researchStates, seedResearchLeads, validResearchMethod, researchMethodKey, validEvidenceUrl, type ResearchLead, type ResearchMethod, type ResearchState } from './inboundResearch';

export function LeadResearchQueue({ viewer, users, session, onPublished, onNotice }: { viewer: User; users: User[]; session?: Session; onPublished: (lead: ResearchLead, salesOwnerId: string) => Promise<void> | void; onNotice: (message: string) => void }) {
  const [items, setItems] = useState<ResearchLead[]>(() => session ? [] : structuredClone(seedResearchLeads));
  const [selectedId, setSelectedId] = useState<string>();
  const [loading, setLoading] = useState(Boolean(session));
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | ResearchState>('all');
  const [saving, setSaving] = useState(false);
  const selected = items.find((item) => item.id === selectedId && canViewResearchLead(viewer, item, users));
  const visible = useMemo(() => items.filter((item) => canViewResearchLead(viewer, item, users) && (filter === 'all' || item.state === filter)), [items, viewer, users, filter]);

  useEffect(() => {
    if (!session) { setLoading(false); return; }
    if (selectedId || saving) return;
    setLoading(true); setError('');
    return researchRefresh({
      load: () => loadResearchLeads(session),
      apply: records => { setItems(records); setError(''); },
      fail: reason => setError(reason instanceof Error ? reason.message : 'Research leads could not be loaded.'),
      settled: () => setLoading(false),
      schedule: (tick, ms) => { const timer = window.setInterval(tick, ms); return () => window.clearInterval(timer); },
    });
  }, [session, selectedId, saving]);

  useEffect(() => {
    if (!session || selectedId || saving) return;
    let active = true;
    const refresh = () => {
      void loadResearchLeads(session).then((records) => { if (active) { setItems(records); setError(''); } })
        .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Research leads could not be loaded.'); });
    };
    window.addEventListener(researchAlertRefreshEvent, refresh);
    return () => { active = false; window.removeEventListener(researchAlertRefreshEvent, refresh); };
  }, [session, selectedId, saving]);

  async function save(next: ResearchLead) {
    if (next.state === 'ready_for_sales' && !isReadyForSales(next)) {
      setError('Ready for Sales requires a name, a valid unmasked phone or email, and no confirmed duplicate.');
      return;
    }
    if (!next.name.trim() || next.methods.some((method) => !validResearchMethod(method)) || next.evidenceLinks.some((link) => !validEvidenceUrl(link))) return setError('Check the name, contact details, and evidence links.');
    if (new Set(next.methods.map(researchMethodKey)).size !== next.methods.length) return setError('This contact method is already listed.');
    if (saving) return;
    setSaving(true); setError('');
    try {
      if (session) await updateResearchLead(session, next.id, { expectedRevision: next.revision ?? 0, state: next.state, name: next.name, category: next.category, methods: next.methods, evidenceLinks: next.evidenceLinks, researchNotes: next.researchNotes, duplicateState: next.duplicateState });
      setItems((current) => current.map((item) => item.id === next.id ? { ...next, revision: (next.revision ?? 0) + 1, marketingOwnerId: viewer.role === 'marketer' ? viewer.id : next.marketingOwnerId } : item));
      onNotice('Research progress saved.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Research progress could not be saved.'); }
    finally { setSaving(false); }
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving) return; if (!selected || selected.state !== 'ready_for_sales' || !isReadyForSales(selected)) return setError('Add a usable unmasked phone or email and clear confirmed duplicates before sending to Sales.');
    const salesOwnerId = String(new FormData(event.currentTarget).get('salesOwnerId') ?? '');
    if (!users.some((user) => user.id === salesOwnerId && user.role === 'sales_agent')) return setError('Choose an active Sales Agent.');
    setSaving(true); setError('');
    try {
      if (session) await publishResearchLead(session, selected.id, { salesOwnerId, expectedRevision: selected.revision ?? 0 });
      setItems((current) => current.map((item) => item.id === selected.id ? { ...item, state: 'sent_to_sales' } : item));
      await onPublished({ ...selected, marketingOwnerId: viewer.role === 'marketer' ? viewer.id : selected.marketingOwnerId }, salesOwnerId); onNotice('Lead sent to Sales and added to the normal Lead Inbox.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'The lead could not be sent to Sales.'); }
    finally { setSaving(false); }
  }

  if (viewer.role === 'sales_agent' || (viewer.role === 'manager' && viewer.department !== 'marketing')) return <section className="research-empty"><IconShieldLock size={34} /><h2>Marketing workspace only</h2><p>Raw and masked research leads are never visible to Sales roles.</p></section>;
  if (selected) return <ResearchWorkspace lead={selected} salesAgents={users.filter((user) => user.role === 'sales_agent')} saving={saving} error={error} onBack={() => setSelectedId(undefined)} onSave={save} onPublish={publish} />;

  const counts = Object.fromEntries(researchStates.map((state) => [state, items.filter((item) => canViewResearchLead(viewer, item, users) && item.state === state).length]));
  return <section className="research-page">
    {viewer.role === 'admin' && session && <GmailConnection session={session} />}
    <header className="research-hero"><div><span className="eyebrow">MARKETING / INBOUND RESEARCH</span><h2>Lead Research Queue</h2><p>Shared Marketing queue. Anyone in Marketing can add details and send a ready lead to Sales. No claim step is required.</p></div><div className="research-connection"><IconMail size={20} /><span><b>{session ? 'Shared CRM research' : 'Demo research'}</b><small>{session ? 'List refreshes every minute; open drafts stay unchanged' : 'Safe test data only'}</small></span></div></header>
    <div className="research-metrics"><article><strong>{visible.length}</strong><span>Visible items</span></article><article><strong>{counts.researching ?? 0}</strong><span>Researching</span></article><article><strong>{(counts.found ?? 0) + (counts.connected ?? 0)}</strong><span>Information found</span></article><article><strong>{counts.ready_for_sales ?? 0}</strong><span>Ready for Sales</span></article></div>
    <div className="research-toolbar"><label>Status<select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="all">All research states</option>{researchStates.map((state) => <option key={state} value={state}>{researchStateLabels[state]}</option>)}</select></label><span>{visible.length} result{visible.length === 1 ? '' : 's'}</span></div>
    {error && <p className="warning" role="alert">{error}</p>}{loading ? <p className="research-loading">Loading research queue…</p> : <div className="research-list"><div className="research-row research-head"><span>Lead</span><span>Category</span><span>Research state</span><span>Contact readiness</span><span>Received</span></div>{visible.map((lead) => <button key={lead.id} className="research-row" onClick={() => setSelectedId(lead.id)}><span><b>{lead.name}</b><small>{lead.maskedEmail ?? lead.maskedPhone ?? 'Masked contact unavailable'}</small></span><span>{leadCategoryLabels[lead.category]}</span><span><i className={`research-status ${lead.state}`}>{researchStateLabels[lead.state]}</i></span><span className={isReadyForSales(lead) ? 'research-ready' : ''}>{isReadyForSales(lead) ? 'Usable contact found' : 'Research required'}</span><span>{new Date(lead.receivedAt).toLocaleString()}</span></button>)}{!visible.length && <p className="research-loading">No research leads match this view.</p>}</div>}
  </section>;
}

function ResearchWorkspace({ lead, salesAgents, saving, error, onBack, onSave, onPublish }: { lead: ResearchLead; salesAgents: User[]; saving: boolean; error: string; onBack: () => void; onSave: (lead: ResearchLead) => Promise<void>; onPublish: (event: FormEvent<HTMLFormElement>) => Promise<void> }) {
  const [draft, setDraft] = useState(lead); const [methodType, setMethodType] = useState<'phone' | 'email'>('phone'); const [methodValue, setMethodValue] = useState(''); const [evidence, setEvidence] = useState('');
  const published = lead.state === 'sent_to_sales';
  useEffect(() => { setDraft(lead); }, [lead]);
  const ready = isReadyForSales(draft) && draft.state === 'ready_for_sales' && JSON.stringify(draft) === JSON.stringify(lead);
  const [entryError, setEntryError] = useState('');
  const addMethod = () => { const value = methodValue.trim(); const candidate: ResearchMethod = { type: methodType, value }; if (published) return; if (!validResearchMethod(candidate)) return setEntryError('Enter a valid, unmasked phone number or email.'); if (draft.methods.some((item) => researchMethodKey(item) === researchMethodKey(candidate))) return setEntryError('This contact method is already listed.'); setEntryError(''); setDraft((current) => ({ ...current, methods: [...current.methods, candidate] })); setMethodValue(''); };
  const addEvidence = () => { const value = evidence.trim(); if (published) return; if (!validEvidenceUrl(value)) return setEntryError('Enter a public HTTP or HTTPS evidence link.'); setEntryError(''); if (!draft.evidenceLinks.includes(value)) setDraft((current) => ({ ...current, evidenceLinks: [...current.evidenceLinks, value] })); setEvidence(''); };
  return <section className="research-workspace"><button className="quiet research-back" onClick={onBack}><IconArrowLeft size={16} /> Back to queue</button>
    <header><div><span className="eyebrow">RESEARCH WORKSPACE</span><h2>{draft.name}</h2><p>{draft.source} · Received {new Date(draft.receivedAt).toLocaleString()}</p></div><i className={`research-status ${draft.state}`}>{researchStateLabels[draft.state]}</i></header>
    {(error || entryError) && <p className="warning" role="alert">{error || entryError}</p>}
    <fieldset disabled={published || saving} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}><div className="research-columns"><div className="research-main">
      <article className="research-card"><h3>Original masked lead</h3><div className="research-facts"><p><span>Name</span><b>{lead.name}</b></p><p><span>Phone</span><b>{lead.maskedPhone ?? 'Not available'}</b></p><p><span>Email</span><b>{lead.maskedEmail ?? 'Not available'}</b></p><p><span>Address</span><b>{lead.address ?? 'Not available'}</b></p><p><span>Credits</span><b>{lead.credits ?? 'Not available'}</b></p><p><span>Category</span><b>{leadCategoryLabels[lead.category]}</b></p></div>{lead.description && <p className="research-description">{lead.description}</p>}{lead.details && <details><summary>Original qualification details</summary><p>{lead.details}</p></details>}</article>
      <article className="research-card"><div className="research-card-heading"><div><h3>Discovered contact information</h3><p>Masked values never count as Sales-ready.</p></div>{ready && <span className="research-ready"><IconCircleCheck size={16} /> Ready</span>}</div><div className="research-add-line"><select value={methodType} onChange={(event) => setMethodType(event.target.value as typeof methodType)}><option value="phone">Phone</option><option value="email">Email</option></select><input aria-label="Discovered contact value" value={methodValue} onChange={(event) => setMethodValue(event.target.value)} placeholder={methodType === 'phone' ? '+1 555 123 4567' : 'name@company.com'} /><button type="button" className="primary" onClick={addMethod}>Add</button></div><div className="research-methods">{draft.methods.map((method, index) => <div key={`${method.type}-${method.value}`}><span>{method.type === 'phone' ? <IconPhone size={18} /> : <IconMail size={18} />}<b>{method.value}</b></span><button aria-label={`Remove ${method.value}`} onClick={() => setDraft((current) => ({ ...current, methods: current.methods.filter((_item, itemIndex) => itemIndex !== index) }))}><IconTrash size={16} /></button></div>)}{!draft.methods.length && <p>No discovered contact methods yet.</p>}</div></article>
      <article className="research-card"><h3>Research evidence and notes</h3><div className="research-add-line"><input aria-label="Evidence link" value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="https://company.example/contact" /><button type="button" className="quiet" onClick={addEvidence}>Add link</button></div>{draft.evidenceLinks.map((link, index) => <div className="evidence-row" key={link}><a href={link} target="_blank" rel="noreferrer"><IconExternalLink size={15} /> {link}</a><button aria-label={`Remove ${link}`} onClick={() => setDraft((current) => ({ ...current, evidenceLinks: current.evidenceLinks.filter((_item, itemIndex) => itemIndex !== index) }))}><IconTrash size={15} /></button></div>)}<label>Research notes<textarea rows={5} value={draft.researchNotes ?? ''} onChange={(event) => setDraft((current) => ({ ...current, researchNotes: event.target.value }))} /></label></article>
    </div><aside className="research-side"><article className="research-card"><h3>Research decision</h3><label>Lead name<input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label><label>Category<select value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value as LeadCategory }))}>{leadCategoryOptions.map((category) => <option key={category} value={category}>{leadCategoryLabels[category]}</option>)}</select></label><label>Research state<select value={draft.state} disabled={published} onChange={(event) => setDraft((current) => ({ ...current, state: event.target.value as ResearchState }))}>{researchStates.filter((state) => state !== 'sent_to_sales' || published).map((state) => <option key={state} value={state} disabled={state === 'ready_for_sales' && !isReadyForSales(draft)}>{researchStateLabels[state]}</option>)}</select></label><label>Duplicate check<select value={draft.duplicateState} onChange={(event) => setDraft((current) => ({ ...current, duplicateState: event.target.value as ResearchLead['duplicateState'] }))}><option value="clear">Clear</option><option value="possible">Possible duplicate</option><option value="confirmed">Confirmed duplicate</option></select></label><button className="primary" disabled={saving || published} onClick={() => onSave(draft)}>{saving ? 'Saving…' : 'Save research'}</button></article>
      <article className="research-card research-handoff"><IconSend size={24} /><h3>Send to Sales</h3><p>{ready ? 'This lead has a usable contact method.' : 'Save a valid contact method with the Ready for Sales state before sending.'}</p><form onSubmit={onPublish}><label>Sales Agent<select name="salesOwnerId" defaultValue="" disabled={!ready || published} required><option value="" disabled>Choose Sales Agent</option>{salesAgents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></label><button className="primary" disabled={!ready || saving || published}>{published ? 'Already sent' : 'Send to Sales'}</button></form></article>
    </aside></div></fieldset>
  </section>;
}
