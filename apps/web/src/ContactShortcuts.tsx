import { useState } from 'react';
import type { LeadContactMethod } from './leadWorkflow';
import { shortcutHref } from './shortcutLinks';

export function ContactShortcuts({ method, allowed }: { method: LeadContactMethod; allowed: boolean }) {
  const [message, setMessage] = useState('');
  const href = allowed ? shortcutHref(method) : undefined;
  async function copy() {
    try { await navigator.clipboard.writeText(method.value); setMessage('Copied'); }
    catch { setMessage('Copy unavailable. Select the contact text to copy it.'); }
  }
  return <span className="contact-shortcuts">
    <button type="button" className="quiet" aria-label={`Copy ${method.value}`} onClick={() => void copy()}>Copy</button>
    {href && <a className="quiet" href={href} aria-label={`${method.type === 'phone' ? 'Dial' : 'Email'} ${method.value}`}>{method.type === 'phone' ? 'Dial' : 'Email'}</a>}
    {message && <small role="status">{message}</small>}
  </span>;
}
