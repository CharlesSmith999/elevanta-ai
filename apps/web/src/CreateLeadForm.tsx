import { useEffect, useRef, useState, type FormEvent } from 'react';
import { IconArrowLeft, IconArrowRight, IconMail, IconPhone, IconPlus, IconX } from '@tabler/icons-react';
import { leadCategoryLabels, leadCategoryOptions, sourceOptions, type User } from './domain';
import { validateContactMethod } from './leadWorkflow';

type Props = { error: string; saving: boolean; viewer: User; salesAgents: User[]; crmReady: boolean; onReconnect?: () => void; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void };

export function CreateLeadForm({ error, saving, viewer, salesAgents, crmReady, onReconnect, onClose, onSubmit }: Props) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [source, setSource] = useState('');
  const [category, setCategory] = useState('not_available');
  const [description, setDescription] = useState('');
  const [phones, setPhones] = useState(['']);
  const [emails, setEmails] = useState(['']);
  const [owner, setOwner] = useState('');
  const [validation, setValidation] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const allowed = viewer.role === 'admin' || viewer.role === 'marketer';
  useEffect(() => {
    const prior = document.activeElement as HTMLElement | null;
    headingRef.current?.focus();
    return () => prior?.focus();
  }, []);
  useEffect(() => { headingRef.current?.focus(); }, [step]);
  function close() {
    if (saving) return;
    if ((name || phones.some(Boolean) || emails.some(Boolean) || description) && !window.confirm('Discard this unsaved lead?')) return;
    onClose();
  }
  function next() {
    const methods = [...phones.filter(v => v.trim()).map(value => ({ type: 'phone' as const, value })), ...emails.filter(v => v.trim()).map(value => ({ type: 'email' as const, value }))];
    if (!name.trim() || !source || !methods.length) return setValidation('Enter a name, select a source, and add at least one phone number or email.');
    for (const method of methods) { const issue = validateContactMethod(method.type, method.value.trim()); if (issue) return setValidation(issue); }
    const keys = methods.map(m => `${m.type}:${m.type === 'phone' ? m.value.replace(/\D/g, '') : m.value.trim().toLowerCase()}`);
    if (new Set(keys).size !== keys.length) return setValidation('Remove repeated phone numbers or email addresses before continuing.');
    setValidation(''); setStep(2);
  }
  return <div className="modal-backdrop" role="presentation"><form ref={formRef} className="modal lead-form-modal focused-lead-form" role="dialog" aria-modal="true" aria-labelledby="create-lead-title" onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key === 'Tab') {
      const controls = Array.from(formRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]') ?? []).filter(node => node.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === headingRef.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }} onSubmit={event => { if (step === 1) { event.preventDefault(); next(); } else onSubmit(event); }}>
    <header className="panel-heading"><div><span className="eyebrow">NEW LEAD · STEP {step} OF 2</span><h2 id="create-lead-title" tabIndex={-1} ref={headingRef}>{step === 1 ? 'Who should we contact?' : 'Review and route'}</h2><p>{step === 1 ? 'Add the request and every useful contact method.' : 'Check the details and choose who works this lead.'}</p></div><button type="button" className="quiet" onClick={close} disabled={saving} aria-label="Close lead creation"><IconX size={20} /></button></header>
    {!allowed ? <p role="alert">Only Admin and Marketing can create leads.</p> : <>
      {(error || validation) && <p className="warning" role="alert">{error || validation}</p>}
      {!crmReady && <p className="warning">Connection unavailable. Your entries are kept here.{onReconnect && <button type="button" className="quiet" onClick={onReconnect}>Reconnect</button>}</p>}
      <fieldset disabled={saving} className="creation-fields" hidden={step !== 1}>
        <label>Lead name<input name="name" value={name} onChange={e => setName(e.target.value)} maxLength={160} autoComplete="name" /></label>
        <div className="creation-contacts">{(['phone', 'email'] as const).map(type => {
          const values = type === 'phone' ? phones : emails; const update = type === 'phone' ? setPhones : setEmails;
          return <section key={type}><h3>{type === 'phone' ? <IconPhone size={18} /> : <IconMail size={18} />}{type === 'phone' ? 'Phone numbers' : 'Email addresses'}</h3>{values.map((value, index) => <div className="contact-input-row" key={index}><input aria-label={`${type === 'phone' ? 'Phone number' : 'Email address'} ${index + 1}`} name={type} type={type === 'phone' ? 'tel' : 'email'} value={value} onChange={e => update(values.map((old, i) => i === index ? e.target.value : old))} placeholder={type === 'phone' ? '+1 555 123 4567' : 'name@company.com'} maxLength={type === 'phone' ? 60 : 254} /><button type="button" className="quiet" aria-label={`Remove ${type} ${index + 1}`} onClick={() => update(values.length === 1 ? [''] : values.filter((_, i) => i !== index))}><IconX size={16} /></button></div>)}<button type="button" className="quiet" disabled={values.length >= 10} onClick={() => update([...values, ''])}><IconPlus size={16} />Add {type}</button></section>;
        })}</div>
        <small>A name and one usable phone or email are required. Add both when available.</small>
        <div className="detail-grid"><label>Source<select name="source" value={source} onChange={e => setSource(e.target.value)}><option value="">Choose source</option>{sourceOptions.map(s => <option key={s}>{s}</option>)}</select></label><label>Project category<select name="category" value={category} onChange={e => setCategory(e.target.value)}>{leadCategoryOptions.map(c => <option key={c} value={c}>{leadCategoryLabels[c]}</option>)}</select></label></div>
        <label>Project description <small>Optional</small><textarea name="description" value={description} onChange={e => setDescription(e.target.value)} maxLength={4000} rows={3} placeholder="What does this person need?" /></label>
      </fieldset>
      {step === 2 && <section className="creation-review"><h3>{name}</h3><p>{source} · {leadCategoryLabels[category as keyof typeof leadCategoryLabels]}</p><div className="review-contact-list">{phones.filter(v => v.trim()).map(v => <p key={v}><IconPhone size={16} />{v}</p>)}{emails.filter(v => v.trim()).map(v => <p key={v}><IconMail size={16} />{v}</p>)}</div>{description && <p className="review-description">{description}</p>}<label>Sales agent<select name="owner" value={owner} onChange={e => setOwner(e.target.value)} disabled={saving}><option value="">Save unassigned</option>{salesAgents.map(agent => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></label><p>{owner ? 'This lead will appear immediately in the selected agent’s inbox.' : 'The lead will be saved for Marketing to assign later.'}</p></section>}
      <footer className="creation-footer">{step === 2 ? <button type="button" className="quiet" disabled={saving} onClick={() => setStep(1)}><IconArrowLeft size={16} />Edit details</button> : <small>Contact details stay together throughout the handoff.</small>}<button className="primary" disabled={saving || !crmReady}>{saving ? 'Saving…' : step === 1 ? 'Review lead' : owner ? 'Create and assign' : 'Save unassigned'}{step === 1 && <IconArrowRight size={16} />}</button></footer>
    </>}
  </form></div>;
}
