import { FormEvent, useEffect, useMemo, useState } from 'react';
import { IconActivityHeartbeat, IconAlertTriangle, IconArrowUpRight, IconBriefcase, IconBulb, IconCalendar, IconChartBar, IconChartPieFilled, IconChecklist, IconChevronDown, IconCircleCheck, IconClock, IconCurrencyDollar, IconFilter, IconFlag, IconHome, IconMenu2, IconMoonStars, IconReportAnalytics, IconRobot, IconRocket, IconSparkles, IconSun, IconTarget, IconTargetArrow, IconTrophy, IconTrendingUp, IconUserCircle, IconUsers, IconX } from '@tabler/icons-react';
import { Area, AreaChart, Bar as RechartsBar, BarChart as RechartsBarChart, CartesianGrid, Cell, Funnel, FunnelChart, LabelList, Line, LineChart, RadialBar, RadialBarChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';
import {
  Activity, DashboardPeriod, FollowUp, Lead, OpportunityStatus, Qualification, Role, User, benchmarkBySource, canEditLeadDetails, canFlagIncorrectLead, canReassign, canUpdateLead, canViewDataQualityBoard, canViewManagementBoards, canViewNamedLeaderboard,
  currentAssignment, dashboardDateRange, dashboardFor, dashboardReconciliation, dataQualityIssues, duplicateMatches, filterDashboardLeads, financialMetrics, incorrectReviewState, isLeadIdentity, leaderboardForMarketing, leaderboardForSales, lossReasonBreakdown, lostReasonOptions, makeId, median,
  leadCategoryLabels, leadCategoryOptions, ownerId, qualificationLabels, responseHours, routingHours, seedLeads, sourceOptions, stageAgeLabel, statusLabels, transitionStage, users, validStatusTransition, validWonFinancials,
} from './domain';
import { authEnabled, supabase, type AuthState } from './auth';
import { addRemoteFollowUp, addRemoteNote, completeRemoteFollowUp, createAdminUser, createRemoteLead, decideRemoteReview, loadAdminUsers, loadRemoteLeads, reassignRemoteLead, reportRemoteIncorrect, updateAdminUser, updateRemoteLeadDetails, updateRemoteStatus, type ManagedUser } from './api';
import { RoleReferenceDashboard, RoleReferenceKind, RoleReferenceSidebar, RoleSwitcher } from './RoleReferenceDashboards';
import { XaviarWorkspace } from './XaviarWorkspace';
import { navigationFor } from './navigation';
import { LeadWorkspace } from './LeadWorkspace';
import type { Session } from '@supabase/supabase-js';

const storageKey = 'elevanta-test-workspace-v1';
const themeStorageKey = 'elevanta-theme-v1';
const roleLabels: Record<Role, string> = { admin: 'Admin', manager: 'Sales Manager', marketer: 'Marketing Agent', sales_agent: 'Sales Agent' };
const workspaceUsers: User[] = [...users, { id: 'shariq-marketing-manager', name: 'Shariq', role: 'manager', department: 'marketing' }];
const statusOptions = Object.keys(statusLabels) as OpportunityStatus[];
const qualificationOptions = Object.keys(qualificationLabels) as Qualification[];
type DashboardScope = 'company' | 'marketing' | 'sales';

function safeLeadData() {
  try { return JSON.parse(localStorage.getItem(storageKey) ?? '') as Lead[]; } catch { return structuredClone(seedLeads); }
}

function nameFor(id?: string) { return users.find((user) => user.id === id)?.name ?? 'Unassigned'; }
function initialsFor(value: string) { return value.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '—'; }
function leadScorePreview(lead: Lead) {
  const qualification = lead.qualification === 'sql' ? 24 : lead.qualification === 'mql' ? 14 : 0;
  const status = lead.status === 'proposal_sent' ? 20 : lead.status === 'connected' ? 16 : lead.status === 'qualified' ? 15 : lead.status === 'follow_up_required' ? 10 : lead.status === 'won' ? 28 : 0;
  return Math.max(20, Math.min(99, lead.priority * 10 + qualification + status));
}
function formatDate(value: string) { return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value)); }
function relativeDue(followUp?: FollowUp) {
  if (!followUp) return 'No follow-up';
  const ms = new Date(followUp.dueAt).getTime() - Date.now();
  if (ms < 0) return 'Overdue';
  if (ms < 86_400_000) return 'Today';
  return formatDate(followUp.dueAt);
}
function leadActivity(actorId: string, kind: Activity['kind'], body: string): Activity { return { id: makeId('activity'), actorId, kind, body, at: new Date().toISOString() }; }

function WorkspaceApp({ onSignOut, session }: { onSignOut?: () => void; session?: Session }) {
  const [leads, setLeads] = useState<Lead[]>(safeLeadData);
  const [remoteLoaded, setRemoteLoaded] = useState(false);
  const [viewerId, setViewerId] = useState('shariq');
  const [page, setPage] = useState('Dashboard');
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [showCreate, setShowCreate] = useState(false);
  const [notice, setNotice] = useState('');
  const [dashboardPeriod, setDashboardPeriod] = useState<DashboardPeriod>('lifetime');
  const [dashboardSource, setDashboardSource] = useState('all');
  const [dashboardStatus, setDashboardStatus] = useState<'all' | OpportunityStatus>('all');
  const [dashboardTeamMember, setDashboardTeamMember] = useState('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [dashboardScope, setDashboardScope] = useState<DashboardScope>('company');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => localStorage.getItem(themeStorageKey) === 'dark' ? 'dark' : 'light');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const viewer = workspaceUsers.find((user) => user.id === viewerId)!;
  const dashboard = useMemo(() => viewer.role === 'manager' && viewer.department === 'marketing'
    ? dashboardFor({ ...viewer, role: 'admin' }, leads.filter((lead) => users.find((user) => user.id === lead.marketingOwnerId)?.department === 'marketing'))
    : dashboardFor(viewer, leads), [viewer, leads]);
  const selected = leads.find((lead) => lead.id === selectedId);
  const visible = dashboard.visible;
  const selectedRange = useMemo(() => dashboardDateRange(dashboardPeriod, new Date(), { start: customStart || undefined, end: customEnd || undefined }), [dashboardPeriod, customStart, customEnd]);
  const scopedDashboardLeads = useMemo(() => {
    if (viewer.role !== 'admin') return visible;
    if (dashboardScope === 'marketing') return visible.filter((lead) => users.find((user) => user.id === lead.marketingOwnerId)?.department === 'marketing');
    if (dashboardScope === 'sales') return visible.filter((lead) => users.find((user) => user.id === ownerId(lead))?.department === 'sales');
    return visible;
  }, [viewer, visible, dashboardScope]);
  const dashboardLeads = useMemo(() => {
    const dateSourceAndStatus = filterDashboardLeads(scopedDashboardLeads, selectedRange, dashboardSource, dashboardStatus);
    if (dashboardTeamMember === 'all') return dateSourceAndStatus;
    return dateSourceAndStatus.filter((lead) => {
      if (dashboardScope === 'marketing') return lead.marketingOwnerId === dashboardTeamMember;
      if (dashboardScope === 'sales') return ownerId(lead) === dashboardTeamMember;
      return lead.marketingOwnerId === dashboardTeamMember || ownerId(lead) === dashboardTeamMember;
    });
  }, [scopedDashboardLeads, selectedRange, dashboardSource, dashboardStatus, dashboardTeamMember, dashboardScope]);
  const filteredDashboard = useMemo(() => dashboardFor(viewer.role === 'manager' && viewer.department === 'marketing' ? { ...viewer, role: 'admin' } : viewer, dashboardLeads), [viewer, dashboardLeads]);
  const duplicateCount = useMemo(() => duplicateMatches(leads).length, [leads]);

  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(leads)); }, [leads]);
  useEffect(() => { localStorage.setItem(themeStorageKey, theme); }, [theme]);
  useEffect(() => { if (notice) { const timer = window.setTimeout(() => setNotice(''), 3500); return () => window.clearTimeout(timer); } }, [notice]);
  useEffect(() => {
    if (!session) return;
    let active = true;
    loadRemoteLeads(session).then((remoteLeads) => { if (active) { setLeads(remoteLeads); setRemoteLoaded(true); setNotice('Connected to the CRM workspace.'); } }).catch((error: unknown) => { if (active) { setRemoteLoaded(false); setNotice(error instanceof Error ? `CRM connection unavailable: ${error.message}` : 'CRM connection unavailable; safe sample data remains active.'); } });
    return () => { active = false; };
  }, [session]);

  function persist(action: (activeSession: Session) => Promise<unknown>, success?: string) {
    if (!session || !remoteLoaded) return;
    void action(session).then(() => { if (success) setNotice(success); }).catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'The CRM could not save this change.'));
  }

  const mutateLead = (leadId: string, mutate: (lead: Lead) => Lead) => setLeads((existing) => existing.map((lead) => lead.id === leadId ? mutate(lead) : lead));
  const select = (leadId: string) => { setSelectedId(leadId); setPage('Lead inbox'); };

  function updateStatus(lead: Lead, next: OpportunityStatus) {
    if (next === 'won') return setNotice('Use the Won financial details form to record total project cost and upfront payment.');
    if ((next === 'lost' || next === 'not_interested') && !lead.lostReason) return setNotice('Choose a loss reason before closing this opportunity.');
    if (!canUpdateLead(viewer, lead) || !validStatusTransition(lead.status, next)) return setNotice('This status change is not allowed for your role or for a closed lead.');
    mutateLead(lead.id, (current) => ({ ...current, status: next, stageHistory: transitionStage(current.stageHistory, next, viewer.id, new Date().toISOString(), `Status changed from ${statusLabels[current.status]} to ${statusLabels[next]}.`), activities: [...current.activities, leadActivity(viewer.id, 'status', `Status changed from ${statusLabels[current.status]} to ${statusLabels[next]}.`)] }));
    persist((activeSession) => updateRemoteStatus(activeSession, lead.id, { status: next }), 'Status saved to the CRM.');
    setNotice('Status saved and added to the permanent history.');
  }

  function markWon(lead: Lead, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canUpdateLead(viewer, lead) || !validStatusTransition(lead.status, 'won')) return setNotice('This opportunity cannot be marked Won by your role or from its current status.');
    const form = new FormData(event.currentTarget);
    const total = Number(form.get('totalProjectCost'));
    const upfront = Number(form.get('upfrontPaymentAmount'));
    if (!validWonFinancials(total, upfront)) return setNotice('Enter valid non-negative costs; upfront payment cannot exceed total project cost.');
    mutateLead(lead.id, (current) => { const at = new Date().toISOString(); return { ...current, status: 'won', stageHistory: transitionStage(current.stageHistory, 'won', viewer.id, at, 'Marked Won'), totalProjectCost: total, upfrontPaymentAmount: upfront, wonAt: at, activities: [...current.activities, leadActivity(viewer.id, 'status', `Marked Won. Total project cost: ${total}; upfront payment: ${upfront}.`)] }; });
    persist((activeSession) => updateRemoteStatus(activeSession, lead.id, { status: 'won', qualification: lead.qualification, totalProjectCost: total, upfrontPaymentAmount: upfront }), 'Won opportunity saved to the CRM.');
    event.currentTarget.reset(); setNotice('Won opportunity saved with financial details.');
  }

  function updateQualification(lead: Lead, qualification: Qualification) {
    if (!canUpdateLead(viewer, lead)) return setNotice('You do not have permission to update qualification.');
    mutateLead(lead.id, (current) => ({ ...current, qualification, activities: [...current.activities, leadActivity(viewer.id, 'system', `Qualification set to ${qualificationLabels[qualification]}.`)] }));
    persist((activeSession) => updateRemoteStatus(activeSession, lead.id, { status: lead.status, qualification }), 'Qualification saved to the CRM.');
  }

  function updateLostReason(lead: Lead, lostReason: Lead['lostReason']) {
    if (!canUpdateLead(viewer, lead)) return setNotice('You do not have permission to update the loss reason.');
    mutateLead(lead.id, (current) => ({ ...current, lostReason, activities: [...current.activities, leadActivity(viewer.id, 'system', `Loss reason set to ${lostReason ?? 'Not available'}.`)] }));
  }

  function addNote(lead: Lead, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = String(form.get('note') ?? '').trim();
    if (!body) return;
    if (!canUpdateLead(viewer, lead)) return setNotice('You cannot add a note to this lead.');
    mutateLead(lead.id, (current) => ({ ...current, activities: [...current.activities, leadActivity(viewer.id, 'note', body)] }));
    persist((activeSession) => addRemoteNote(activeSession, lead.id, { body }), 'Note saved to the CRM.');
    event.currentTarget.reset(); setNotice('Note saved.');
  }

  function addFollowUp(lead: Lead, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canUpdateLead(viewer, lead)) return setNotice('You cannot schedule a follow-up for this lead.');
    const form = new FormData(event.currentTarget); const due = String(form.get('dueAt') ?? ''); const action = String(form.get('action') ?? 'Call') as FollowUp['action'];
    if (!due) return setNotice('Choose a date and time for the follow-up.');
    const owner = ownerId(lead); if (!owner) return setNotice('Assign this lead before creating a follow-up.');
    mutateLead(lead.id, (current) => ({ ...current, followUps: [...current.followUps, { id: makeId('follow-up'), ownerId: owner, dueAt: new Date(due).toISOString(), action, status: 'open' }], activities: [...current.activities, leadActivity(viewer.id, 'follow_up', `${action} follow-up scheduled for ${formatDate(new Date(due).toISOString())}.`)] }));
    persist((activeSession) => addRemoteFollowUp(activeSession, lead.id, { dueAt: new Date(due).toISOString(), actionType: action }), 'Follow-up saved to the CRM.');
    event.currentTarget.reset(); setNotice('Follow-up scheduled.');
  }

  function completeFollowUp(lead: Lead, followUpId: string) {
    if (!canUpdateLead(viewer, lead)) return setNotice('You cannot complete this follow-up.');
    mutateLead(lead.id, (current) => ({ ...current, followUps: current.followUps.map((followUp) => followUp.id === followUpId ? { ...followUp, status: 'completed' } : followUp), activities: [...current.activities, leadActivity(viewer.id, 'follow_up', 'Follow-up completed.')] }));
    persist((activeSession) => completeRemoteFollowUp(activeSession, followUpId), 'Follow-up completed in the CRM.');
  }

  function reassign(lead: Lead, event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const nextOwnerId = String(form.get('owner') ?? ''); const visibility = String(form.get('visibility') ?? 'full_context') as 'full_context' | 'fresh_start'; const reason = String(form.get('reason') ?? '').trim();
    if (!reason) return setNotice('A reason is required for every handoff.');
    if (!canReassign(viewer, lead, nextOwnerId)) return setNotice(lead.routingPaused ? 'Assignment is paused while the Incorrect Review is pending.' : 'You can only assign leads within your permitted scope.');
    const old = currentAssignment(lead);
    mutateLead(lead.id, (current) => { const at = new Date().toISOString(); const nextStatus = current.status === 'new' ? 'assigned' : current.status; return { ...current, status: nextStatus, stageHistory: nextStatus === current.status ? current.stageHistory : transitionStage(current.stageHistory, nextStatus, viewer.id, at, 'Initial sales assignment'), assignments: current.assignments.map((assignment) => assignment.id === old?.id ? { ...assignment, endedAt: at } : assignment).concat({ id: makeId('assignment'), ownerId: nextOwnerId, assignedBy: viewer.id, at, visibility, reason }), activities: [...current.activities, leadActivity(viewer.id, 'assignment', `Assigned to ${nameFor(nextOwnerId)} with ${visibility === 'full_context' ? 'full context' : 'a fresh working view'}: ${reason}`)] }; });
    persist((activeSession) => reassignRemoteLead(activeSession, lead.id, { assignedTo: nextOwnerId, visibility, reason }), 'Assignment history saved to the CRM.');
    event.currentTarget.reset(); setNotice('Assignment saved; the earlier ownership record remains in history.');
  }

  function reportIncorrect(lead: Lead, event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const reason = String(form.get('reason') ?? '').trim(); const evidence = String(form.get('evidence') ?? '').trim();
    if (!canFlagIncorrectLead(viewer, lead)) return setNotice('You cannot flag this lead outside your permitted scope.');
    if (!reason) return setNotice('Choose an incorrect-lead reason.');
    if (lead.incorrectReports.some((report) => report.reporterId === viewer.id)) return setNotice('Each user may flag a lead only once.');
    mutateLead(lead.id, (current) => { const at = new Date().toISOString(); const incorrectReports = [...current.incorrectReports, { reporterId: viewer.id, reporterRole: viewer.role, reason, evidence: evidence || undefined, at }]; const incorrectReview = incorrectReviewState(incorrectReports, current.incorrectReview); return { ...current, incorrectReports, incorrectReview, routingPaused: incorrectReview?.state === 'pending', activities: [...current.activities, leadActivity(viewer.id, 'incorrect_report', `Incorrect lead flag submitted: ${reason}.${evidence ? ` Evidence: ${evidence}` : ''}`)] }; });
    persist((activeSession) => reportRemoteIncorrect(activeSession, lead.id, { reasonCode: reason, evidence: evidence || undefined }), 'Incorrect report saved to the CRM.');
    event.currentTarget.reset(); setNotice(viewer.role === 'sales_agent' ? 'Flag saved. A review queue opens after three distinct Sales Agents report it.' : 'Flag saved as evidence. Only Sales Agent reports increase the automatic review threshold.');
  }

  function editLeadDetails(lead: Lead, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEditLeadDetails(viewer, lead)) return setNotice('Only Admin or permitted Marketing users can edit lead details.');
    const form = new FormData(event.currentTarget); const name = String(form.get('name') ?? '').trim(); const source = String(form.get('source') ?? '').trim(); const category = String(form.get('category') ?? 'not_available') as Lead['category']; const description = String(form.get('description') ?? '').trim();
    if (!name) return setNotice('Lead name is required.');
    if (!sourceOptions.includes(source as typeof sourceOptions[number])) return setNotice('Choose an approved source.');
    if (!category || !leadCategoryOptions.includes(category)) return setNotice('Choose an approved lead category.');
    mutateLead(lead.id, (current) => ({ ...current, name, source, category, description: description || undefined, activities: [...current.activities, leadActivity(viewer.id, 'system', 'Lead details updated.')] }));
    persist((activeSession) => updateRemoteLeadDetails(activeSession, lead.id, { name, source, category, description }), 'Lead details saved to the CRM.');
    setNotice('Lead details updated and added to audit history.');
  }

  function decideReview(lead: Lead, decision: 'confirmed_incorrect' | 'rejected' | 'merge_duplicate') {
    if (viewer.role !== 'admin' || lead.incorrectReview?.state !== 'pending') return setNotice('Only an admin can decide a pending incorrect review.');
    mutateLead(lead.id, (current) => { const at = new Date().toISOString(); const nextStatus = decision === 'rejected' ? 'follow_up_required' : decision === 'merge_duplicate' ? 'duplicate' : 'incorrect'; return { ...current, status: nextStatus, stageHistory: nextStatus === current.status ? current.stageHistory : transitionStage(current.stageHistory, nextStatus, viewer.id, at, `Admin review decision: ${decision.replaceAll('_', ' ')}.`), routingPaused: false, incorrectReview: { state: decision, reviewerId: viewer.id, reason: decision === 'rejected' ? 'Admin review rejected the incorrect classification.' : 'Admin decision recorded.', decidedAt: at }, activities: [...current.activities, leadActivity(viewer.id, 'system', `Admin review decision: ${decision.replaceAll('_', ' ')}.`)] }; });
    persist((activeSession) => decideRemoteReview(activeSession, lead.id, { decision }), 'Review decision saved to the CRM.');
    setNotice('Admin review decision recorded in audit history.');
  }

  function createLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const name = String(form.get('name') ?? '').trim(); const phone = String(form.get('phone') ?? '').trim(); const email = String(form.get('email') ?? '').trim(); const source = String(form.get('source') ?? '').trim(); const category = String(form.get('category') ?? 'not_available') as NonNullable<Lead['category']>; const description = String(form.get('description') ?? '').trim(); const owner = String(form.get('owner') ?? '');
    if (!isLeadIdentity(name, phone, email)) return setNotice('A lead needs a name plus a phone number or email address.');
    if (viewer.role !== 'admin' && viewer.role !== 'marketer') return setNotice('Only Admin and Marketing can create leads.');
    if (!sourceOptions.includes(source as typeof sourceOptions[number])) return setNotice('Choose an approved source. Use Other when the source is unknown.');
    if (!leadCategoryOptions.includes(category)) return setNotice('Choose an approved lead category.');
    const at = new Date().toISOString(); const status: OpportunityStatus = owner ? 'assigned' : 'new';
    const lead: Lead = { id: makeId('lead'), name, phone: phone || undefined, email: email || undefined, source, category, description: description || undefined, marketingOwnerId: viewer.id, sourceDate: at.slice(0, 10), status, qualification: 'not_available', priority: 0, assignments: owner ? [{ id: makeId('assignment'), ownerId: owner, assignedBy: viewer.id, at, visibility: 'full_context', reason: 'Initial assignment' }] : [], stageHistory: [{ id: makeId('stage'), toStatus: status, enteredAt: at, actorId: viewer.id, reason: 'Lead created' }], activities: [leadActivity(viewer.id, 'system', 'Lead created in the test workspace.')], followUps: [], incorrectReports: [] };
    const duplicate = duplicateMatches([...leads, lead]).find((candidate) => candidate.leadId === lead.id);
    setLeads((current) => [...current, lead]); setShowCreate(false); event.currentTarget.reset(); setNotice(duplicate ? 'Lead created and flagged as a duplicate candidate for review.' : 'Lead created successfully.');
    persist((activeSession) => createRemoteLead(activeSession, { name, phone: phone || undefined, email: email || undefined, source, category, description: description || undefined, salesOwnerId: owner || undefined }), 'Lead created in the CRM.');
  }

  function resetDemo() { setLeads(structuredClone(seedLeads)); setSelectedId(undefined); setNotice('Test workspace reset to the protected sample data.'); }
  function switchViewer(nextViewerId: string) {
    setViewerId(nextViewerId);
    setPage('Dashboard');
    setDashboardScope('company');
    setDashboardTeamMember('all');
    setSelectedId(undefined);
    setMobileNavOpen(false);
  }
  function navigate(next: string) {
    if (next === 'Dashboard') setDashboardScope('company');
    setPage(next);
    setSelectedId(undefined);
    setMobileNavOpen(false);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'smooth' }));
  }
  const roleReferenceKind: RoleReferenceKind | undefined = viewer.role === 'manager' ? (viewer.department === 'marketing' ? 'marketing-manager' : 'sales-manager')
    : viewer.role === 'marketer' ? 'marketing-agent'
    : viewer.role === 'sales_agent' ? 'sales-agent'
    : undefined;
  const adminReference = page === 'Dashboard' && viewer.role === 'admin';
  const roleReferenceDashboard = page === 'Dashboard' && Boolean(roleReferenceKind);
  const referenceDashboard = adminReference || roleReferenceDashboard;

  return <main className={`app-shell theme-${theme} admin-reference-shell role-reference-shell ${mobileNavOpen ? 'nav-open' : ''}`}>
    <button className="mobile-nav-toggle" type="button" aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen((open) => !open)}>{mobileNavOpen ? <IconX size={22} /> : <IconMenu2 size={22} />}<span>Menu</span></button>
    {mobileNavOpen && <button className="mobile-nav-backdrop" type="button" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
    <aside className={`sidebar ${mobileNavOpen ? 'mobile-open' : ''}`}>{viewer.role === 'admin'
      ? <AdminReferenceSidebar viewer={viewer} activePage={page} onNavigate={navigate} onReset={resetDemo} onSignOut={onSignOut} />
      : roleReferenceKind && <RoleReferenceSidebar kind={roleReferenceKind} viewer={viewer} activePage={page} onNavigate={navigate} onReset={resetDemo} onSignOut={onSignOut} />}
    </aside>
    <section className={`content ${referenceDashboard ? 'reference-dashboard-content' : 'unified-content'}`}>
      {!referenceDashboard && <><UnifiedPageHeader page={page} viewer={viewer} viewers={workspaceUsers} theme={theme} onViewer={switchViewer} onTheme={setTheme} />
        <div className="notice"><b>Functional test workspace</b><span>These records are safe test data. Every change is kept in this browser only, ready to be replaced by the final verified import.</span></div></>}
      {notice && <div className="toast" role="status">{notice}</div>}
      {adminReference ? <AdminCommandCenter viewer={viewer} viewers={workspaceUsers} leads={dashboardLeads} dashboard={filteredDashboard} period={dashboardPeriod} source={dashboardSource} theme={theme} onViewer={switchViewer} onPeriod={setDashboardPeriod} onSource={setDashboardSource} onTheme={setTheme} onNavigate={navigate} /> : roleReferenceDashboard && roleReferenceKind ? <RoleReferenceDashboard kind={roleReferenceKind} viewer={viewer} viewers={workspaceUsers} leads={dashboardLeads} period={dashboardPeriod} source={dashboardSource} theme={theme} onViewer={switchViewer} onPeriod={setDashboardPeriod} onSource={setDashboardSource} onTheme={setTheme} onNavigate={navigate} onCreate={() => setShowCreate(true)} onOpenLead={(leadId) => { setSelectedId(leadId); navigate('Lead inbox'); }} /> : <>
      {page === 'Lead inbox' && (selected ? <LeadWorkspace lead={selected} viewer={viewer} session={session} onBack={() => setSelectedId(undefined)} onStatus={updateStatus} onQualification={updateQualification} onReassign={reassign} onEditDetails={editLeadDetails} onReportIncorrect={reportIncorrect} onDecision={decideReview} /> : <section className="inbox-layout"><LeadTable leads={visible} onSelect={select} onCreate={() => setShowCreate(true)} /></section>)}
      {page === 'Follow-ups' && <FollowUpList leads={visible} viewer={viewer} onSelect={select} onComplete={completeFollowUp} />}
      {page === 'Assignments' && <AssignmentList leads={visible} onSelect={select} />}
      {page === 'Review queue' && <ReviewQueue leads={leads.filter((lead) => lead.incorrectReview?.state === 'pending')} onSelect={select} />}
      {page === 'Reports' && <Reports dashboard={dashboard} viewer={viewer} duplicates={duplicateCount} />}
      {page === 'Benchmark Board' && canViewManagementBoards(viewer) && <BenchmarkBoard leads={dashboardLeads} />}
      {page === 'Leaderboard' && <Leaderboard leads={dashboardLeads} privateBenchmarkLeads={leads} viewer={viewer} scope={dashboardScope} />}
      {page === 'Data quality' && canViewDataQualityBoard(viewer) && <DataQualityBoard leads={dashboardLeads} range={selectedRange} source={dashboardSource} />}
      {page === 'Xaviar' && <XaviarWorkspace leads={leads} viewer={viewer} />}
      {page === 'User management' && viewer.role === 'admin' && session && <AdminUserManagement session={session} onNotice={setNotice} />}
      </>}
    </section>
    {showCreate && <CreateLead viewer={viewer} onClose={() => setShowCreate(false)} onSubmit={createLead} />}
  </main>;
}

function UnifiedPageHeader({ page, viewer, viewers, theme, onViewer, onTheme }: { page: string; viewer: User; viewers: User[]; theme: 'light' | 'dark'; onViewer: (viewerId: string) => void; onTheme: (value: 'light' | 'dark') => void }) {
  return <header className="admin-reference-topbar unified-page-topbar"><div><p className="eyebrow">ELEVANTA AI / CRM WORKSPACE</p><h1>{page}</h1></div><div className="admin-reference-controls"><RoleSwitcher viewer={viewer} viewers={viewers} onViewer={onViewer} /><div className="admin-reference-theme" role="group" aria-label="Appearance"><span><IconMoonStars size={14} /> Dark</span><button type="button" aria-label="Toggle dark mode" aria-pressed={theme === 'dark'} onClick={() => onTheme(theme === 'dark' ? 'light' : 'dark')}><i /></button><span><IconSun size={14} /> Light</span></div><div className="admin-reference-avatar" aria-label={`${viewer.name} profile`}>{initialsFor(viewer.name)}</div></div></header>;
}

function AuthGate() {
  const [state, setState] = useState<AuthState>({ session: null, loading: authEnabled });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<'sign_in' | 'forgot' | 'reset'>('sign_in');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!authEnabled || !supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data, error }) => { if (active) setState({ session: data.session, loading: false, error: error?.message }); });
    const { data } = supabase.auth.onAuthStateChange((event, session) => { if (event === 'PASSWORD_RECOVERY') setMode('reset'); setState({ session, loading: false }); });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  if (!authEnabled || !supabase) return <WorkspaceApp />;
  if (state.loading) return <main className="auth-shell"><article className="auth-card"><span className="spark">ELEVANTA AI</span><h1>Loading your workspace…</h1><p>Checking your secure session.</p></article></main>;
  if (state.session && mode === 'reset') return <PasswordReset session={state.session} onComplete={() => { setMode('sign_in'); setState({ session: null, loading: false }); }} />;
  if (state.session) return <WorkspaceApp session={state.session} onSignOut={() => { void supabase!.auth.signOut(); }} />;

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSubmitting(true); setState((current) => ({ ...current, error: undefined }));
    const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setState((current) => ({ ...current, loading: false, error: error.message }));
    setSubmitting(false);
  }
  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSubmitting(true); setState((current) => ({ ...current, error: undefined })); setMessage('');
    const { error } = await supabase!.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
    if (error) setState((current) => ({ ...current, loading: false, error: error.message })); else setMessage('If that email belongs to an approved account, a password-reset link has been sent. Check your inbox and spam folder.');
    setSubmitting(false);
  }
  return <main className="auth-shell"><article className="auth-card"><span className="spark">✦ ELEVANTA AI</span>{mode === 'forgot' ? <><h1>Reset your password</h1><p>Enter your work email and we’ll send a secure reset link.</p><form className="stack-form auth-form" onSubmit={requestReset}><label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>{state.error && <p className="form-error" role="alert">{state.error}</p>}{message && <p className="success-chip" role="status">{message}</p>}<button className="primary" type="submit" disabled={submitting}>{submitting ? 'Sending…' : 'Send reset link'}</button><button className="quiet" type="button" onClick={() => { setMode('sign_in'); setMessage(''); }}>Back to sign in</button></form></> : <><h1>Sign in to your CRM</h1><p>Use your approved company account. Access is controlled by your CRM role and manager relationship.</p><form className="stack-form auth-form" onSubmit={signIn}><label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{state.error && <p className="form-error" role="alert">{state.error}</p>}<button className="primary" type="submit" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button><button className="quiet" type="button" onClick={() => { setMode('forgot'); setState((current) => ({ ...current, error: undefined })); }}>Forgot password?</button></form></>}</article></main>;
}

function PasswordReset({ session, onComplete }: { session: Session; onComplete: () => void }) {
  const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState(''); const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(''); if (password.length < 8) return setError('Password must be at least 8 characters.'); if (password !== confirmation) return setError('Passwords do not match.'); setSaving(true); const { error: updateError } = await supabase!.auth.updateUser({ password }); if (updateError) setError(updateError.message); else { await supabase!.auth.signOut(); onComplete(); } setSaving(false); }
  return <main className="auth-shell"><article className="auth-card"><span className="spark">✦ ELEVANTA AI</span><h1>Choose a new password</h1><p>Your reset link is valid. Create a new password, then sign in again.</p><form className="stack-form auth-form" onSubmit={submit}><label>New password<input type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></label><label>Confirm new password<input type="password" autoComplete="new-password" minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Set new password'}</button></form><small>For security, your current session will be signed out after the password changes.</small></article></main>;
}

export function App() { return <AuthGate />; }

function LeadTable({ leads, onSelect, onCreate, onViewAll }: { leads: Lead[]; onSelect: (id: string) => void; onCreate: () => void; onViewAll?: () => void }) { return <article className="panel leads-panel"><div className="panel-heading"><div><span className="eyebrow">LEAD INBOX <em className="preview-badge">Action queue</em></span><h2>Ready for the next action</h2><p>Use status, ownership, and the next follow-up to decide what to do next.</p></div><div className="lead-table-actions"><button className="primary" onClick={onCreate}>Add lead</button>{onViewAll && <button className="quiet" onClick={onViewAll}>View all leads <IconArrowUpRight size={15} /></button>}</div></div><div className="lead-table"><div className="lead-row header"><span>Lead</span><span>Owner</span><span>Status</span><span>Next action</span></div>{leads.length ? leads.map((lead) => { const next = lead.followUps.find((followUp) => followUp.status === 'open'); return <button className="lead-row lead-button" key={lead.id} onClick={() => onSelect(lead.id)}><strong><span className="lead-identity"><span className="avatar avatar-lead">{initialsFor(lead.name)}</span><span>{lead.name}<small>{lead.source}</small></span></span></strong><span className="owner-identity"><span className="avatar">{initialsFor(nameFor(ownerId(lead)))}</span>{nameFor(ownerId(lead))}</span><span className={`status ${lead.status}`}>{statusLabels[lead.status]}</span><span>{relativeDue(next)}</span></button>; }) : <p className="empty">No leads are visible for this user.</p>}</div></article>; }

const dashboardPeriodLabels: Record<DashboardPeriod, string> = { daily: 'Today', weekly: 'This week', monthly: 'This month', yearly: 'This year', lifetime: 'Lifetime', custom: 'Custom range' };
function DashboardFilters({ period, source, status, teamMember, customStart, customEnd, scope, viewer, canChooseScope, onPeriod, onSource, onStatus, onTeamMember, onCustomStart, onCustomEnd, onScope }: { period: DashboardPeriod; source: string; status: 'all' | OpportunityStatus; teamMember: string; customStart: string; customEnd: string; scope: DashboardScope; viewer: User; canChooseScope: boolean; onPeriod: (period: DashboardPeriod) => void; onSource: (source: string) => void; onStatus: (status: 'all' | OpportunityStatus) => void; onTeamMember: (userId: string) => void; onCustomStart: (value: string) => void; onCustomEnd: (value: string) => void; onScope: (scope: DashboardScope) => void }) {
  const members = viewer.role === 'admin'
    ? users.filter((user) => scope === 'marketing' ? user.role === 'marketer' : scope === 'sales' ? user.role === 'sales_agent' : user.role === 'marketer' || user.role === 'sales_agent')
    : viewer.role === 'manager' ? users.filter((user) => user.role === 'sales_agent' && user.managerId === viewer.id)
      : [];
  const memberLabel = scope === 'marketing' ? 'Marketing agent' : scope === 'sales' ? 'Sales agent' : 'Agent / marketer';
  return <section className="dashboard-filters" aria-label="Dashboard filters"><div><span className="eyebrow">DASHBOARD FILTERS</span><p>Lead volume uses the lead-created date. Every filter applies to the cards, graphs, and boards in this view.</p></div>{canChooseScope && <label>View<select value={scope} onChange={(event) => onScope(event.target.value as DashboardScope)}><option value="company">Company</option><option value="marketing">Marketing department</option><option value="sales">Sales department</option></select></label>}<label>Period<select value={period} onChange={(event) => onPeriod(event.target.value as DashboardPeriod)}>{(Object.keys(dashboardPeriodLabels) as DashboardPeriod[]).map((option) => <option value={option} key={option}>{dashboardPeriodLabels[option]}</option>)}</select></label><label>Source<select value={source} onChange={(event) => onSource(event.target.value)}><option value="all">All sources</option>{sourceOptions.map((option) => <option value={option} key={option}>{option}</option>)}</select></label><label>Status<select value={status} onChange={(event) => onStatus(event.target.value as 'all' | OpportunityStatus)}><option value="all">All statuses</option>{statusOptions.map((option) => <option value={option} key={option}>{statusLabels[option]}</option>)}</select></label>{members.length > 1 && <label>{memberLabel}<select value={teamMember} onChange={(event) => onTeamMember(event.target.value)}><option value="all">All {memberLabel.toLowerCase()}s</option>{members.map((member) => <option value={member.id} key={member.id}>{member.name}</option>)}</select></label>}{period === 'custom' && <><label>From<input type="date" value={customStart} onChange={(event) => onCustomStart(event.target.value)} /></label><label>To<input type="date" value={customEnd} onChange={(event) => onCustomEnd(event.target.value)} /></label></>}</section>;
}

const intelligenceClosedStatuses: OpportunityStatus[] = ['won', 'lost', 'not_interested', 'incorrect', 'duplicate', 'do_not_contact'];
const intelligenceDate = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const countVisible = (leads: Lead[], predicate: (lead: Lead) => boolean) => leads.filter(predicate).length;

function intelligenceStages(leads: Lead[], dashboard: ReturnType<typeof dashboardFor>) {
  const stages = [
    { label: 'Open', value: dashboard.open },
    { label: 'MQL', value: dashboard.mql },
    { label: 'SQL', value: dashboard.sql },
    { label: 'Proposal', value: countVisible(leads, (lead) => lead.status === 'proposal_sent') },
    { label: 'Won', value: dashboard.won },
  ];
  return stages.map((stage, index) => ({ ...stage, conversion: index === 0 ? 100 : stages[index - 1].value ? Math.round((stage.value / stages[index - 1].value) * 100) : 0 }));
}

function intelligenceHistory(leads: Lead[]) {
  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - (13 - index));
    return { key: date.toDateString(), date: intelligenceDate.format(date), activity: 0 };
  });
  const positions = new Map(days.map((day, index) => [day.key, index]));
  leads.flatMap((lead) => lead.activities).forEach((activity) => { const index = positions.get(new Date(activity.at).toDateString()); if (index !== undefined) days[index].activity += 1; });
  leads.flatMap((lead) => lead.followUps).forEach((followUp) => { const index = positions.get(new Date(followUp.dueAt).toDateString()); if (index !== undefined) days[index].activity += 1; });
  return days;
}

function intelligenceMatrix(leads: Lead[]) {
  return leads.filter((lead) => !intelligenceClosedStatuses.includes(lead.status)).map((lead) => {
    const followUp = lead.followUps.find((item) => item.status === 'open');
    const timeUntilDue = followUp ? new Date(followUp.dueAt).getTime() - Date.now() : 4 * 86_400_000;
    const urgency = followUp ? timeUntilDue < 0 ? 92 : timeUntilDue < 86_400_000 ? 78 : Math.max(28, 64 - Math.round(timeUntilDue / 86_400_000) * 8) : 30;
    const highValue = lead.priority >= 4 || (lead.totalProjectCost ?? 0) >= 5000;
    const highLikelihood = ['connected', 'qualified', 'proposal_sent'].includes(lead.status) || lead.qualification === 'sql';
    return { name: lead.name, x: urgency, y: Math.max(20, lead.priority * 18), z: 100, quadrant: highValue ? highLikelihood ? 'High value · High likelihood' : 'High value · Lower likelihood' : highLikelihood ? 'Lower value · High likelihood' : 'Lower value · Lower likelihood' };
  });
}

function intelligenceCopy(viewer: User, dashboard: ReturnType<typeof dashboardFor>, scope: DashboardScope) {
  if (viewer.role === 'admin' && scope === 'marketing') return { title: 'Marketing department intelligence', subtitle: 'See lead quality, routing, acceptance, and downstream outcomes for the marketing team.', risk: dashboard.overdue ? `${dashboard.overdue} routed lead follow-up${dashboard.overdue === 1 ? '' : 's'} need attention.` : 'No overdue follow-ups are visible for Marketing-routed leads.', strength: `${dashboard.mql + dashboard.sql} MQL/SQL decisions are visible in this marketing view.` };
  if (viewer.role === 'admin' && scope === 'sales') return { title: 'Sales department intelligence', subtitle: 'See sales movement, conversion, follow-up risk, and closing performance.', risk: dashboard.overdue ? `${dashboard.overdue} sales follow-up${dashboard.overdue === 1 ? '' : 's'} need attention.` : 'No overdue sales follow-ups are visible.', strength: `${dashboard.open} active opportunities are currently in the sales pipeline.` };
  if (viewer.role === 'marketer') return { title: 'Lead quality intelligence', subtitle: 'See how your lead quality is translating into Sales-ready conversations.', risk: dashboard.mql + dashboard.sql ? 'Keep qualification notes specific so the team can learn which sources become SQL.' : 'Classify new leads as MQL or SQL to start measuring lead quality.', strength: `${dashboard.visible.length} visible lead${dashboard.visible.length === 1 ? '' : 's'} are attributed to your marketing work.` };
  if (viewer.role === 'sales_agent') return { title: 'My pipeline intelligence', subtitle: 'See where your active opportunities need the right next step.', risk: dashboard.overdue ? `${dashboard.overdue} follow-up${dashboard.overdue === 1 ? '' : 's'} are overdue. Resolve or reschedule them first.` : 'Keep a next follow-up date on every active opportunity.', strength: `${dashboard.conversionRate}% MQL/SQL-to-won conversion in this test workspace.` };
  if (viewer.role === 'manager') return { title: 'Team pipeline intelligence', subtitle: 'See team movement, focus intervention, and coach the next action.', risk: dashboard.overdue ? `${dashboard.overdue} team follow-up${dashboard.overdue === 1 ? '' : 's'} need attention today.` : 'No overdue follow-ups are visible for your team.', strength: `${dashboard.open} active opportunities are currently in the team pipeline.` };
  return { title: 'Pipeline intelligence', subtitle: 'Live visibility into pipeline health, performance, and what to focus on.', risk: dashboard.overdue ? `${dashboard.overdue} follow-up${dashboard.overdue === 1 ? '' : 's'} need attention before the risk grows.` : 'Follow-up timing is healthy across this test workspace.', strength: `${dashboard.open} active opportunities are visible across the company.` };
}

function PipelineIntelligence({ viewer, leads, dashboard, onSelect, period, scope }: { viewer: User; leads: Lead[]; dashboard: ReturnType<typeof dashboardFor>; onSelect: (leadId: string) => void; period: DashboardPeriod; scope: DashboardScope }) {
  const stages = intelligenceStages(leads, dashboard); const history = intelligenceHistory(leads); const matrix = intelligenceMatrix(leads); const copy = intelligenceCopy(viewer, dashboard, scope);
  const duplicates = duplicateMatches(leads).length;
  const healthScore = Math.max(0, Math.min(100, 100 - dashboard.overdue * 22 - dashboard.incorrectReview * 14 - duplicates * 8 + Math.min(10, dashboard.mql * 2 + dashboard.sql * 3)));
  const focusLead = leads.find((lead) => lead.followUps.some((item) => item.status === 'open' && relativeDue(item) === 'Overdue')) ?? leads.find((lead) => !intelligenceClosedStatuses.includes(lead.status));
  return <section className="intelligence" aria-label="Pipeline intelligence dashboard">
    <div className="intelligence-heading"><div><span className="eyebrow">ROLE PERFORMANCE</span><h2>{copy.title}</h2><p>{copy.subtitle}</p></div><div className="intelligence-period"><IconActivityHeartbeat size={17} /> {dashboardPeriodLabels[period]}</div></div>
    <article className="pipeline-conversion" aria-label="Pipeline conversion graph"><div className="pipeline-conversion-heading"><div><span className="eyebrow">PIPELINE CONVERSION</span><h3>See where momentum is being lost</h3></div><span>{dashboard.open + dashboard.won} opportunities in view</span></div><div className="pipeline-stage-row">{stages.map((stage, index) => <div className="pipeline-stage-summary" key={stage.label}><span>{stage.label}</span><strong>{stage.value}</strong><small>{index === 0 ? 'Current active work' : `${stage.conversion}% of previous`}</small></div>)}</div><div className="pipeline-chart" role="img" aria-label={`Pipeline conversion: ${stages.map((stage) => `${stage.label} ${stage.value}`).join(', ')}`}><ResponsiveContainer width="100%" height="100%"><AreaChart data={stages} margin={{ top: 14, right: 14, left: 14, bottom: 4 }}><defs><linearGradient id="pipelineConversionFill" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="var(--chart-series)" stopOpacity={.88} /><stop offset="56%" stopColor="var(--chart-series-blue)" stopOpacity={.72} /><stop offset="100%" stopColor="var(--chart-series-cyan)" stopOpacity={.25} /></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 6" /><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} /><YAxis hide domain={[0, 'dataMax']} /><Tooltip cursor={{ stroke: 'var(--accent)', strokeWidth: 1 }} contentStyle={{ borderRadius: 12, borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)', boxShadow: '0 16px 36px var(--chart-shadow)' }} /><Area type="monotone" dataKey="value" stroke="var(--chart-series)" strokeWidth={3} fill="url(#pipelineConversionFill)" activeDot={{ r: 5, fill: 'var(--chart-series-cyan)', stroke: 'var(--surface)', strokeWidth: 2 }} /></AreaChart></ResponsiveContainer></div></article>
    <div className="intelligence-grid"><article className="trend-panel"><div className="visual-heading"><div><h3>Activity over the last 14 days</h3><p>Recorded notes, status changes, assignments, and scheduled follow-ups.</p></div><span className="conversion-stat"><b>{dashboard.conversionRate}%</b> MQL/SQL to won</span></div><div className="area-chart" role="img" aria-label="CRM activity over the last 14 days"><ResponsiveContainer width="100%" height="100%"><AreaChart data={history} margin={{ top: 12, right: 8, left: -22, bottom: 0 }}><defs><linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-series-cyan)" stopOpacity={.3} /><stop offset="100%" stopColor="var(--chart-series-cyan)" stopOpacity={.02} /></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--chart-grid)" /><XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 10 }} interval="preserveStartEnd" /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 10 }} /><Tooltip cursor={{ stroke: 'var(--chart-series-cyan)', strokeWidth: 1 }} contentStyle={{ borderRadius: 10, borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)', boxShadow: '0 10px 25px var(--chart-shadow)' }} /><Area type="monotone" dataKey="activity" stroke="var(--chart-series-cyan)" strokeWidth={3} fill="url(#activityFill)" activeDot={{ r: 5, fill: 'var(--chart-series-cyan)' }} /></AreaChart></ResponsiveContainer></div><div className="trend-summary"><span><b>{leads.flatMap((lead) => lead.activities).length}</b> recorded activities</span><span><b>{dashboard.open}</b> active opportunities</span><span><b>{dashboard.overdue}</b> overdue follow-ups</span></div></article>
      <aside className="intelligence-aside"><article className="health-panel"><div><span className="eyebrow">PIPELINE HEALTH</span><h3>{healthScore}<small>/100</small></h3><p>{healthScore >= 75 ? 'On track' : healthScore >= 50 ? 'Needs attention' : 'Action needed'}</p></div><div className="health-ring"><ResponsiveContainer width="100%" height="100%"><RadialBarChart innerRadius="69%" outerRadius="95%" startAngle={90} endAngle={-270} data={[{ value: healthScore }]}><RadialBar dataKey="value" cornerRadius={8} fill="var(--success)" background={{ fill: 'var(--chart-ring-track)' }} /></RadialBarChart></ResponsiveContainer><IconChartPieFilled size={25} /></div></article><article className="coaching-panel"><span className="xaviar-label">✦ XAVIAR COACHING</span><h3>Focus for maximum impact</h3><div className="coach-item risk"><IconAlertTriangle size={18} /><div><small>Risk to address</small><b>{copy.risk}</b></div></div><div className="coach-item strength"><IconCircleCheck size={18} /><div><small>Strength to build on</small><b>{copy.strength}</b></div></div></article></aside></div>
    <article className="matrix-panel"><div className="visual-heading"><div><h3>Opportunity matrix</h3><p>Prioritise high-impact, high-urgency opportunities first.</p></div><div className="matrix-legend"><span><i className="dot high" /> High impact</span><span><i className="dot risk" /> Needs attention</span></div></div><div className="matrix-layout"><div className="matrix-scale"><span>Impact</span><b>High</b><small>Low</small></div><div className="matrix-chart"><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 16, right: 28, bottom: 24, left: 6 }}><CartesianGrid strokeDasharray="4 4" stroke="var(--chart-grid)" /><XAxis type="number" dataKey="x" name="Urgency" domain={[0, 100]} tick={false} axisLine={{ stroke: 'var(--chart-axis)' }} label={{ value: 'Urgency', position: 'bottom', fill: 'var(--muted)', fontSize: 11 }} /><YAxis type="number" dataKey="y" name="Impact" domain={[0, 100]} tick={false} axisLine={{ stroke: 'var(--chart-axis)' }} /><ZAxis type="number" dataKey="z" range={[80, 160]} /><Tooltip cursor={{ strokeDasharray: '4 4' }} contentStyle={{ borderRadius: 10, borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)', boxShadow: '0 10px 25px var(--chart-shadow)' }} formatter={(_value, _name, item) => item.payload?.name} /><Scatter name="Opportunities" data={matrix} fill="var(--chart-series-cyan)"><LabelList dataKey="name" position="right" fill="var(--text)" fontSize={11} /></Scatter></ScatterChart></ResponsiveContainer></div>{focusLead ? <button className="matrix-focus" onClick={() => onSelect(focusLead.id)}><IconTargetArrow size={25} /><span><small>Focus here</small><b>{focusLead.name}</b><em>{focusLead.status === 'follow_up_required' ? 'Follow-up is required' : 'Open lead needs its next step'}</em></span><IconArrowUpRight size={18} /></button> : <div className="matrix-focus empty-focus"><IconTargetArrow size={25} /><span><small>Focus here</small><b>No open opportunities</b><em>Create or assign a lead to populate the matrix.</em></span></div>}</div></article>
  </section>;
}

type ChartDatum = { label: string; value: number; tone?: 'teal' | 'green' | 'red' | 'amber' };
function chartCount(leads: Lead[], predicate: (lead: Lead) => boolean) { return leads.filter(predicate).length; }
function reachedStatus(lead: Lead, status: OpportunityStatus) { return lead.status === status || lead.stageHistory?.some((stage) => stage.toStatus === status); }
function followUpHealth(leads: Lead[]) {
  const openFollowUps = leads.flatMap((lead) => lead.followUps).filter((followUp) => followUp.status === 'open');
  const dueToday = openFollowUps.filter((followUp) => relativeDue(followUp) === 'Today').length;
  const overdue = openFollowUps.filter((followUp) => relativeDue(followUp) === 'Overdue').length;
  return [{ label: 'On track', value: Math.max(0, openFollowUps.length - dueToday - overdue), tone: 'green' as const }, { label: 'Due today', value: dueToday, tone: 'amber' as const }, { label: 'Overdue', value: overdue, tone: 'red' as const }];
}
function funnelData(leads: Lead[]): ChartDatum[] { return [
  { label: 'MQL', value: chartCount(leads, (lead) => lead.qualification === 'mql'), tone: 'teal' },
  { label: 'SQL', value: chartCount(leads, (lead) => lead.qualification === 'sql'), tone: 'teal' },
  { label: 'Won', value: chartCount(leads, (lead) => lead.status === 'won'), tone: 'green' },
  { label: 'Lost', value: chartCount(leads, (lead) => lead.status === 'lost'), tone: 'red' },
]; }
function pipelineData(leads: Lead[]): ChartDatum[] { return [
  { label: 'New / assigned', value: chartCount(leads, (lead) => lead.status === 'new' || lead.status === 'assigned'), tone: 'teal' },
  { label: 'Contacted', value: chartCount(leads, (lead) => lead.status === 'contacted'), tone: 'teal' },
  { label: 'Connected', value: chartCount(leads, (lead) => lead.status === 'connected'), tone: 'green' },
  { label: 'Follow-up', value: chartCount(leads, (lead) => lead.status === 'follow_up_required'), tone: 'amber' },
  { label: 'Proposal sent', value: chartCount(leads, (lead) => lead.status === 'proposal_sent'), tone: 'teal' },
]; }
function riskData(leads: Lead[]): ChartDatum[] { const health = followUpHealth(leads); return [
  { label: 'Overdue', value: health.find((datum) => datum.label === 'Overdue')?.value ?? 0, tone: 'red' },
  { label: 'Due today', value: health.find((datum) => datum.label === 'Due today')?.value ?? 0, tone: 'amber' },
  { label: 'Incorrect', value: chartCount(leads, (lead) => lead.status === 'incorrect'), tone: 'amber' },
  { label: 'Duplicates', value: duplicateMatches(leads).length, tone: 'red' },
]; }
function sourceMix(leads: Lead[]): ChartDatum[] { const values = new Map<string, number>(); leads.forEach((lead) => values.set(lead.source, (values.get(lead.source) ?? 0) + 1)); return [...values.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, value]) => ({ label: label.length > 18 ? `${label.slice(0, 17)}…` : label, value, tone: 'teal' as const })); }
function dashboardPersona(viewer: User, scope: DashboardScope) {
  if (viewer.role === 'admin' && scope === 'marketing') return { eyebrow: 'MARKETING MANAGER VIEW', title: 'Improve lead quality before it reaches Sales', subtitle: 'Start with the quality queue, then use source and acceptance evidence to coach the team.' };
  if (viewer.role === 'admin' && scope === 'sales') return { eyebrow: 'SALES MANAGER VIEW', title: 'Keep the team moving toward Won', subtitle: 'Prioritize uncontacted handoffs, overdue work, stalled proposals, and loss patterns.' };
  if (viewer.role === 'admin') return { eyebrow: 'COMPANY COMMAND CENTER', title: 'See the business, then decide what moves next', subtitle: 'A company view of marketing quality, sales execution, operating risk, and recognition.' };
  if (viewer.role === 'manager' && viewer.department === 'marketing') return { eyebrow: 'MARKETING MANAGER VIEW', title: 'Improve lead quality before it reaches Sales', subtitle: 'Coach the team from source quality, routing speed, acceptance, and downstream outcomes.' };
  if (viewer.role === 'manager') return { eyebrow: 'SALES MANAGER VIEW', title: 'Keep the team moving toward Won', subtitle: 'Focus the team on timely contact, disciplined follow-up, proposals, and recoverable losses.' };
  if (viewer.role === 'marketer') return { eyebrow: 'MARKETING AGENT', title: 'Create better opportunities for Sales', subtitle: 'Add leads quickly, fix quality risks, and learn which sources become actionable.' };
  return { eyebrow: 'SALES AGENT', title: 'Make the next best follow-up', subtitle: 'Work the priority queue, connect with prospects, and learn from every loss.' };
}
function DashboardHero({ viewer, leads, scope, onCreate, onViewAll }: { viewer: User; leads: Lead[]; scope: DashboardScope; onCreate: () => void; onViewAll: () => void }) {
  const persona = dashboardPersona(viewer, scope);
  const open = leads.filter((lead) => !['won', 'lost', 'not_interested', 'incorrect', 'duplicate', 'do_not_contact'].includes(lead.status));
  const overdueCount = leads.flatMap((lead) => lead.followUps).filter((followUp) => followUp.status === 'open' && relativeDue(followUp) === 'Overdue').length;
  const dueTodayCount = leads.flatMap((lead) => lead.followUps).filter((followUp) => followUp.status === 'open' && relativeDue(followUp) === 'Today').length;
  const uncontacted = leads.filter((lead) => lead.assignments.length > 0 && !reachedStatus(lead, 'contacted')).length;
  const stalledProposals = leads.filter((lead) => lead.status === 'proposal_sent' && stageAgeLabel(lead) !== '0h').length;
  const qualityRisks = leads.filter((lead) => lead.status === 'incorrect' || lead.status === 'duplicate' || !lead.assignments.length).length;
  const actionable = leads.filter((lead) => reachedStatus(lead, 'contacted') || lead.qualification !== 'not_available' || lead.status === 'won').length;
  const tasks = viewer.role === 'marketer' || (viewer.role === 'admin' && scope === 'marketing') ? [
    { label: 'Quality queue', value: qualityRisks, note: 'duplicate, incorrect, or unrouted', tone: 'warning' },
    { label: 'Actionable yield', value: leads.length ? `${Math.round((actionable / leads.length) * 100)}%` : 'Not available', note: `${actionable}/${leads.length} leads progressed`, tone: 'success' },
    { label: 'MQL / SQL', value: `${leads.filter((lead) => lead.qualification === 'mql').length} / ${leads.filter((lead) => lead.qualification === 'sql').length}`, note: 'qualification decisions recorded', tone: 'accent' },
  ] : viewer.role === 'sales_agent' || viewer.role === 'manager' || (viewer.role === 'admin' && scope === 'sales') ? [
    { label: 'Overdue', value: overdueCount, note: 'follow-ups needing action', tone: overdueCount ? 'danger' : 'success' },
    { label: 'Due today', value: dueTodayCount, note: 'scheduled next actions', tone: 'warning' },
    { label: 'Uncontacted', value: uncontacted, note: 'assigned leads without contact', tone: uncontacted ? 'danger' : 'success' },
  ] : [
    { label: 'Open pipeline', value: open.length, note: 'active opportunities', tone: 'accent' },
    { label: 'Operating risk', value: overdueCount + qualityRisks, note: 'overdue work and quality exceptions', tone: overdueCount + qualityRisks ? 'warning' : 'success' },
    { label: 'Won', value: leads.filter((lead) => lead.status === 'won').length, note: 'closed opportunities in view', tone: 'success' },
  ];
  return <section className="dashboard-hero" aria-label={`${persona.eyebrow} dashboard overview`}><div className="dashboard-hero-copy"><span className="eyebrow">{persona.eyebrow}</span><h2>{persona.title}</h2><p>{persona.subtitle}</p><div className="dashboard-hero-actions">{(viewer.role === 'marketer' || viewer.role === 'admin') && <button className="primary" onClick={onCreate}>Add lead</button>}<button className="quiet" onClick={onViewAll}>Open lead inbox <IconArrowUpRight size={15} /></button></div></div><div className="dashboard-task-grid">{tasks.map((task) => <article className={`dashboard-task task-${task.tone}`} key={task.label}><span>{task.label}</span><strong>{task.value}</strong><small>{task.note}</small></article>)}</div>{stalledProposals > 0 && (viewer.role === 'sales_agent' || viewer.role === 'manager' || scope === 'sales') && <div className="dashboard-alert"><IconAlertTriangle size={16} /><span><b>{stalledProposals} proposal{stalledProposals === 1 ? '' : 's'} need a next action.</b> Review the opportunity and schedule the next follow-up.</span></div>}</section>;
}
function RoleScorecards({ viewer, leads, scope }: { viewer: User; leads: Lead[]; scope: DashboardScope }) {
  const marketingView = viewer.role === 'marketer' || (viewer.role === 'admin' && scope === 'marketing');
  const salesView = viewer.role === 'sales_agent' || viewer.role === 'manager' || (viewer.role === 'admin' && scope === 'sales');
  const valid = leads.filter((lead) => lead.status !== 'duplicate' && lead.incorrectReview?.state !== 'confirmed_incorrect' && lead.incorrectReview?.state !== 'merge_duplicate');
  const accepted = valid.filter((lead) => lead.assignments.length > 0).length;
  const actionable = valid.filter((lead) => reachedStatus(lead, 'contacted') || reachedStatus(lead, 'connected') || lead.qualification !== 'not_available' || reachedStatus(lead, 'proposal_sent') || lead.status === 'won').length;
  const mqlSql = valid.filter((lead) => lead.qualification !== 'not_available').length;
  const connected = valid.filter((lead) => reachedStatus(lead, 'connected')).length;
  const proposals = valid.filter((lead) => reachedStatus(lead, 'proposal_sent')).length;
  const won = valid.filter((lead) => lead.status === 'won').length;
  const response = median(valid.map(responseHours));
  const routing = median(valid.map(routingHours));
  const financial = financialMetrics(valid);
  const lost = valid.filter((lead) => lead.status === 'lost' || lead.status === 'not_interested').length;
  const rate = (value: number, total: number) => total ? `${Math.round((value / total) * 100)}%` : 'Not available';
  const cards = marketingView ? [
    ['Actionable lead yield', rate(actionable, valid.length), `${actionable}/${valid.length} valid leads progressed`],
    ['Sales acceptance', rate(accepted, valid.length), `${accepted}/${valid.length} leads routed to Sales`],
    ['MQL / SQL quality', `${dashboardFor(viewer, valid).mql} / ${dashboardFor(viewer, valid).sql}`, `${mqlSql}/${valid.length} decisions recorded`],
    ['Median routing speed', routing === undefined ? 'Not available' : `${routing}h`, 'Lead creation to first sales assignment'],
    ['Downstream wins', rate(won, valid.length), 'Won opportunities from your marketing work'],
  ] : salesView ? [
    ['Connection rate', rate(connected, valid.length), `${connected}/${valid.length} visible opportunities connected`],
    ['Median response speed', response === undefined ? 'Not available' : `${response}h`, 'Assignment to first Contacted/Connected event'],
    ['Proposal → Won', rate(won, proposals), `${won}/${proposals} proposal opportunities won`],
    ['Lost prospects', String(lost), 'Lost or Not Interested opportunities'],
    ['Project value', financial.financialRecordCount ? String(financial.totalProjectValue) : 'Not available', `${financial.financialRecordCount} Won records with cost`],
  ] : [
    ['Valid opportunities', String(valid.length), 'Duplicate and confirmed Incorrect excluded'],
    ['MQL / SQL', `${dashboardFor(viewer, valid).mql} / ${dashboardFor(viewer, valid).sql}`, 'Qualification decisions recorded'],
    ['Connection rate', rate(connected, valid.length), `${connected}/${valid.length} visible opportunities connected`],
    ['Proposal → Won', rate(won, proposals), `${won}/${proposals} proposal opportunities won`],
    ['Total project value', financial.financialRecordCount ? String(financial.totalProjectValue) : 'Not available', `${financial.financialRecordCount} Won records with cost`],
  ];
  const scorecardIcons = [IconActivityHeartbeat, IconTargetArrow, IconChartPieFilled, IconCircleCheck, IconArrowUpRight];
  return <section className="quality-summary role-scorecards" aria-label="Role dashboard scorecards">{cards.map(([label, value, note], index) => { const Icon = scorecardIcons[index % scorecardIcons.length]; return <article className={`scorecard-card scorecard-${index + 1}`} key={label}><span className="scorecard-icon"><Icon size={21} stroke={1.8} /></span><div className="scorecard-copy"><span>{label}</span><b>{value}</b><small><i />{note}</small></div></article>; })}</section>;
}

function RoleCharts({ viewer, leads, dashboard, scope }: { viewer: User; leads: Lead[]; dashboard: ReturnType<typeof dashboardFor>; scope: DashboardScope }) {
  const qualityRate = leads.length ? Math.round(((dashboard.mql + dashboard.sql) / leads.length) * 100) : 0;
  const conversionBase = dashboard.won + chartCount(leads, (lead) => lead.status === 'lost');
  const closeRate = conversionBase ? Math.round((dashboard.won / conversionBase) * 100) : 0;
  const ownerData = users.filter((user) => user.role === 'sales_agent').map((user) => ({ label: user.name, value: chartCount(leads, (lead) => ownerId(lead) === user.id), tone: 'teal' as const })).filter((datum) => datum.value > 0);
  const sourceData = users.filter((user) => user.role === 'marketer').map((user) => ({ label: user.name, value: chartCount(leads, (lead) => lead.marketingOwnerId === user.id), tone: 'teal' as const })).filter((datum) => datum.value > 0);
  const outcomeData: ChartDatum[] = [
    { label: 'Won', value: dashboard.won, tone: 'green' },
    { label: 'Lost', value: chartCount(leads, (lead) => lead.status === 'lost'), tone: 'red' },
    { label: 'Incorrect', value: chartCount(leads, (lead) => lead.status === 'incorrect'), tone: 'amber' },
    { label: 'Active', value: dashboard.open, tone: 'teal' },
  ];
  const isMarketer = viewer.role === 'marketer' || (viewer.role === 'admin' && scope === 'marketing'); const isSales = viewer.role === 'sales_agent'; const isManager = viewer.role === 'manager' || (viewer.role === 'admin' && scope === 'sales');
  const marketingTeamView = viewer.role === 'admin' && scope === 'marketing';
  const firstTitle = isMarketer ? marketingTeamView ? 'Marketing team quality funnel' : 'Lead quality funnel' : isSales ? 'My conversion path' : isManager ? 'Team conversion path' : 'Company conversion path';
  const secondTitle = isMarketer ? marketingTeamView ? 'Marketing team outcomes' : 'Lead outcomes' : isSales ? 'My follow-up health' : isManager ? 'Agent workload' : 'Work distribution';
  const firstData = funnelData(leads);
  const secondData = isMarketer ? outcomeData : isSales ? followUpHealth(leads) : isManager ? ownerData : sourceData;
  const insight = isMarketer ? `${qualityRate}% of your visible leads are marked MQL or SQL. Improve the source and qualification notes when this falls.` : isSales ? `${closeRate}% of your closed MQL/SQL leads are won. Use loss reasons and notes to improve the next cycle.` : `${dashboard.overdue} overdue follow-up${dashboard.overdue === 1 ? '' : 's'} need attention across the leads you can manage.`;
  const detailOneTitle = isMarketer ? marketingTeamView ? 'Marketing team source mix' : 'My lead source mix' : isSales ? 'My leads by source' : isManager ? 'Team lead source mix' : 'Company lead source mix';
  const detailTwoTitle = isMarketer ? 'Quality risk watch' : isSales ? 'Lost reason analysis' : isManager ? 'Lost reason analysis' : 'Company revenue health';
  const detailOneData = sourceMix(leads);
  const losses = lossReasonBreakdown(leads).map(({ reason, count }) => ({ label: reason, value: count, tone: 'red' as const }));
  const financial = financialMetrics(leads);
  const detailTwoData = isMarketer ? riskData(leads) : isSales || isManager ? losses : [{ label: 'Project value', value: financial.totalProjectValue, tone: 'green' as const }, { label: 'Upfront value', value: financial.upfrontValue, tone: 'teal' as const }, { label: 'Won records', value: financial.financialRecordCount, tone: 'green' as const }];
  const detailTwoVariant = isMarketer || (!isSales && !isManager) ? 'column' : 'horizontal';
  return <section className="insight-section" aria-label="Role-specific performance graphs"><div className="insight-heading"><div><span className="eyebrow">ROLE PERFORMANCE</span><h2>What you are working toward</h2></div><p>{insight}</p></div><div className="insight-grid"><BarChart variant="column" title={firstTitle} subtitle={isMarketer ? 'Marketing-qualified and sales-qualified leads compared with final outcomes.' : 'Qualification movement and final outcomes from your visible leads.'} data={firstData} /><BarChart variant="horizontal" title={secondTitle} subtitle={isMarketer ? 'Use this to see whether lead quality turns into outcomes.' : isSales ? 'Follow-up timing is a controllable daily habit.' : isManager ? 'Shows where team capacity is currently allocated.' : 'Shows which marketer currently owns the visible lead flow.'} data={secondData} /></div><div className="insight-grid secondary-charts"><BarChart variant="horizontal" title={detailOneTitle} subtitle="Every source is shown separately so performance is never compared across unmatched acquisition routes." data={detailOneData} /><BarChart variant={detailTwoVariant} title={detailTwoTitle} subtitle={isMarketer ? 'Use this to identify quality issues before sending more leads to Sales.' : isSales ? 'Resolve risks before they become lost opportunities.' : 'Use this to prioritise intervention before the risk grows.'} data={detailTwoData} /></div></section>;
}

function DashboardBoards({ viewer, leads, scope }: { viewer: User; leads: Lead[]; scope: DashboardScope }) {
  const salesRows = leaderboardForSales(leads); const marketingRows = leaderboardForMarketing(leads); const management = canViewNamedLeaderboard(viewer);
  const ownSales = salesRows.find((row) => row.userId === viewer.id); const ownMarketing = marketingRows.find((row) => row.userId === viewer.id);
  const ownScore = viewer.role === 'marketer' ? ownMarketing?.actionableLeadYield : ownSales?.connectionRate;
  const ownSample = viewer.role === 'marketer' ? ownMarketing?.sampleSize : ownSales?.sampleSize;
  const benchmark = median((viewer.role === 'marketer' ? leaderboardForMarketing(seedLeads).map((row) => row.actionableLeadYield) : leaderboardForSales(seedLeads).map((row) => row.connectionRate)));
  const pendingReview = leads.filter((lead) => lead.incorrectReview?.state === 'pending').length;
  const duplicates = duplicateMatches(leads).length;
  const unassigned = leads.filter((lead) => !lead.assignments.length).length;
  const topRows = viewer.role === 'admin' && scope === 'company'
    ? [...salesRows.map((row) => ({ userId: row.userId, sampleSize: row.sampleSize, score: row.connectionRate })), ...marketingRows.map((row) => ({ userId: row.userId, sampleSize: row.sampleSize, score: row.actionableLeadYield }))].slice(0, 4)
    : (scope === 'marketing' ? marketingRows.map((row) => ({ userId: row.userId, sampleSize: row.sampleSize, score: row.actionableLeadYield })) : salesRows.map((row) => ({ userId: row.userId, sampleSize: row.sampleSize, score: row.connectionRate }))).slice(0, 4);
  return <section className="dashboard-boards" aria-label="Dashboard boards and operational watchlist">
    <div className="dashboard-boards-heading"><div><span className="eyebrow">DECISION SUPPORT</span><h2>{management ? 'Leaderboard and operating watchlist' : 'My benchmark and next focus'}</h2></div><p>Keep the next decision close to the evidence: performance, risk, and work that needs attention.</p></div>
    <div className="dashboard-board-grid">
      <article className="panel board-preview"><div className="board-preview-heading"><div><span className="eyebrow">{management ? 'LEADERBOARD' : 'PRIVATE STANDING'}</span><h3>{management ? (viewer.role === 'admin' && scope === 'company' ? 'Top visible performers' : scope === 'marketing' ? 'Marketing team standing' : 'Sales team standing') : 'Your result vs team benchmark'}</h3></div><span className="board-chip">{management ? 'Named view' : 'Private'}</span></div>{management ? <div className="mini-ranking">{topRows.length ? topRows.map((row) => <div key={row.userId} className="mini-ranking-row"><b>{nameFor(row.userId)}</b><span>{row.sampleSize} leads</span><strong>{percent(row.score)}</strong></div>) : <p className="empty">Not enough data to rank this team.</p>}</div> : <div className="personal-standing"><div><small>My sample</small><b>{ownSample ?? 'Not enough data'}</b></div><div><small>My score</small><b>{percent(ownScore)}</b></div><div><small>Team benchmark</small><b>{percent(benchmark)}</b></div></div>}</article>
      <article className="panel watchlist-preview"><div className="board-preview-heading"><div><span className="eyebrow">OPERATING WATCHLIST</span><h3>What needs attention</h3></div><span className="board-chip">Live</span></div><div className="watchlist-grid"><div><b>{pendingReview}</b><span>Review queue</span></div><div><b>{duplicates}</b><span>Duplicate candidates</span></div><div><b>{unassigned}</b><span>Unassigned leads</span></div><div><b>{leads.filter((lead) => lead.followUps.some((item) => item.status === 'open' && relativeDue(item) === 'Overdue')).length}</b><span>Overdue follow-ups</span></div></div></article>
    </div>
  </section>;
}

function AdminReferenceSidebar({ viewer, activePage, onNavigate, onReset, onSignOut }: { viewer: User; activePage: string; onNavigate: (page: string) => void; onReset: () => void; onSignOut?: () => void }) {
  const icons: Record<string, typeof IconHome> = { Dashboard: IconHome, 'Lead inbox': IconUsers, 'Follow-ups': IconChecklist, Assignments: IconTarget, Reports: IconReportAnalytics, 'Benchmark Board': IconChartBar, Leaderboard: IconTrophy, 'Data quality': IconCircleCheck, 'Review queue': IconFlag, 'User management': IconUserCircle, Xaviar: IconRobot };
  const primary = navigationFor(viewer).map((item) => [item.label, icons[item.page] ?? IconHome, item.page] as const);
  return <div className="admin-reference-sidebar"><div className="admin-reference-brand"><IconSparkleMark /><span>Elevanta <b>AI</b></span></div><nav aria-label="Command center navigation">{primary.map(([label, Icon, page]) => <button key={label} className={page === activePage ? 'admin-reference-nav active' : 'admin-reference-nav'} aria-current={page === activePage ? 'page' : undefined} onClick={() => onNavigate(page)}><Icon size={20} stroke={1.8} /><span>{label}</span></button>)}</nav><div className="admin-reference-sidebar-bottom"><div className="admin-reference-profile"><span>{initialsFor(viewer.name)}</span><div><b>{viewer.name}</b><small>Company Admin</small></div><IconChevronDown size={15} /></div><div className="sidebar-session-actions"><button type="button" onClick={onReset}>Reset test data</button>{onSignOut && <button type="button" onClick={onSignOut}>Sign out</button>}</div></div></div>;
}

function IconSparkleMark() { return <IconSparkles className="admin-reference-spark" size={28} stroke={2.1} />; }

function AdminCommandCenter({ viewer, viewers, leads, dashboard, period, source, theme, onViewer, onPeriod, onSource, onTheme, onNavigate }: { viewer: User; viewers: User[]; leads: Lead[]; dashboard: ReturnType<typeof dashboardFor>; period: DashboardPeriod; source: string; theme: 'light' | 'dark'; onViewer: (viewerId: string) => void; onPeriod: (value: DashboardPeriod) => void; onSource: (value: string) => void; onTheme: (value: 'light' | 'dark') => void; onNavigate: (page: string) => void }) {
  const financial = financialMetrics(leads);
  const stages = [
    { name: 'Leads', value: leads.length, fill: '#8b5cf6' }, { name: 'MQL', value: dashboard.mql, fill: '#6659f4' }, { name: 'SQL', value: dashboard.sql, fill: '#2579df' }, { name: 'Won', value: dashboard.won, fill: '#53ca94' },
  ];
  const openFollowUps = leads.flatMap((lead) => lead.followUps).filter((item) => item.status === 'open');
  const now = new Date();
  const overdueByDays = (minimum: number, maximum = Infinity) => openFollowUps.filter((item) => {
    const daysOverdue = Math.floor((now.getTime() - new Date(item.dueAt).getTime()) / 86400000);
    return daysOverdue >= minimum && daysOverdue < maximum;
  }).length;
  const overdue = overdueByDays(1);
  const highPriority = overdueByDays(7);
  const mediumPriority = overdueByDays(3, 7);
  const lowPriority = overdueByDays(1, 3);
  const sourceRows = benchmarkBySource(leads).map((row) => ({ label: row.source, value: row.sampleSize ? Math.round((row.won / row.sampleSize) * 100) : 0 })).sort((a, b) => b.value - a.value).slice(0, 5);
  const sourceMax = Math.max(1, ...sourceRows.map((row) => row.value));
  const history = intelligenceHistory(leads);
  const salesRows = leaderboardForSales(leads).slice(0, 5);
  const revenueRows = salesRows.map((row) => ({ ...row, revenue: leads.filter((lead) => lead.status === 'won' && currentAssignment(lead)?.ownerId === row.userId).reduce((sum, lead) => sum + (lead.totalProjectCost ?? 0), 0) })).sort((a, b) => b.revenue - a.revenue);
  const recentWins = leads.filter((lead) => lead.status === 'won').slice(0, 3);
  const recognition = [
    { Icon: IconRocket, label: 'Top Closer', person: revenueRows[0] ? nameFor(revenueRows[0].userId) : 'Not enough data', detail: revenueRows[0]?.revenue ? `$${revenueRows[0].revenue.toLocaleString()} won` : 'No won value recorded' },
    { Icon: IconTarget, label: 'Most Meetings', person: salesRows[0] ? nameFor(salesRows[0].userId) : 'Not enough data', detail: salesRows[0] ? `${salesRows[0].connected} connected leads` : 'No meeting record yet' },
    { Icon: IconTrendingUp, label: 'Fastest Growth', person: sourceRows[0]?.label ?? 'Not enough data', detail: sourceRows[0] ? `${sourceRows[0].value}% won rate` : 'Need valid records' },
  ];
  const metricCards = [
    { label: 'Leads', value: String(leads.length), Icon: IconUsers, tone: 'violet' }, { label: 'MQL', value: String(dashboard.mql), Icon: IconUserCircle, tone: 'pink' }, { label: 'SQL', value: String(dashboard.sql), Icon: IconFilter, tone: 'blue' }, { label: 'Won', value: String(dashboard.won), Icon: IconTrophy, tone: 'green' }, { label: 'Pipeline Value', value: financial.financialRecordCount ? `$${financial.totalProjectValue.toLocaleString()}` : 'Not available', Icon: IconCurrencyDollar, tone: 'cyan' }, { label: 'Overdue', value: String(overdue), Icon: IconClock, tone: overdue ? 'amber' : 'green' },
  ];
  const execution = [
    { label: 'Meetings booked', value: leads.flatMap((lead) => lead.activities).filter((item) => /booked|discovery/i.test(item.body)).length, tone: 'green' }, { label: 'Meetings held', value: leads.flatMap((lead) => lead.activities).filter((item) => /meeting held|held meeting/i.test(item.body)).length, tone: 'green' }, { label: 'Proposals sent', value: leads.filter((lead) => lead.status === 'proposal_sent').length, tone: 'green' }, { label: 'Win rate', value: `${dashboard.conversionRate}%`, tone: dashboard.conversionRate ? 'green' : 'muted' },
  ];
  const risks = [
    { label: 'High priority', note: 'Over 7 days', value: highPriority, Icon: IconFlag, tone: 'red' }, { label: 'Medium priority', note: '3 – 7 days', value: mediumPriority, Icon: IconClock, tone: 'amber' }, { label: 'Low priority', note: '1 – 3 days', value: lowPriority, Icon: IconAlertTriangle, tone: 'yellow' },
  ];
  return <div className="admin-reference-dashboard"><header className="admin-reference-topbar"><h1>Company Command Center</h1><div className="admin-reference-controls"><RoleSwitcher viewer={viewer} viewers={viewers} onViewer={onViewer} /><label className="admin-reference-select"><IconCalendar size={17} /><select aria-label="Period" value={period} onChange={(event) => onPeriod(event.target.value as DashboardPeriod)}>{Object.entries(dashboardPeriodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="admin-reference-select"><IconFilter size={17} /><select aria-label="Source" value={source} onChange={(event) => onSource(event.target.value)}><option value="all">All Sources</option>{sourceOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label><div className="admin-reference-theme" role="group" aria-label="Appearance"><span>Dark</span><button type="button" aria-label="Toggle dark mode" aria-pressed={theme === 'dark'} onClick={() => onTheme(theme === 'dark' ? 'light' : 'dark')}><i /></button><span>Light</span></div><div className="admin-reference-avatar" aria-label={`${viewer.name} profile`}>{initialsFor(viewer.name)}</div></div></header>
    <section className="admin-reference-section admin-work-now" aria-label="Work now"><div className="admin-reference-section-heading"><h2>Work now</h2><button onClick={() => onNavigate('Follow-ups')}>View all actions <IconArrowUpRight size={15} /></button></div><div className="admin-reference-metrics">{metricCards.map(({ label, value, Icon, tone }) => <article className={`admin-reference-metric tone-${tone}`} key={label}><span className="admin-reference-metric-icon"><Icon size={25} /></span><div><h3>{label}</h3><strong>{value}</strong><small><i />Selected-period result</small></div></article>)}</div></section>
    <section className="admin-reference-section" aria-label="Performance"><div className="admin-reference-section-heading"><h2>Performance</h2><button onClick={() => onNavigate('Xaviar')}>Improve <IconArrowUpRight size={15} /></button></div><div className="admin-reference-performance-grid"><article className="admin-reference-panel admin-funnel-panel"><div className="admin-reference-panel-heading"><h3>Conversion funnel</h3><span>Selected period</span></div><div className="admin-reference-funnel-body"><div className="admin-funnel-chart" role="img" aria-label={`Conversion funnel: ${stages.map((stage) => `${stage.name} ${stage.value}`).join(', ')}`}><ResponsiveContainer width="100%" height="100%"><FunnelChart><Tooltip contentStyle={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }} /><Funnel dataKey="value" data={stages} isAnimationActive={false}><LabelList dataKey="name" position="right" fill="var(--text)" fontSize={10} /></Funnel></FunnelChart></ResponsiveContainer></div><div className="admin-reference-funnel-values">{stages.map((stage) => <div key={stage.name}><span>{stage.name}</span><b>{stage.value}</b><small>{leads.length ? `${Math.round((stage.value / leads.length) * 100)}%` : 'Not available'}</small></div>)}<footer><span>Conversion rate (Won)</span><b>{dashboard.conversionRate}%</b></footer></div></div></article>
      <article className="admin-reference-panel"><div className="admin-reference-panel-heading"><h3>Overdue follow-ups</h3><span>{overdue} total</span></div><div className="admin-reference-risk-list">{risks.map(({ label, note, value, Icon, tone }) => <button key={label} className={`admin-reference-risk risk-${tone}`} onClick={() => onNavigate('Follow-ups')}><span><Icon size={20} /></span><div><b>{label}</b><small>{note}</small></div><strong>{value}</strong><IconArrowUpRight size={16} /></button>)}</div><button className="admin-reference-footer-link" onClick={() => onNavigate('Follow-ups')}>View all overdue</button></article>
      <article className="admin-reference-panel"><div className="admin-reference-panel-heading"><h3>Source quality</h3><span>By win rate</span></div><div className="admin-reference-source-list">{sourceRows.length ? sourceRows.map((row) => <div key={row.label}><span>{row.label}</span><i><b style={{ width: `${Math.max(8, row.value / sourceMax * 100)}%` }} /></i><strong>{row.value}%</strong></div>) : <p>Not enough data</p>}</div><button className="admin-reference-footer-link" onClick={() => onNavigate('Reports')}>View full source report</button></article>
      <article className="admin-reference-panel admin-execution-panel"><div className="admin-reference-panel-heading"><h3>Sales execution</h3><span>Recorded activity</span></div>{execution.map((item) => <div className="admin-reference-execution-row" key={item.label}><div><span>{item.label}</span><b>{item.value}</b></div><div className={`admin-reference-spark tone-${item.tone}`} role="img" aria-label={`${item.label}: ${item.value}; seven-day recorded activity trend`}><ResponsiveContainer width="100%" height="100%"><LineChart data={history.slice(Math.max(0, history.length - 7))}><Line type="monotone" dataKey="activity" stroke="var(--accent-strong)" strokeWidth={2.2} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div></div>)}<button className="admin-reference-footer-link" onClick={() => onNavigate('Reports')}>View sales dashboard</button></article></div></section>
    <section className="admin-reference-section" aria-label="Momentum and recognition"><div className="admin-reference-section-heading"><h2>Momentum &amp; Recognition</h2></div><div className="admin-reference-momentum-grid"><article className="admin-reference-panel"><div className="admin-reference-panel-heading"><h3>Top performers</h3><span>Won revenue</span></div><div className="admin-reference-rank-list">{revenueRows.length ? revenueRows.map((row) => <div key={row.userId}><i>{initialsFor(nameFor(row.userId))}</i><b>{nameFor(row.userId)}</b><span>{row.revenue ? `$${row.revenue.toLocaleString()}` : 'Not available'}</span><strong>{row.closeRate ?? 0}%</strong></div>) : <p>Not enough data</p>}</div><button className="admin-reference-footer-link" onClick={() => onNavigate('Leaderboard')}>View leaderboard</button></article>
      <article className="admin-reference-panel"><div className="admin-reference-panel-heading"><h3>Recent wins</h3><span>Selected period</span></div><div className="admin-reference-win-list">{recentWins.length ? recentWins.map((lead) => <button key={lead.id} onClick={() => onNavigate('Lead inbox')}><span><IconTrophy size={20} /></span><div><b>{lead.name}</b><small>{lead.source} · Won</small></div><em>{lead.wonAt ? formatDate(lead.wonAt) : 'Not available'}</em></button>) : <p>Not enough recorded wins in this period.</p>}</div><button className="admin-reference-footer-link" onClick={() => onNavigate('Lead inbox')}>View all wins</button></article>
      <article className="admin-reference-panel admin-recognition-panel"><div className="admin-reference-panel-heading"><h3>Recognition</h3><span>Selected period</span></div><div className="admin-reference-recognition-list">{recognition.map(({ Icon, label, person, detail }, index) => <div key={label} className={`recognition-${index + 1}`}><span><Icon size={34} /></span><b>{label}</b><strong>{person}</strong><small>{detail}</small></div>)}</div><button className="admin-reference-footer-link" onClick={() => onNavigate('Leaderboard')}>View all recognition</button></article></div></section>
  </div>;
}
function BarChart({ title, subtitle, data, variant = 'horizontal' }: { title: string; subtitle: string; data: ChartDatum[]; variant?: 'horizontal' | 'column' }) {
  const max = Math.max(1, ...data.map((datum) => datum.value));
  const aria = `${title}: ${data.map((datum) => `${datum.label} ${datum.value}`).join(', ')}`;
  return <article className={`panel chart-panel chart-${variant}`}><h2>{title}</h2><p>{subtitle}</p>{data.length ? variant === 'column' ? <div className="column-chart" role="img" aria-label={aria}><ResponsiveContainer width="100%" height="100%"><RechartsBarChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}><CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 6" /><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 10 }} interval={0} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 10 }} /><Tooltip cursor={{ fill: 'var(--accent-soft)' }} contentStyle={{ borderRadius: 10, borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }} /><RechartsBar dataKey="value" radius={[7, 7, 0, 0]}>{data.map((datum) => <Cell key={datum.label} fill={`var(--${datum.tone === 'green' ? 'success' : datum.tone === 'red' ? 'danger' : datum.tone === 'amber' ? 'warning' : 'accent'})`} />)}</RechartsBar></RechartsBarChart></ResponsiveContainer></div> : <div className="bar-chart" role="img" aria-label={aria}>{data.map((datum) => <div className="bar-row" key={datum.label}><span>{datum.label}</span><div className="bar-track"><i className={`bar-fill ${datum.tone ?? 'teal'}`} style={{ width: `${datum.value ? Math.max(7, (datum.value / max) * 100) : 0}%` }} /></div><b>{datum.value}</b></div>)}</div> : <p className="empty">No chart data is available for this role yet.</p>}</article>;
}

function percent(value?: number) { return value === undefined ? 'Not available' : `${value}%`; }
function BenchmarkBoard({ leads }: { leads: Lead[] }) {
  const rows = benchmarkBySource(leads);
  return <section className="board"><div className="board-heading"><div><span className="eyebrow">MANAGER / ADMIN</span><h2>Benchmark Board</h2><p>Descriptive source-aware performance only. Sources are never declared universally best or worst while benchmark cohort rules remain open.</p></div><span className="warning">Cohort rules: open</span></div><div className="table-wrap"><table className="responsive-data-table"><thead><tr><th>Source</th><th>Sample</th><th>Connection</th><th>MQL / SQL</th><th>Proposal → Won</th><th>Follow-up</th><th>Project value</th></tr></thead><tbody>{rows.map((row) => <tr key={row.source}><td data-label="Source"><b>{row.source}</b></td><td data-label="Sample">{row.sampleSize}</td><td data-label="Connection">{row.connected}/{row.assigned} · {percent(row.connectionRate)}</td><td data-label="MQL / SQL">{row.mql} / {row.sql}</td><td data-label="Proposal → Won">{row.won}/{row.proposal} · {percent(row.proposalToWonRate)}</td><td data-label="Follow-up">{row.followUpCompleted}/{row.followUpDue} · {percent(row.followUpCompletionRate)}</td><td data-label="Project value">{row.financialRecordCount ? `${row.totalProjectValue} total · ${row.upfrontValue} upfront` : 'Not available'}</td></tr>)}</tbody></table>{!rows.length && <p className="empty">No leads match the selected period and source.</p>}</div></section>;
}

function SalesLeaderboardTable({ rows }: { rows: ReturnType<typeof leaderboardForSales> }) {
  return <div className="table-wrap"><table className="responsive-data-table"><thead><tr><th>Sales agent</th><th>Sample</th><th>Connection rate</th><th>Close rate</th><th>Follow-up completion</th></tr></thead><tbody>{rows.map((row) => <tr key={row.userId}><td data-label="Sales agent"><b>{nameFor(row.userId)}</b></td><td data-label="Sample">{row.sampleSize}</td><td data-label="Connection rate">{row.connected}/{row.sampleSize} · {percent(row.connectionRate)}</td><td data-label="Close rate">{row.won}/{row.sampleSize} · {percent(row.closeRate)}</td><td data-label="Follow-up completion">{percent(row.followUpCompletionRate)}</td></tr>)}</tbody></table>{!rows.length && <p className="empty">Not enough data to rank a sales agent.</p>}</div>;
}

function MarketingLeaderboardTable({ rows }: { rows: ReturnType<typeof leaderboardForMarketing> }) {
  return <div className="table-wrap"><table className="responsive-data-table"><thead><tr><th>Marketing agent</th><th>Sample</th><th>Actionable yield</th><th>Sales acceptance</th><th>MQL / SQL</th><th>Downstream won</th></tr></thead><tbody>{rows.map((row) => <tr key={row.userId}><td data-label="Marketing agent"><b>{nameFor(row.userId)}</b></td><td data-label="Sample">{row.sampleSize}</td><td data-label="Actionable yield">{percent(row.actionableLeadYield)}</td><td data-label="Sales acceptance">{percent(row.salesAcceptanceRate)}</td><td data-label="MQL / SQL">{row.mql} / {row.sql}</td><td data-label="Downstream won">{row.won}/{row.sampleSize} · {percent(row.downstreamConversionRate)}</td></tr>)}</tbody></table>{!rows.length && <p className="empty">Not enough data to rank a marketing agent.</p>}</div>;
}

function Leaderboard({ leads, privateBenchmarkLeads, viewer, scope }: { leads: Lead[]; privateBenchmarkLeads: Lead[]; viewer: User; scope: DashboardScope }) {
  const sales = leaderboardForSales(leads); const marketing = leaderboardForMarketing(leads);
  const named = canViewNamedLeaderboard(viewer);
  const marketingView = viewer.role === 'marketer' || (viewer.role === 'admin' && scope === 'marketing');
  if (!named) {
    const ownMarketing = marketing.find((row) => row.userId === viewer.id);
    const ownSales = sales.find((row) => row.userId === viewer.id);
    const own = viewer.role === 'marketer' ? ownMarketing : ownSales;
    const benchmark = viewer.role === 'marketer' ? median(leaderboardForMarketing(privateBenchmarkLeads).map((row) => row.actionableLeadYield)) : median(leaderboardForSales(privateBenchmarkLeads).map((row) => row.connectionRate));
    const metric = viewer.role === 'marketer' ? ownMarketing?.actionableLeadYield : ownSales?.connectionRate;
    return <section className="board"><div className="board-heading"><div><span className="eyebrow">PRIVATE PERSONAL STANDING</span><h2>My standing</h2><p>Your colleagues’ names are hidden. This compares only your own visible work with an anonymized team benchmark.</p></div><span className="warning">Improvement baseline: Not available</span></div><section className="quality-summary"><article><span>My sample</span><b>{own?.sampleSize ?? 'Not enough data'}</b></article><article><span>{viewer.role === 'marketer' ? 'My actionable yield' : 'My connection rate'}</span><b>{percent(metric)}</b></article><article><span>Anonymous team benchmark</span><b>{percent(benchmark)}</b></article><article><span>Most improved</span><b>Not available</b></article></section><p className="board-note">A private result is shown only when your role has a usable sample. Peer names, contact data, and raw peer records remain hidden.</p></section>;
  }
  if (viewer.role === 'admin' && scope === 'company') return <section className="board"><div className="board-heading"><div><span className="eyebrow">ADMIN — COMPANY LEADERBOARDS</span><h2>Sales and marketing performance</h2><p>Named results are visible only to Admin. Every row shows sample size and excludes confirmed Incorrect and Duplicate leads from normal conversion.</p></div><span className="warning">Most improved: Not available</span></div><h3>Sales</h3><SalesLeaderboardTable rows={sales} /><h3>Marketing</h3><MarketingLeaderboardTable rows={marketing} /><p className="board-note">Highest result and most improved remain separate. A prior-period baseline is required before improvement ranking appears.</p></section>;
  return <section className="board"><div className="board-heading"><div><span className="eyebrow">{marketingView ? 'MARKETING MANAGER' : 'SALES MANAGER'}</span><h2>{marketingView ? 'Marketing leaderboard' : 'Sales leaderboard'}</h2><p>Named results are limited to the manager or Admin’s permitted department scope. Every result includes sample size.</p></div><span className="warning">Most improved: Not available</span></div>{marketingView ? <MarketingLeaderboardTable rows={marketing} /> : <SalesLeaderboardTable rows={sales} />}<p className="board-note">Highest result and most improved remain separate. A prior-period baseline is required before improvement ranking appears.</p></section>;
}

function DataQualityBoard({ leads, range, source }: { leads: Lead[]; range: ReturnType<typeof dashboardDateRange>; source: string }) {
  const issues = dataQualityIssues(leads); const reconciliation = dashboardReconciliation(leads, range, source);
  return <section className="board"><div className="board-heading"><div><span className="eyebrow">ADMIN ONLY</span><h2>Data quality & reconciliation</h2><p>Exceptions show where a record needs attention before it is used for reporting or coaching.</p></div><span className={reconciliation.passes ? 'success-chip' : 'warning'}>{reconciliation.passes ? 'Reconciled' : 'Needs review'}</span></div><section className="quality-summary"><article><span>Filtered leads</span><b>{reconciliation.filteredLeadCount}</b></article><article><span>Benchmark samples</span><b>{reconciliation.benchmarkSampleCount}</b></article><article><span>Excluded from conversion</span><b>{reconciliation.excludedFromConversion}</b></article><article><span>Exceptions</span><b>{issues.length}</b></article></section><div className="table-wrap"><table className="responsive-data-table"><thead><tr><th>Lead</th><th>Exception</th><th>Reason</th></tr></thead><tbody>{issues.map((issue, index) => <tr key={`${issue.leadId}-${issue.type}-${index}`}><td data-label="Lead"><b>{leads.find((lead) => lead.id === issue.leadId)?.name ?? issue.leadId}</b></td><td data-label="Exception">{issue.type.replaceAll('_', ' ')}</td><td data-label="Reason">{issue.message}</td></tr>)}</tbody></table>{!issues.length && <p className="empty">No data-quality exceptions match the selected dashboard filter.</p>}</div></section>;
}

function LeadDetail({ lead, viewer, onStatus, onMarkWon, onQualification, onLostReason, onAddNote, onAddFollowUp, onCompleteFollowUp, onReassign, onReportIncorrect, onDecision }: { lead: Lead; viewer: User; onStatus: (lead: Lead, status: OpportunityStatus) => void; onMarkWon: (lead: Lead, event: FormEvent<HTMLFormElement>) => void; onQualification: (lead: Lead, qualification: Qualification) => void; onLostReason: (lead: Lead, lostReason: Lead['lostReason']) => void; onAddNote: (lead: Lead, event: FormEvent<HTMLFormElement>) => void; onAddFollowUp: (lead: Lead, event: FormEvent<HTMLFormElement>) => void; onCompleteFollowUp: (lead: Lead, id: string) => void; onReassign: (lead: Lead, event: FormEvent<HTMLFormElement>) => void; onReportIncorrect: (lead: Lead, event: FormEvent<HTMLFormElement>) => void; onDecision: (lead: Lead, decision: 'confirmed_incorrect' | 'rejected' | 'merge_duplicate') => void; }) {
  const edit = canUpdateLead(viewer, lead) && !lead.routingPaused; const owner = currentAssignment(lead); const visibleHistory = owner?.visibility === 'fresh_start' && viewer.id === owner.ownerId ? lead.activities.filter((activity) => activity.at >= owner.at) : lead.activities;
  return <aside className="detail-panel"><div className="detail-heading"><div><span className="spark">LEAD DETAIL</span><h2>{lead.name}</h2><p>{lead.phone ?? 'No phone'} · {lead.email ?? 'No email'}</p></div><span className={`status ${lead.status}`}>{statusLabels[lead.status]}</span></div>
    <div className="detail-grid"><label>Status<select value={lead.status} disabled={!edit} onChange={(event) => onStatus(lead, event.target.value as OpportunityStatus)}>{statusOptions.filter((status) => status !== 'won' || lead.status === 'won').map((status) => <option key={status} value={status} disabled={!validStatusTransition(lead.status, status)}>{statusLabels[status]}</option>)}</select></label><label>Qualification<select value={lead.qualification} disabled={!edit} onChange={(event) => onQualification(lead, event.target.value as Qualification)}>{qualificationOptions.map((level) => <option key={level} value={level}>{qualificationLabels[level]}</option>)}</select></label>{edit && <label>Loss reason<select value={lead.lostReason ?? ''} onChange={(event) => onLostReason(lead, event.target.value ? event.target.value as Lead['lostReason'] : undefined)}><option value="">Choose before Lost / Not Interested</option>{lostReasonOptions.map((reason) => <option key={reason} value={reason}>{reason}</option>)}</select></label>}</div>
    <details className="detail-section detail-disclosure"><summary>Stage timing and history</summary><p><b>{statusLabels[lead.status]}</b> for {stageAgeLabel(lead)}. This time is kept separately from each agent’s ownership period.</p>{(lead.stageHistory ?? []).slice().reverse().map((stage) => <p className="history" key={stage.id}><b>{statusLabels[stage.toStatus]}</b> · entered {formatDate(stage.enteredAt)}{stage.exitedAt ? ` · left ${formatDate(stage.exitedAt)}` : ' · current stage'}</p>)}</details>
    {edit && lead.status === 'proposal_sent' && <section className="detail-section"><h3>Mark opportunity Won</h3><p>Record financial values now. Historical opportunities without these values remain Not available.</p><form className="inline-form" onSubmit={(event) => onMarkWon(lead, event)}><label>Total project cost<input name="totalProjectCost" type="number" min="0" step="0.01" required /></label><label>Upfront payment<input name="upfrontPaymentAmount" type="number" min="0" step="0.01" required /></label><button className="primary">Save as Won</button></form></section>}
    {lead.status === 'won' && <section className="detail-section"><h3>Won financials</h3><p>Total project cost: {lead.totalProjectCost === undefined ? 'Not available' : lead.totalProjectCost}</p><p>Upfront payment: {lead.upfrontPaymentAmount === undefined ? 'Not available' : lead.upfrontPaymentAmount}</p><p>Won date: {lead.wonAt ? formatDate(lead.wonAt) : 'Not available'}</p></section>}
    <section className="detail-section"><h3>Ownership</h3><p><b>Sales owner:</b> {nameFor(ownerId(lead))}</p><p><b>Marketing source:</b> {nameFor(lead.marketingOwnerId)} · {lead.source}</p>{lead.routingPaused && <p className="warning">Assignment paused: three agents reported this contact as incorrect.</p>}<details><summary>Assignment history ({lead.assignments.length})</summary>{lead.assignments.map((assignment) => <p className="history" key={assignment.id}><b>{nameFor(assignment.ownerId)}</b> · {assignment.visibility === 'full_context' ? 'Full context' : 'Fresh working view'}<br />{assignment.reason}</p>)}</details></section>
    {edit && <section className="detail-section"><h3>Schedule follow-up</h3><form className="inline-form" onSubmit={(event) => onAddFollowUp(lead, event)}><label>Action<select name="action" defaultValue="Call"><option>Call</option><option>Email</option><option>SMS</option><option>Task</option></select></label><label>Due date and time<input name="dueAt" type="datetime-local" required /></label><button className="primary">Schedule</button></form></section>}
    <section className="detail-section"><h3>Follow-ups</h3>{lead.followUps.length ? lead.followUps.map((followUp) => <div className="followup" key={followUp.id}><span><b>{followUp.action}</b> · {relativeDue(followUp)}</span>{followUp.status === 'open' && edit && <button className="quiet" onClick={() => onCompleteFollowUp(lead, followUp.id)}>Complete</button>}</div>) : <p className="empty">No follow-up scheduled.</p>}</section>
    {edit && <details className="detail-section detail-disclosure"><summary>Reassign lead</summary><form className="stack-form" onSubmit={(event) => onReassign(lead, event)}><label>Sales owner<select name="owner" defaultValue="" required><option value="" disabled>Choose sales owner</option>{users.filter((user) => user.role === 'sales_agent').map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label><label>History visibility<select name="visibility" defaultValue="full_context"><option value="full_context">Share complete background</option><option value="fresh_start">Fresh working view for next agent</option></select></label><label>Handoff reason<input name="reason" placeholder="Explain why this lead is being handed off" required /></label><button className="primary" disabled={lead.routingPaused}>Save assignment</button></form></details>}
    {viewer.role === 'sales_agent' && ownerId(lead) === viewer.id && <section className="detail-section"><h3>Incorrect lead</h3>{lead.routingPaused ? <p className="warning">This lead is paused for Admin review. No further agent action is allowed.</p> : lead.incorrectReports.some((report) => report.reporterId === viewer.id) ? <p className="warning">You have already submitted your one incorrect-lead report for this contact.</p> : <form className="stack-form" onSubmit={(event) => onReportIncorrect(lead, event)}><label>Reason<select name="reason" defaultValue="" required><option value="" disabled>Choose reason</option><option>Invalid contact information</option><option>Wrong person or business</option><option>Spam or fake request</option><option>Duplicate contact</option></select></label><label>Evidence (optional)<input name="evidence" placeholder="Add evidence if helpful" /></label><button className="danger">Report incorrect</button></form>}</section>}
    {viewer.role === 'admin' && lead.incorrectReview?.state === 'pending' && <section className="detail-section review-actions"><h3>Incorrect Review</h3><p>{lead.incorrectReports.length} independent agent reports. Decide before routing resumes.</p><button className="danger" onClick={() => onDecision(lead, 'confirmed_incorrect')}>Confirm incorrect</button><button className="quiet" onClick={() => onDecision(lead, 'rejected')}>Reject reports</button><button className="quiet" onClick={() => onDecision(lead, 'merge_duplicate')}>Merge as duplicate</button></section>}
    {edit && <details className="detail-section detail-disclosure"><summary>Notes and activity history ({visibleHistory.length})</summary><form className="note-form" onSubmit={(event) => onAddNote(lead, event)}><textarea name="note" placeholder="Record what happened. Notes are permanent in the activity history." required /><button className="primary">Add note</button></form>{visibleHistory.slice().reverse().map((activity) => <p className="history" key={activity.id}><b>{nameFor(activity.actorId)}</b> · {formatDate(activity.at)}<br />{activity.body}</p>)}</details>}
  </aside>;
}

function FollowUpList({ leads, viewer, onSelect, onComplete }: { leads: Lead[]; viewer: User; onSelect: (id: string) => void; onComplete: (lead: Lead, id: string) => void }) { const rows = leads.flatMap((lead) => lead.followUps.filter((followUp) => followUp.status === 'open').map((followUp) => ({ lead, followUp }))).sort((a, b) => a.followUp.dueAt.localeCompare(b.followUp.dueAt)); return <article className="panel"><h2>Follow-up task list</h2><p>Overdue work is shown first. Completing a task is recorded in history.</p>{rows.length ? rows.map(({ lead, followUp }) => <div className="task-row" key={followUp.id}><button className="text-button dark" onClick={() => onSelect(lead.id)}>{lead.name}</button><span>{followUp.action}</span><span className={relativeDue(followUp) === 'Overdue' ? 'overdue' : ''}>{relativeDue(followUp)}</span>{canUpdateLead(viewer, lead) && !lead.routingPaused && <button className="quiet" onClick={() => onComplete(lead, followUp.id)}>Complete</button>}</div>) : <p className="empty">No open follow-ups.</p>}</article>; }
function AssignmentList({ leads, onSelect }: { leads: Lead[]; onSelect: (id: string) => void }) { return <article className="panel"><h2>Assignment history</h2><p>Every owner remains visible. Fresh-start assignments protect the new agent’s working view without deleting history.</p>{leads.flatMap((lead) => lead.assignments.map((assignment) => ({ lead, assignment }))).sort((a, b) => b.assignment.at.localeCompare(a.assignment.at)).map(({ lead, assignment }) => <div className="task-row" key={assignment.id}><button className="text-button dark" onClick={() => onSelect(lead.id)}>{lead.name}</button><span>{nameFor(assignment.ownerId)}</span><span>{assignment.visibility === 'full_context' ? 'Full context' : 'Fresh view'}</span><span>{assignment.reason}</span></div>)}</article>; }
function ReviewQueue({ leads, onSelect }: { leads: Lead[]; onSelect: (id: string) => void }) { return <article className="panel"><h2>Incorrect Review queue</h2><p>Three different agents must report a lead before it reaches this queue. Leads stay paused until Admin decides.</p>{leads.length ? leads.map((lead) => <div className="task-row" key={lead.id}><button className="text-button dark" onClick={() => onSelect(lead.id)}>{lead.name}</button><span>{lead.incorrectReports.length} reports</span><span>Routing paused</span><span>{lead.incorrectReports.map((report) => nameFor(report.reporterId)).join(', ')}</span></div>) : <p className="empty">No lead is waiting for review.</p>}</article>; }
function Reports({ dashboard, viewer, duplicates }: { dashboard: ReturnType<typeof dashboardFor>; viewer: User; duplicates: number }) { return <section className="report-grid"><article className="panel"><h2>{viewer.role === 'marketer' ? 'Marketing quality report' : 'Sales performance report'}</h2><div className="report-row"><span>Visible leads</span><b>{dashboard.visible.length}</b></div><div className="report-row"><span>MQL / SQL</span><b>{dashboard.mql} / {dashboard.sql}</b></div><div className="report-row"><span>Won</span><b>{dashboard.won}</b></div><div className="report-row"><span>Conversion</span><b>{dashboard.conversionRate}%</b></div><div className="report-row"><span>Overdue follow-ups</span><b>{dashboard.overdue}</b></div><div className="report-row"><span>Duplicate candidates</span><b>{duplicates}</b></div></article><article className="panel"><span className="spark dark">XAVIAR EVIDENCE MODEL</span><h2>What this report will use</h2><p>Response speed, follow-up consistency, qualification outcome, note quality, source quality, duplicate rate, and conversion. The production version will cite the exact CRM events behind each recommendation.</p></article></section>; }
function AdminUserManagement({ session, onNotice }: { session: Session; onNotice: (message: string) => void }) {
  const [managed, setManaged] = useState<ManagedUser[]>([]); const [loading, setLoading] = useState(true); const [editing, setEditing] = useState<ManagedUser | null>(null); const [creating, setCreating] = useState(false);
  const refresh = () => { setLoading(true); void loadAdminUsers(session).then((result) => setManaged(result.users)).catch((error: unknown) => onNotice(error instanceof Error ? error.message : 'Unable to load users.')).finally(() => setLoading(false)); };
  useEffect(refresh, [session]);
  const managers = managed.filter((user) => user.role === 'manager' && user.active);
  const save = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); const role = String(form.get('role') ?? 'sales_agent') as ManagedUser['role']; const dept = role === 'admin' ? null : String(form.get('department') ?? '') as 'marketing' | 'sales'; const managerId = role === 'admin' ? null : String(form.get('managerId') ?? '') || null; const base = { fullName: String(form.get('fullName') ?? '').trim(), role, department: dept, managerId }; if (!base.fullName) return onNotice('Full name is required.'); if (creating) { const email = String(form.get('email') ?? '').trim(); const password = String(form.get('password') ?? ''); if (!email || password.length < 8) return onNotice('Email and a password of at least 8 characters are required.'); void createAdminUser(session, { ...base, email, password }).then(() => { onNotice('User created and audit logged.'); setCreating(false); refresh(); }).catch((error: unknown) => onNotice(error instanceof Error ? error.message : 'Unable to create user.')); } else if (editing) { const active = form.get('active') === 'on'; void updateAdminUser(session, editing.id, { ...base, active }).then(() => { onNotice('User updated and audit logged.'); setEditing(null); refresh(); }).catch((error: unknown) => onNotice(error instanceof Error ? error.message : 'Unable to update user.')); } };
  return <section className="board"><div className="board-heading"><div><span className="eyebrow">ADMIN ONLY</span><h2>User management</h2><p>Create and maintain accounts, roles, departments, manager relationships, and active access. Passwords are never displayed or stored in the CRM profile.</p></div><button className="primary" onClick={() => { setEditing(null); setCreating(true); }}>Add user</button></div>{loading ? <p className="empty">Loading workspace users…</p> : <div className="table-wrap"><table className="responsive-data-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Manager</th><th>Access</th><th>Last sign-in</th><th>Action</th></tr></thead><tbody>{managed.map((user) => <tr key={user.id}><td data-label="Name"><b>{user.full_name}</b></td><td data-label="Email">{user.email || 'Not available'}</td><td data-label="Role">{roleLabels[user.role]}</td><td data-label="Department">{user.department ?? '—'}</td><td data-label="Manager">{managed.find((candidate) => candidate.id === user.manager_id)?.full_name ?? '—'}</td><td data-label="Access"><span className={user.active ? 'success-chip' : 'warning'}>{user.active ? 'Active' : 'Inactive'}</span></td><td data-label="Last sign-in">{user.last_sign_in_at ? formatDate(user.last_sign_in_at) : 'Never'}</td><td data-label="Action"><button className="quiet" onClick={() => { setCreating(false); setEditing(user); }}>Edit</button></td></tr>)}</tbody></table>{!managed.length && <p className="empty">No profiles are available.</p>}</div>}{(creating || editing) && <div className="modal-backdrop" role="presentation"><form className="modal" onSubmit={save}><div className="panel-heading"><div><span className="spark dark">{creating ? 'NEW USER' : 'EDIT USER'}</span><h2>{creating ? 'Add a workspace user' : `Edit ${editing?.full_name}`}</h2></div><button type="button" className="quiet" onClick={() => { setCreating(false); setEditing(null); }}>Close</button></div><div className="detail-grid"><label>Full name<input name="fullName" defaultValue={editing?.full_name ?? ''} required /></label>{creating ? <label>Email<input name="email" type="email" required /></label> : <label>Email<input value={editing?.email ?? ''} readOnly /></label>}<label>Role<select name="role" defaultValue={editing?.role ?? 'sales_agent'}>{(['admin', 'manager', 'marketer', 'sales_agent'] as ManagedUser['role'][]).map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}</select></label><label>Department<select name="department" defaultValue={editing?.department ?? ''}><option value="">Choose department</option><option value="marketing">Marketing</option><option value="sales">Sales</option></select></label><label>Manager<select name="managerId" defaultValue={editing?.manager_id ?? ''}><option value="">Choose manager</option>{managers.filter((manager) => manager.id !== editing?.id).map((manager) => <option key={manager.id} value={manager.id}>{manager.full_name} · {manager.department ?? 'Department not set'}</option>)}</select></label>{creating ? <label>Temporary password<input name="password" type="password" minLength={8} required placeholder="At least 8 characters" /></label> : <label className="checkbox-label"><input name="active" type="checkbox" defaultChecked={editing?.active} /> Account active</label>}</div><p className="board-note">Rules: admins have no manager; non-admin users need a same-department active manager; the last active admin and your own admin access cannot be removed.</p><button className="primary">{creating ? 'Create user' : 'Save changes'}</button></form></div>}</section>;
}

function CreateLead({ viewer, onClose, onSubmit }: { viewer: User; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) { const allowed = viewer.role === 'admin' || viewer.role === 'marketer'; return <div className="modal-backdrop" role="presentation"><form className="modal lead-form-modal" onSubmit={onSubmit}><div className="panel-heading"><div><span className="spark dark">NEW LEAD</span><h2>Create a lead</h2></div><button type="button" className="quiet" onClick={onClose}>Close</button></div>{allowed ? <><p>A record only becomes a lead when it has a name plus a phone number or email address.</p><div className="detail-grid"><label>Name<input name="name" required /></label><label>Source<select name="source" defaultValue="" required><option value="" disabled>Choose source</option>{sourceOptions.map((source) => <option key={source} value={source}>{source}</option>)}</select></label><label>Lead category<select name="category" defaultValue="not_available" required>{leadCategoryOptions.map((category) => <option key={category} value={category}>{leadCategoryLabels[category]}</option>)}</select></label><label>Phone<input name="phone" type="tel" inputMode="tel" /></label><label>Email<input name="email" type="email" inputMode="email" /></label><label>Initial sales owner<select name="owner" defaultValue=""><option value="">Leave unassigned</option>{users.filter((user) => user.role === 'sales_agent').map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label><label className="form-span">Description<textarea name="description" rows={5} maxLength={4000} placeholder="Add the lead request, project needs, background, or other useful context." /></label></div><button className="primary">Create lead</button></> : <p className="warning">Only Admin and Marketing can create leads.</p>}</form></div>; }
