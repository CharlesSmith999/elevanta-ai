import { FormEvent, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { createAdminUser, loadAdminUsers, updateAdminUser, type ManagedUser } from './api';

const choices = [
  { key: 'admin', label: 'Admin', role: 'admin', department: null },
  { key: 'marketing_manager', label: 'Marketing Manager', role: 'manager', department: 'marketing' },
  { key: 'sales_manager', label: 'Sales Manager', role: 'manager', department: 'sales' },
  { key: 'marketer', label: 'Marketing Agent', role: 'marketer', department: 'marketing' },
  { key: 'sales_agent', label: 'Sales Agent', role: 'sales_agent', department: 'sales' },
] as const;
const roleKey = (user: ManagedUser) => user.role === 'manager' ? (user.department ? `${user.department}_manager` : '') : user.role;
const roleLabel = (user: ManagedUser) => choices.find((choice) => choice.key === roleKey(user))?.label ?? 'Manager · setup needed';

export function AdminUserManagement({ session, onNotice, onChanged }: { session: Session; onNotice: (message: string) => void; onChanged: () => void }) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [editor, setEditor] = useState<ManagedUser | 'new' | null>(null);
  const [role, setRole] = useState('sales_agent');
  const [managerId, setManagerId] = useState('');
  const [active, setActive] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const [query, setQuery] = useState('');
  const [access, setAccess] = useState('all');
  async function refresh() {
    setLoading(true); setLoadError('');
    try { setUsers((await loadAdminUsers(session)).users); }
    catch (e) { setLoadError(e instanceof Error ? e.message : 'Unable to load users.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, [session]);
  function open(user: ManagedUser | 'new') {
    setEditor(user); setError(''); setRole(user === 'new' ? 'sales_agent' : roleKey(user));
    setManagerId(user === 'new' ? '' : user.manager_id ?? ''); setActive(user === 'new' || user.active);
  }
  const editing = editor && editor !== 'new' ? editor : null;
  const selected = choices.find((choice) => choice.key === role);
  const needsManager = selected?.role === 'sales_agent' || selected?.role === 'marketer';
  const managers = users.filter((user) => user.active && user.role === 'manager' && user.department === selected?.department && user.id !== editing?.id);
  const self = editing?.id === session.user.id;
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (submitting.current) return;
    setError(''); const form = new FormData(event.currentTarget);
    const fullName = String(form.get('fullName') ?? '').trim();
    if (fullName.length < 2) return setError('Enter a full name of at least two characters.');
    const unchangedHierarchy = editing && role === roleKey(editing) && managerId === (editing.manager_id ?? '') && !(active && !editing.active);
    if (!unchangedHierarchy && !selected) return setError('Choose Marketing Manager or Sales Manager to complete this account’s department.');
    if (!unchangedHierarchy && needsManager && !managers.some((manager) => manager.id === managerId)) return setError('Choose an active manager in this department. If none is listed, close this form and add or edit the department manager first.');
    const hierarchy = unchangedHierarchy ? {} : { role: selected!.role, department: selected!.department, managerId: needsManager ? managerId : null };
    submitting.current = true; setSaving(true);
    try {
      if (editor === 'new') {
        await createAdminUser(session, { fullName, ...hierarchy, email: String(form.get('email') ?? '').trim(), password: String(form.get('password') ?? '') });
      } else if (editing) {
        await updateAdminUser(session, editing.id, { fullName, ...hierarchy, active });
      }
      onNotice(editor === 'new' ? 'User created.' : 'User updated. History preserved.');
      setEditor(null); await refresh(); onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save this user.'); }
    finally { submitting.current = false; setSaving(false); }
  }
  const visible = users.filter((user) => `${user.full_name} ${user.email} ${roleLabel(user)}`.toLowerCase().includes(query.toLowerCase()) && (access === 'all' || user.active === (access === 'active')));
  return <section className="board">
    <div className="board-heading"><div><span className="eyebrow">ADMIN ONLY</span><h2>User management</h2><p>Add users, manage their team, or make an account inactive. Lead and activity history is preserved.</p></div><button className="primary" disabled={loading || !!loadError} onClick={() => open('new')}>Add user</button></div>
    {loadError && <div role="alert" className="warning">{loadError} <button className="quiet" onClick={() => void refresh()}>Retry</button></div>}
    {users.some((user) => user.role === 'manager' && !user.department) && <p className="warning">Some managers need department setup. Edit each highlighted manager and choose Marketing Manager or Sales Manager before adding their agents.</p>}
    <div className="detail-grid"><label>Find a user<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, email, or role" /></label><label>Account access<select value={access} onChange={(event) => setAccess(event.target.value)}><option value="all">All users</option><option value="active">Active users</option><option value="inactive">Inactive users</option></select></label></div>
    {loading ? <p className="empty">Loading users…</p> : <div className="table-wrap"><table className="responsive-data-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Manager</th><th>Access</th><th>Action</th></tr></thead><tbody>{visible.map((user) => <tr key={user.id}>
      <td data-label="Name"><b>{user.full_name}</b></td><td data-label="Email">{user.email || 'Not available'}</td><td data-label="Role">{roleLabel(user)}</td><td data-label="Manager">{users.find((candidate) => candidate.id === user.manager_id)?.full_name ?? (user.role === 'manager' || user.role === 'admin' ? 'Not required' : 'Setup needed')}</td><td data-label="Access"><span className={user.active ? 'success-chip' : 'warning'}>{user.active ? 'Active' : 'Inactive'}</span></td><td data-label="Action"><button className="quiet" onClick={() => open(user)} aria-label={`Edit ${user.full_name}`}>Edit / access</button></td>
    </tr>)}</tbody></table>{!visible.length && !loadError && <p className="empty">No users match these filters.</p>}</div>}
    {editor && <div className="modal-backdrop" role="presentation"><form className="modal" role="dialog" aria-modal="true" aria-labelledby="user-editor-title" onSubmit={save}>
      <div className="panel-heading"><h2 id="user-editor-title">{editing ? `Edit ${editing.full_name}` : 'Add a user'}</h2><button type="button" className="quiet" disabled={saving} onClick={() => setEditor(null)}>Close</button></div>
      {error && <p className="warning" role="alert">{error}</p>}
      <fieldset disabled={saving} style={{ border: 0, padding: 0, margin: 0 }}><div className="detail-grid">
        <label>Full name<input name="fullName" autoFocus defaultValue={editing?.full_name ?? ''} minLength={2} maxLength={160} required /></label>
        <label>Email{editing ? <input value={editing.email} readOnly /> : <input name="email" type="email" autoComplete="off" maxLength={254} required />}</label>
        <label>Role<select value={role} disabled={self} onChange={(event) => { setRole(event.target.value); setManagerId(''); }}><option value="" disabled>Choose manager department</option>{choices.map((choice) => <option key={choice.key} value={choice.key}>{choice.label}</option>)}</select></label>
        {needsManager && <label>Manager<select value={managerId} onChange={(event) => setManagerId(event.target.value)}><option value="">Choose manager</option>{managerId && !managers.some((manager) => manager.id === managerId) && <option value={managerId} disabled>Current manager needs setup</option>}{managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.full_name}</option>)}</select></label>}
        {editor === 'new' ? <label>Temporary password<input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required placeholder="At least 8 characters" /></label> : <label>Account status<select value={active ? 'active' : 'inactive'} disabled={self} onChange={(event) => setActive(event.target.value === 'active')}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>}
      </div></fieldset>
      {needsManager && !managers.length && <p className="warning">No eligible {selected?.department} manager is available. Add a manager, or edit an existing manager to set their department, then return here.</p>}
      <p className="board-note">Managers do not need a manager. Inactive users cannot use the CRM. Reassign active leads and team members before deactivation. You can reactivate an account later.</p>
      <button className="primary" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create user'}</button>
    </form></div>}
  </section>;
}
