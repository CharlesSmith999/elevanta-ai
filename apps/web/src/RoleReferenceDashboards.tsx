import {
  IconActivityHeartbeat, IconAlertTriangle, IconArrowUpRight, IconBriefcase,
  IconBulb, IconCalendar, IconChartBar, IconChecklist, IconCircleCheck, IconClock,
  IconCurrencyDollar, IconFilter, IconHome, IconPlus, IconReportAnalytics,
  IconRobot, IconSparkles, IconTarget, IconTrendingUp, IconTrophy, IconUserCircle,
  IconUsers,
} from '@tabler/icons-react';
import {
  Cell, Funnel, FunnelChart, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip,
} from 'recharts';
import {
  DashboardPeriod, Lead, User, benchmarkBySource, currentAssignment, dashboardFor,
  duplicateMatches, financialMetrics, leaderboardForMarketing, leaderboardForSales,
  lossReasonBreakdown, median, responseHours, routingHours, sourceOptions, users,
} from './domain';
import { navigationFor } from './navigation';

export type RoleReferenceKind = 'marketing-manager' | 'sales-manager' | 'marketing-agent' | 'sales-agent';

const periodLabels: Record<DashboardPeriod, string> = {
  daily: 'Today', weekly: 'This week', monthly: 'This month', yearly: 'This year', lifetime: 'Lifetime', custom: 'Custom range',
};

const terminal = new Set(['won', 'lost', 'not_interested', 'incorrect', 'duplicate', 'do_not_contact']);
const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '—';
const nameFor = (id?: string) => users.find((user) => user.id === id)?.name ?? 'Unassigned';
const pct = (value: number, total: number) => total ? `${Math.round((value / total) * 100)}%` : 'Not available';
const reached = (lead: Lead, status: string) => lead.status === status || Boolean(lead.stageHistory?.some((stage) => stage.toStatus === status));
const money = (value: number) => `$${value.toLocaleString()}`;
const openFollowUps = (leads: Lead[]) => leads.flatMap((lead) => lead.followUps.map((item) => ({ ...item, lead }))).filter((item) => item.status === 'open');
const dueClass = (dueAt: string) => {
  const due = new Date(dueAt); const now = new Date();
  if (due < now) return 'overdue';
  if (due.toDateString() === now.toDateString()) return 'today';
  return 'future';
};
const valid = (leads: Lead[]) => leads.filter((lead) => lead.status !== 'duplicate' && lead.incorrectReview?.state !== 'confirmed_incorrect' && lead.incorrectReview?.state !== 'merge_duplicate');
const activityTrend = (leads: Lead[]) => {
  const result = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(); day.setDate(day.getDate() - (6 - index));
    const key = day.toISOString().slice(0, 10);
    const activities = leads.flatMap((lead) => lead.activities).filter((item) => item.at.slice(0, 10) === key).length;
    const assignments = leads.flatMap((lead) => lead.assignments).filter((item) => item.at.slice(0, 10) === key).length;
    return { day: day.toLocaleDateString(undefined, { weekday: 'short' }), activity: activities, routing: assignments };
  });
  return result;
};

const recognitionIcons = [IconSparkles, IconCircleCheck, IconChartBar, IconActivityHeartbeat, IconTrendingUp];

function roleLabel(kind: RoleReferenceKind) {
  if (kind === 'marketing-manager') return ['Marketing Manager', 'Marketing'];
  if (kind === 'sales-manager') return ['Sales Manager', 'Sales'];
  if (kind === 'marketing-agent') return ['Marketing Agent', 'Marketing'];
  return ['Sales Agent', 'Sales'];
}

export function RoleReferenceSidebar({ kind, viewer, activePage, onNavigate, onReset, onSignOut }: { kind: RoleReferenceKind; viewer: User; activePage: string; onNavigate: (page: string) => void; onReset: () => void; onSignOut?: () => void }) {
  type NavItem = [string, typeof IconHome, string];
  const icons: Record<string, typeof IconHome> = { Dashboard: kind === 'sales-manager' ? IconBriefcase : IconHome, 'Lead inbox': kind === 'sales-manager' ? IconBriefcase : IconUsers, 'Follow-ups': IconChecklist, Assignments: kind === 'sales-manager' ? IconUsers : IconTarget, Reports: IconReportAnalytics, 'Benchmark Board': IconChartBar, Leaderboard: IconTrophy, 'Data quality': IconCircleCheck, Xaviar: IconRobot };
  const nav: NavItem[] = navigationFor(viewer).map((item) => [item.label, icons[item.page] ?? IconHome, item.page]);
  const [title, department] = roleLabel(kind);
  return <div className="admin-reference-sidebar role-reference-sidebar"><div className="admin-reference-brand"><IconSparkles className="admin-reference-spark" size={28} stroke={2.1} /><span>Elevanta <b>AI</b></span></div><nav aria-label={`${title} navigation`}>{nav.map(([label, Icon, page]) => <button key={label} className={page === activePage ? 'admin-reference-nav active' : 'admin-reference-nav'} aria-current={page === activePage ? 'page' : undefined} onClick={() => onNavigate(page)}><Icon size={20} stroke={1.8} /><span>{label}</span></button>)}</nav><div className="admin-reference-sidebar-bottom"><div className="admin-reference-profile"><span>{initials(viewer.name)}</span><div><b>{viewer.name}</b><small>{title}<br />{department}</small></div></div><div className="sidebar-session-actions"><button type="button" onClick={onReset}>Reset test data</button>{onSignOut && <button type="button" onClick={onSignOut}>Sign out</button>}</div></div></div>;
}

function viewerLabel(user: User) { return user.role === 'admin' ? `${user.name} — Admin` : user.role === 'manager' ? `${user.name} — ${user.department === 'marketing' ? 'Marketing Manager' : 'Sales Manager'}` : `${user.name} — ${user.role === 'marketer' ? 'Marketing Agent' : 'Sales Agent'}`; }

export function RoleSwitcher({ viewer, viewers, onViewer }: { viewer: User; viewers: User[]; onViewer: (viewerId: string) => void }) {
  return <label className="role-view-switcher"><IconUsers size={16} /><span>View as</span><select aria-label="View as role" value={viewer.id} onChange={(event) => onViewer(event.target.value)}>{viewers.map((candidate) => <option key={candidate.id} value={candidate.id}>{viewerLabel(candidate)}</option>)}</select></label>;
}

function RoleTopbar({ kind, viewer, viewers, period, source, theme, onViewer, onPeriod, onSource, onTheme, onCreate }: { kind: RoleReferenceKind; viewer: User; viewers: User[]; period: DashboardPeriod; source: string; theme: 'light' | 'dark'; onViewer: (viewerId: string) => void; onPeriod: (value: DashboardPeriod) => void; onSource: (value: string) => void; onTheme: (value: 'light' | 'dark') => void; onCreate: () => void }) {
  const title = kind === 'marketing-manager' ? 'Marketing Quality Command' : kind === 'sales-manager' ? 'Sales Command Center' : kind === 'marketing-agent' ? 'My Marketing Workspace' : 'My Sales Workspace';
  return <header className="admin-reference-topbar role-reference-topbar"><div className="role-reference-title"><h1>{title}</h1>{kind === 'marketing-agent' && <button className="role-add-lead" onClick={onCreate}><IconPlus size={19} /> Add lead</button>}</div><div className="admin-reference-controls"><RoleSwitcher viewer={viewer} viewers={viewers} onViewer={onViewer} /><label className="admin-reference-select"><IconCalendar size={17} /><select aria-label="Period" value={period} onChange={(event) => onPeriod(event.target.value as DashboardPeriod)}>{Object.entries(periodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="admin-reference-select"><IconFilter size={17} /><select aria-label="Source" value={source} onChange={(event) => onSource(event.target.value)}><option value="all">All Sources</option>{sourceOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label><div className="admin-reference-theme" role="group" aria-label="Appearance"><span>Dark</span><button type="button" aria-label="Toggle dark mode" aria-pressed={theme === 'dark'} onClick={() => onTheme(theme === 'dark' ? 'light' : 'dark')}><i /></button><span>Light</span></div><div className="admin-reference-avatar" aria-label={`${viewer.name} profile`}>{initials(viewer.name)}</div></div></header>;
}

type Metric = { label: string; value: string; Icon: typeof IconUsers; tone: string };
function MetricGrid({ metrics, label = 'Work now' }: { metrics: Metric[]; label?: string }) {
  return <div className="role-reference-metrics" aria-label={label}>{metrics.map(({ label: title, value, Icon, tone }) => <article className={`role-reference-metric tone-${tone}`} key={title}><span className="admin-reference-metric-icon"><Icon size={23} /></span><div><h3>{title}</h3><strong>{value}</strong><small><i />Selected-period result</small></div></article>)}</div>;
}

function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return <div className="role-reference-section-heading"><h2>{title}</h2>{action && <button onClick={onAction}>{action} <IconArrowUpRight size={14} /></button>}</div>;
}

function FunnelPanel({ title, stages, footer }: { title: string; stages: Array<{ name: string; value: number; fill: string }>; footer: string }) {
  const total = stages[0]?.value ?? 0;
  return <article className="role-reference-panel role-funnel-panel"><div className="admin-reference-panel-heading"><h3>{title}</h3><span>Selected period</span></div><div className="role-funnel-body"><div className="role-funnel-chart" role="img" aria-label={`${title}: ${stages.map((stage) => `${stage.name} ${stage.value}`).join(', ')}`}><ResponsiveContainer width="100%" height="100%"><FunnelChart><Tooltip contentStyle={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }} /><Funnel dataKey="value" data={stages} isAnimationActive={false} /></FunnelChart></ResponsiveContainer></div><div className="role-funnel-values">{stages.map((stage) => <div key={stage.name}><span>{stage.name}</span><b>{stage.value}</b><small>{total ? pct(stage.value, total) : 'Not available'}</small></div>)}<footer>{footer}<b>{total ? pct(stages.at(-1)?.value ?? 0, total) : 'Not available'}</b></footer></div></div></article>;
}

function RiskPanel({ title, rows, onNavigate }: { title: string; rows: Array<{ label: string; value: number; tone: string; Icon: typeof IconUsers; note?: string }>; onNavigate: (page: string) => void }) {
  return <article className="role-reference-panel"><div className="admin-reference-panel-heading"><h3>{title}</h3><span>{rows.reduce((sum, row) => sum + row.value, 0)} total</span></div><div className="role-risk-list">{rows.map(({ label, value, tone, Icon, note }) => <button key={label} className={`role-risk-row risk-${tone}`} onClick={() => onNavigate('Lead inbox')}><span><Icon size={18} /></span><div><b>{label}</b>{note && <small>{note}</small>}</div><strong>{value}</strong><IconArrowUpRight size={14} /></button>)}</div><button className="admin-reference-footer-link" onClick={() => onNavigate('Lead inbox')}>View all</button></article>;
}

function SourcePanel({ leads, title = 'Source quality', onNavigate }: { leads: Lead[]; title?: string; onNavigate: (page: string) => void }) {
  const rows = benchmarkBySource(leads).map((row) => ({ label: row.source, sample: row.sampleSize, value: row.sampleSize ? Math.round(((row.mql + row.sql) / row.sampleSize) * 100) : 0 })).sort((a, b) => b.value - a.value).slice(0, 5);
  const maximum = Math.max(1, ...rows.map((row) => row.value));
  return <article className="role-reference-panel"><div className="admin-reference-panel-heading"><h3>{title}</h3><span>By actionable yield</span></div><div className="role-source-list">{rows.length ? rows.map((row) => <div key={row.label}><span>{row.label}</span><i><b style={{ width: `${Math.max(7, row.value / maximum * 100)}%` }} /></i><strong>{row.value}%</strong></div>) : <p className="role-empty">Not enough data</p>}</div><button className="admin-reference-footer-link" onClick={() => onNavigate('Reports')}>View source quality report</button></article>;
}

function SourceLearningPanel({ leads, onNavigate }: { leads: Lead[]; onNavigate: (page: string) => void }) {
  const rows = benchmarkBySource(leads).slice(0, 5);
  return <article className="role-reference-panel role-source-learning"><div className="admin-reference-panel-heading"><h3>My source learning</h3><span>Selected period</span></div><div className="role-source-table"><div className="header"><span>Source</span><span>Leads</span><span>MQL</span><span>SQL</span><span>Won</span></div>{rows.length ? rows.map((row) => <div key={row.source}><b>{row.source}</b><span>{row.sampleSize}</span><span>{pct(row.mql, row.sampleSize)}</span><span>{pct(row.sql, row.sampleSize)}</span><span>{pct(row.won, row.sampleSize)}</span></div>) : <p className="role-empty">Not enough data</p>}</div><button className="admin-reference-footer-link" onClick={() => onNavigate('Reports')}>View full source report</button></article>;
}

function TrendPanel({ leads, title, onNavigate }: { leads: Lead[]; title: string; onNavigate: (page: string) => void }) {
  const data = activityTrend(leads);
  return <article className="role-reference-panel role-trend-panel"><div className="admin-reference-panel-heading"><h3>{title}</h3><span>Recorded events</span></div><div className="role-trend-legend"><span><i className="purple" />Activity</span><span><i className="cyan" />Routing</span></div><div className="role-trend-chart" role="img" aria-label={`${title}: ${data.map((item) => `${item.day} ${item.activity} activities and ${item.routing} assignments`).join(', ')}`}><ResponsiveContainer width="100%" height="100%"><LineChart data={data}><Line type="monotone" dataKey="activity" stroke="#8a5cf6" strokeWidth={2.2} dot={{ r: 2 }} isAnimationActive={false} /><Line type="monotone" dataKey="routing" stroke="#16b6bd" strokeWidth={2.2} dot={{ r: 2 }} isAnimationActive={false} /></LineChart></ResponsiveContainer></div><button className="admin-reference-footer-link" onClick={() => onNavigate('Reports')}>View trend details</button></article>;
}

function RecognitionGrid({ kind, leads, viewer, management, onNavigate }: { kind: RoleReferenceKind; leads: Lead[]; viewer: User; management: boolean; onNavigate: (page: string) => void }) {
  const marketing = leaderboardForMarketing(leads);
  const sales = leaderboardForSales(leads);
  const rows = kind.startsWith('marketing') ? marketing : sales;
  const ranked = rows.slice(0, 5);
  const names = management ? ranked.map((row) => nameFor(row.userId)) : Array(5).fill(viewer.name);
  const labels = kind.startsWith('marketing') ? ['Quality Builder', 'Sales-Ready Creator', 'Clean Data Champion', 'Fast Router', 'Most Improved'] : ['Fast Response', 'Follow-up Reliability', 'Pipeline Mover', 'Closer', 'Most Improved'];
  const descriptions = kind.startsWith('marketing') ? ['High-quality pipeline', 'Sales-ready leads', 'Clean, trusted data', 'Accurate routing', 'Positive momentum'] : ['Timely first response', 'Follow-up discipline', 'Deals moved forward', 'Proposals converted', 'Positive momentum'];
  const metricFor = (index: number) => {
    const row = ranked[index];
    if (!row) return 'Not enough data';
    if (kind.startsWith('marketing')) {
      const marketingRow = row as ReturnType<typeof leaderboardForMarketing>[number];
      if (index === 0) return marketingRow.actionableLeadYield === undefined ? 'Not available' : `${marketingRow.actionableLeadYield}%`;
      if (index === 1) return String(marketingRow.mql + marketingRow.sql);
      if (index === 2) return marketingRow.qualityRate === undefined ? 'Not available' : `${marketingRow.qualityRate}%`;
      if (index === 3) { const hours = median(leads.filter((lead) => lead.marketingOwnerId === marketingRow.userId).map(routingHours)); return hours === undefined ? 'Not available' : `${hours}h`; }
      return 'Not enough data';
    }
    const salesRow = row as ReturnType<typeof leaderboardForSales>[number];
    if (index === 0) { const hours = median(leads.filter((lead) => currentAssignment(lead)?.ownerId === salesRow.userId).map(responseHours)); return hours === undefined ? 'Not available' : `${hours}h`; }
    if (index === 1) return salesRow.followUpCompletionRate === undefined ? 'Not available' : `${salesRow.followUpCompletionRate}%`;
    if (index === 2) return String(salesRow.connected);
    if (index === 3) return String(salesRow.won);
    return 'Not enough data';
  };
  return <div className={`role-recognition-grid ${management ? 'management' : 'private'}`}>{labels.map((label, index) => { const Icon = recognitionIcons[index]; const person = names[index] ?? 'Not enough data'; return <article key={label} className={`role-recognition-card recognition-${index + 1}`}><h3>{label}</h3><div className="role-recognition-main"><span className="role-recognition-badge"><Icon size={33} /></span><div><small>{descriptions[index]}</small><strong>{management ? metricFor(index) : 'Private'}</strong></div></div>{management ? <div className="role-recognition-person"><span>{initials(person)}</span><div><b>{person}</b><small>{ranked[index] ? `Sample size: ${ranked[index].sampleSize} leads` : 'Not enough data'}</small></div></div> : <p>{descriptions[index]}</p>}<button onClick={() => onNavigate('Leaderboard')}>{management ? 'View full results' : 'Private result'} <IconArrowUpRight size={12} /></button></article>; })}<button className="admin-reference-footer-link" onClick={() => onNavigate('Leaderboard')}>View all recognition</button></div>;
}

function DisciplinePanel({ owners, followUps, overdue, onNavigate }: { owners: Array<{ name: string; work: number }>; followUps: ReturnType<typeof openFollowUps>; overdue: number; onNavigate: (page: string) => void }) {
  const average = owners.length ? owners.reduce((sum, row) => sum + row.work, 0) / owners.length : 0;
  const workload = [
    { name: 'Within capacity', value: owners.filter((row) => row.work <= average).length, color: '#20b99a' },
    { name: 'High', value: owners.filter((row) => row.work > average && row.work <= average * 1.2).length, color: '#f2a400' },
    { name: 'Overloaded', value: owners.filter((row) => row.work > average * 1.2).length, color: '#fb4d5c' },
  ];
  const followHealth = [
    { name: 'On time', value: followUps.filter((item) => dueClass(item.dueAt) === 'future').length, color: '#20b99a' },
    { name: 'Due today', value: followUps.filter((item) => dueClass(item.dueAt) === 'today').length, color: '#f2a400' },
    { name: 'Overdue', value: overdue, color: '#fb4d5c' },
  ];
  const ring = (data: typeof workload, center: string) => <div className="discipline-ring" role="img" aria-label={`${center}: ${data.map((item) => `${item.name} ${item.value}`).join(', ')}`}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="value" innerRadius={26} outerRadius={43} stroke="none" isAnimationActive={false}>{data.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie></PieChart></ResponsiveContainer><b>{center}</b></div>;
  const block = (title: string, data: typeof workload, center: string) => <div className="discipline-block"><h4>{title}</h4><div>{ring(data, center)}<ul>{data.map((item) => <li key={item.name}><i style={{ background: item.color }} /><span>{item.name}</span><b>{item.value}</b></li>)}</ul></div></div>;
  return <article className="role-reference-panel role-discipline-panel"><div className="admin-reference-panel-heading"><h3>Workload &amp; discipline</h3><span>This week</span></div>{block('Agent workload', workload, String(owners.length))}{block('Follow-up health', followHealth, String(followUps.length))}<button className="admin-reference-footer-link" onClick={() => onNavigate('Reports')}>View discipline report</button></article>;
}

function MarketingManagerDashboard({ viewer, leads, onNavigate }: { viewer: User; leads: Lead[]; onNavigate: (page: string) => void }) {
  const clean = valid(leads); const dashboard = dashboardFor({ ...viewer, role: 'admin' }, clean); const assigned = clean.filter((lead) => lead.assignments.length).length;
  const actionable = clean.filter((lead) => reached(lead, 'contacted') || lead.qualification !== 'not_available' || reached(lead, 'proposal_sent') || lead.status === 'won').length;
  const duplicates = duplicateMatches(clean).length; const incorrect = clean.filter((lead) => lead.status === 'incorrect').length;
  const routing = median(clean.map(routingHours));
  const metrics: Metric[] = [
    { label: 'Leads created', value: String(clean.length), Icon: IconUsers, tone: 'violet' },
    { label: 'Actionable lead yield', value: pct(actionable, clean.length), Icon: IconUserCircle, tone: 'pink' },
    { label: 'MQL', value: String(dashboard.mql), Icon: IconFilter, tone: 'blue' },
    { label: 'SQL', value: String(dashboard.sql), Icon: IconTrophy, tone: 'green' },
    { label: 'Sales acceptance', value: pct(assigned, clean.length), Icon: IconCircleCheck, tone: 'cyan' },
    { label: 'Quality risks', value: String(duplicates + incorrect + clean.filter((lead) => !lead.assignments.length).length), Icon: IconAlertTriangle, tone: 'amber' },
  ];
  const stages = [{ name: 'Created', value: clean.length, fill: '#8b5cf6' }, { name: 'Routed', value: assigned, fill: '#6758ee' }, { name: 'Accepted', value: assigned, fill: '#3977df' }, { name: 'MQL', value: dashboard.mql, fill: '#277ddc' }, { name: 'SQL', value: dashboard.sql, fill: '#18b7b2' }, { name: 'Won', value: dashboard.won, fill: '#54cf91' }];
  const risks = [
    { label: 'Missing contact detail', value: clean.filter((lead) => !lead.phone || !lead.email).length, tone: 'red', Icon: IconAlertTriangle },
    { label: 'Duplicates', value: duplicates, tone: 'amber', Icon: IconUsers },
    { label: 'Needs more information', value: clean.filter((lead) => lead.activities.some((item) => /more information/i.test(item.body))).length, tone: 'amber', Icon: IconBulb },
    { label: 'Slow routing', value: clean.filter((lead) => (routingHours(lead) ?? 0) > 24).length, tone: 'yellow', Icon: IconClock, note: routing === undefined ? 'Not available' : `${routing}h median` },
  ];
  return <><section className="role-reference-section"><SectionTitle title="Work now" action="View all actions" onAction={() => onNavigate('Lead inbox')} /><MetricGrid metrics={metrics} /></section><section className="role-reference-section"><SectionTitle title="Performance" /><div className="marketing-manager-grid"><FunnelPanel title="Lead quality journey" stages={stages} footer="Overall conversion (Created to Won)" /><RiskPanel title="Quality risks" rows={risks} onNavigate={onNavigate} /><SourcePanel leads={clean} onNavigate={onNavigate} /><TrendPanel leads={clean} title="Routing & acceptance" onNavigate={onNavigate} /></div></section><section className="role-reference-section"><SectionTitle title="Momentum & Recognition" /><RecognitionGrid kind="marketing-manager" leads={clean} viewer={viewer} management onNavigate={onNavigate} /></section></>;
}

function SalesManagerDashboard({ viewer, leads, onNavigate }: { viewer: User; leads: Lead[]; onNavigate: (page: string) => void }) {
  const clean = valid(leads); const dashboard = dashboardFor(viewer, clean); const followUps = openFollowUps(clean); const dueToday = followUps.filter((item) => dueClass(item.dueAt) === 'today').length; const overdue = followUps.filter((item) => dueClass(item.dueAt) === 'overdue').length;
  const connected = clean.filter((lead) => reached(lead, 'connected')).length; const proposals = clean.filter((lead) => reached(lead, 'proposal_sent')).length; const response = median(clean.map(responseHours));
  const metrics: Metric[] = [
    { label: 'Open opportunities', value: String(clean.filter((lead) => !terminal.has(lead.status)).length), Icon: IconBriefcase, tone: 'violet' },
    { label: 'Due today', value: String(dueToday), Icon: IconChecklist, tone: 'pink' },
    { label: 'Overdue follow-ups', value: String(overdue), Icon: IconClock, tone: 'red' },
    { label: 'Median response time', value: response === undefined ? 'Not available' : `${response}h`, Icon: IconActivityHeartbeat, tone: 'cyan' },
    { label: 'Connection rate', value: pct(connected, clean.length), Icon: IconUsers, tone: 'green' },
    { label: 'Proposal-to-won', value: pct(dashboard.won, Math.max(proposals, dashboard.won)), Icon: IconTrophy, tone: 'green' },
  ];
  const stages = [{ name: 'Assigned', value: clean.filter((lead) => lead.assignments.length).length, fill: '#8b5cf6' }, { name: 'Contacted', value: clean.filter((lead) => reached(lead, 'contacted')).length, fill: '#6659f4' }, { name: 'Connected', value: connected, fill: '#3478df' }, { name: 'SQL', value: dashboard.sql, fill: '#2579df' }, { name: 'Proposal', value: proposals, fill: '#14afa7' }, { name: 'Won', value: dashboard.won, fill: '#53ca94' }];
  const watch = [
    { label: 'Unaccepted handoffs', value: clean.filter((lead) => lead.assignments.length && !reached(lead, 'contacted')).length, tone: 'red', Icon: IconUsers },
    { label: 'Uncontacted assignments', value: clean.filter((lead) => lead.assignments.length && !reached(lead, 'contacted')).length, tone: 'red', Icon: IconUserCircle },
    { label: 'Overdue follow-ups', value: overdue, tone: 'red', Icon: IconClock },
    { label: 'Stalled proposals', value: clean.filter((lead) => lead.status === 'proposal_sent').length, tone: 'amber', Icon: IconChecklist },
    { label: 'Aging leads', value: clean.filter((lead) => !terminal.has(lead.status) && Date.now() - new Date(lead.sourceDate).getTime() > 7 * 86400000).length, tone: 'amber', Icon: IconClock },
  ];
  const losses = lossReasonBreakdown(clean).slice(0, 7); const maxLoss = Math.max(1, ...losses.map((row) => row.count));
  const owners = users.filter((user) => user.role === 'sales_agent').map((user) => ({ name: user.name, work: clean.filter((lead) => currentAssignment(lead)?.ownerId === user.id).length }));
  return <><section className="role-reference-section"><SectionTitle title="Work now" action="View all actions" onAction={() => onNavigate('Follow-ups')} /><MetricGrid metrics={metrics} /></section><section className="sales-manager-main-grid"><FunnelPanel title="Team pipeline" stages={stages} footer="Assigned to Won" /><RiskPanel title="Operating watchlist" rows={watch} onNavigate={onNavigate} /><article className="role-reference-panel"><div className="admin-reference-panel-heading"><h3>Loss &amp; recovery</h3><span>Selected period</span></div><div className="role-loss-list">{losses.length ? losses.map((row) => <div key={row.reason}><span>{row.reason}</span><i><b style={{ width: `${Math.max(8, row.count / maxLoss * 100)}%` }} /></i><strong>{row.count}</strong></div>) : <p className="role-empty">Not enough data</p>}</div><button className="admin-reference-footer-link" onClick={() => onNavigate('Reports')}>View loss report</button></article><DisciplinePanel owners={owners} followUps={followUps} overdue={overdue} onNavigate={onNavigate} /></section><section className="role-reference-section"><SectionTitle title="Momentum & Recognition" /><RecognitionGrid kind="sales-manager" leads={clean} viewer={viewer} management onNavigate={onNavigate} /></section></>;
}

function MarketingAgentDashboard({ viewer, leads, onNavigate }: { viewer: User; leads: Lead[]; onNavigate: (page: string) => void }) {
  const clean = valid(leads); const dashboard = dashboardFor(viewer, clean); const assigned = clean.filter((lead) => lead.assignments.length).length; const actionable = clean.filter((lead) => reached(lead, 'contacted') || lead.qualification !== 'not_available' || reached(lead, 'proposal_sent') || lead.status === 'won').length; const routing = median(clean.map(routingHours));
  const qualityMetrics: Metric[] = [
    { label: 'Leads created', value: String(clean.length), Icon: IconUsers, tone: 'pink' },
    { label: 'Actionable Lead Yield', value: pct(actionable, clean.length), Icon: IconFilter, tone: 'violet' },
    { label: 'MQL', value: String(dashboard.mql), Icon: IconUserCircle, tone: 'blue' },
    { label: 'SQL', value: String(dashboard.sql), Icon: IconFilter, tone: 'cyan' },
    { label: 'Sales acceptance', value: pct(assigned, clean.length), Icon: IconCurrencyDollar, tone: 'green' },
    { label: 'Clean-data rate', value: pct(clean.filter((lead) => Boolean(lead.phone && lead.email && lead.source)).length, clean.length), Icon: IconChartBar, tone: 'amber' },
  ];
  const queue = [
    { label: 'Leads missing source / contact detail', value: clean.filter((lead) => !lead.phone || !lead.email || !lead.source).length, Icon: IconAlertTriangle, tone: 'violet' },
    { label: 'Duplicate candidates', value: duplicateMatches(clean).length, Icon: IconUsers, tone: 'pink' },
    { label: 'Sales needs more information', value: clean.filter((lead) => lead.activities.some((item) => /more information/i.test(item.body))).length, Icon: IconBulb, tone: 'blue' },
    { label: 'Unrouted leads', value: clean.filter((lead) => !lead.assignments.length).length, Icon: IconTarget, tone: 'cyan' },
    { label: 'Slow-routing leads', value: clean.filter((lead) => (routingHours(lead) ?? 0) > 24).length, Icon: IconClock, tone: 'amber' },
  ];
  const journey = [{ label: 'Created', value: clean.length, Icon: IconUsers }, { label: 'Routed', value: assigned, Icon: IconArrowUpRight }, { label: 'Accepted', value: assigned, Icon: IconCircleCheck }, { label: 'MQL', value: dashboard.mql, Icon: IconUserCircle }, { label: 'SQL', value: dashboard.sql, Icon: IconFilter }, { label: 'Won', value: dashboard.won, Icon: IconTrophy }];
  return <><section className="role-reference-section"><SectionTitle title="My quality queue" action="View all actions" onAction={() => onNavigate('Lead inbox')} /><div className="marketing-agent-queue">{queue.map(({ label, value, Icon, tone }) => <button key={label} className={`marketing-queue-card tone-${tone}`} onClick={() => onNavigate('Lead inbox')}><span className="admin-reference-metric-icon"><Icon size={23} /></span><div><h3>{label}</h3><strong>{value}</strong><small>View <IconArrowUpRight size={13} /></small></div></button>)}</div></section><section className="role-reference-section"><SectionTitle title="My quality" /><MetricGrid metrics={qualityMetrics} label="My quality" /></section><section className="marketing-agent-insights"><article className="role-reference-panel"><div className="admin-reference-panel-heading"><h3>My impact journey</h3></div><div className="impact-journey" role="img" aria-label={`My impact journey: ${journey.map((item) => `${item.label} ${item.value}`).join(', ')}`}>{journey.map(({ label, value, Icon }, index) => <div key={label}><span><Icon size={23} /></span>{index < journey.length - 1 && <i>→</i>}<b>{label}</b><strong>{value}</strong><small>{index ? pct(value, journey[index - 1].value) : '100%'}</small></div>)}</div><footer>Overall conversion (Created → Won): <b>{pct(dashboard.won, clean.length)}</b></footer></article><SourceLearningPanel leads={clean} onNavigate={onNavigate} /><TrendPanel leads={clean} title="Routing speed / acceptance trend" onNavigate={onNavigate} /></section><section className="marketing-agent-bottom"><article className="role-reference-section agent-growth"><SectionTitle title="My growth" /><div className="growth-grid"><GrowthItem Icon={IconChartBar} title="Prior-period comparison" value="Not enough data" note="A comparable prior period is required." /><GrowthItem Icon={IconCircleCheck} title="Strongest habit" value={routing === undefined ? 'Not available' : 'Routing discipline'} note={routing === undefined ? 'Routing evidence is not available.' : `${routing}h median routing time`} /><GrowthItem Icon={IconTarget} title="Improvement focus" value={dashboard.mql ? 'Increase SQL yield' : 'Record qualification'} note="Improve the next controllable quality step." /><GrowthItem Icon={IconBriefcase} title="Private benchmark" value="Not enough data" note="Your peers remain anonymous." /></div></article><article className="role-reference-section agent-recognition"><SectionTitle title="My recognition" /><RecognitionGrid kind="marketing-agent" leads={clean} viewer={viewer} management={false} onNavigate={onNavigate} /></article></section></>;
}

function GrowthItem({ Icon, title, value, note }: { Icon: typeof IconUsers; title: string; value: string; note: string }) {
  return <div className="growth-item"><Icon size={24} /><span>{title}</span><b>{value}</b><small>{note}</small></div>;
}

function SalesAgentDashboard({ viewer, leads, onNavigate, onOpenLead }: { viewer: User; leads: Lead[]; onNavigate: (page: string) => void; onOpenLead: (leadId: string) => void }) {
  const clean = valid(leads); const dashboard = dashboardFor(viewer, clean); const followUps = openFollowUps(clean); const dueToday = followUps.filter((item) => dueClass(item.dueAt) === 'today').length; const overdue = followUps.filter((item) => dueClass(item.dueAt) === 'overdue').length; const connected = clean.filter((lead) => reached(lead, 'connected')).length; const response = median(clean.map(responseHours));
  const completed = clean.flatMap((lead) => lead.followUps).filter((item) => item.status === 'completed').length; const proposals = clean.filter((lead) => reached(lead, 'proposal_sent')).length;
  const metrics: Metric[] = [
    { label: 'Open leads', value: String(clean.filter((lead) => !terminal.has(lead.status)).length), Icon: IconUserCircle, tone: 'pink' },
    { label: 'Due today', value: String(dueToday), Icon: IconClock, tone: 'amber' },
    { label: 'Overdue', value: String(overdue), Icon: IconAlertTriangle, tone: 'red' },
    { label: 'Median response time', value: response === undefined ? 'Not available' : `${response}h`, Icon: IconActivityHeartbeat, tone: 'cyan' },
    { label: 'Connection rate', value: pct(connected, clean.length), Icon: IconUsers, tone: 'blue' },
    { label: 'Follow-up completion', value: pct(completed, completed + followUps.length), Icon: IconChecklist, tone: 'violet' },
  ];
  const priorities = clean.filter((lead) => !terminal.has(lead.status)).sort((a, b) => b.priority - a.priority).slice(0, 6);
  const stages = [{ label: 'Assigned', value: clean.filter((lead) => lead.assignments.length).length, Icon: IconUserCircle }, { label: 'Connected', value: connected, Icon: IconUsers }, { label: 'SQL', value: dashboard.sql, Icon: IconFilter }, { label: 'Proposal', value: proposals, Icon: IconChecklist }, { label: 'Won', value: dashboard.won, Icon: IconTrophy }];
  const losses = lossReasonBreakdown(clean).slice(0, 5); const maxLoss = Math.max(1, ...losses.map((row) => row.count));
  const financial = financialMetrics(clean);
  return <><section className="role-reference-section sales-priority"><SectionTitle title="Today's priority queue" action="View all tasks" onAction={() => onNavigate('Follow-ups')} /><div className="priority-table"><div className="priority-row header"><span>Priority</span><span>Task</span><span>Lead / Account</span><span>Status</span><span>Source</span><span>Due</span><span>Action</span></div>{priorities.length ? priorities.map((lead) => { const follow = lead.followUps.find((item) => item.status === 'open'); const due = follow ? dueClass(follow.dueAt) : 'future'; const task = lead.status === 'proposal_sent' ? 'Proposal follow-up' : due === 'overdue' ? 'Overdue' : due === 'today' ? 'Due today' : !reached(lead, 'contacted') ? 'New assignment' : 'Continue engagement'; return <button className="priority-row" key={lead.id} onClick={() => onOpenLead(lead.id)}><span className={`priority-icon ${due}`}><IconAlertTriangle size={17} /></span><span><b>{task}</b><small>{lead.status === 'proposal_sent' ? 'Awaiting response' : 'Next best action'}</small></span><span><b>{lead.name}</b><small>{lead.email ?? lead.phone ?? 'Contact protected'}</small></span><span className="priority-status">{lead.status.replaceAll('_', ' ')}</span><span>{lead.source}</span><span>{follow ? new Date(follow.dueAt).toLocaleDateString() : 'Not available'}</span><span className="priority-action">Take action <IconArrowUpRight size={13} /></span></button>; }) : <p className="role-empty">No active priority work is available.</p>}</div></section><section className="role-reference-section"><SectionTitle title="My execution" action="View execution report" onAction={() => onNavigate('Reports')} /><MetricGrid metrics={metrics} /></section><section className="sales-agent-insights"><article className="role-reference-panel"><SectionTitle title="My conversion path" action="View pipeline" onAction={() => onNavigate('Lead inbox')} /><div className="sales-path" role="img" aria-label={`My conversion path: ${stages.map((item) => `${item.label} ${item.value}`).join(', ')}`}>{stages.map(({ label, value, Icon }, index) => <div key={label}><span><Icon size={21} /></span>{index < stages.length - 1 && <i>→</i>}<b>{label}</b><strong>{value}</strong><small>{index ? pct(value, stages[index - 1].value) : '100%'}</small></div>)}</div><footer>Conversion rate (Assigned → Won) <b>{pct(dashboard.won, stages[0].value)}</b></footer></article><article className="role-reference-panel"><SectionTitle title="My loss learning" action="View insights" onAction={() => onNavigate('Reports')} /><div className="role-loss-list" role="img" aria-label={`Loss reasons: ${losses.length ? losses.map((item) => `${item.reason} ${item.count}`).join(', ') : 'Not enough data'}`}>{losses.length ? losses.map((row) => <div key={row.reason}><span>{row.reason}</span><i><b style={{ width: `${Math.max(8, row.count / maxLoss * 100)}%` }} /></i><strong>{row.count}</strong></div>) : <p className="role-empty">Not enough data</p>}</div><footer>Losses analyzed <b>{losses.reduce((sum, row) => sum + row.count, 0)}</b></footer></article><article className="role-reference-panel"><SectionTitle title="My growth" action="View growth plan" onAction={() => onNavigate('Reports')} /><div className="growth-list"><GrowthItem Icon={IconChartBar} title="Prior period trend" value="Not enough data" note="Comparable history required" /><GrowthItem Icon={IconCircleCheck} title="Strongest habit" value={response === undefined ? 'Not available' : `${response}h response`} note="Based on recorded first contact" /><GrowthItem Icon={IconTarget} title="Improvement focus" value={overdue ? 'Clear overdue work' : 'Advance conversations'} note={`${overdue} overdue follow-ups`} /><GrowthItem Icon={IconBriefcase} title="Won value" value={financial.financialRecordCount ? money(financial.totalProjectValue) : 'Not available'} note="Private result" /></div></article></section><section className="role-reference-section"><SectionTitle title="My recognition" action="View all recognition" onAction={() => onNavigate('Leaderboard')} /><RecognitionGrid kind="sales-agent" leads={clean} viewer={viewer} management={false} onNavigate={onNavigate} /></section></>;
}

export function RoleReferenceDashboard({ kind, viewer, viewers, leads, period, source, theme, onViewer, onPeriod, onSource, onTheme, onNavigate, onCreate, onOpenLead }: { kind: RoleReferenceKind; viewer: User; viewers: User[]; leads: Lead[]; period: DashboardPeriod; source: string; theme: 'light' | 'dark'; onViewer: (viewerId: string) => void; onPeriod: (value: DashboardPeriod) => void; onSource: (value: string) => void; onTheme: (value: 'light' | 'dark') => void; onNavigate: (page: string) => void; onCreate: () => void; onOpenLead: (leadId: string) => void }) {
  return <div className={`role-reference-dashboard role-${kind}`}><RoleTopbar kind={kind} viewer={viewer} viewers={viewers} period={period} source={source} theme={theme} onViewer={onViewer} onPeriod={onPeriod} onSource={onSource} onTheme={onTheme} onCreate={onCreate} />{kind === 'marketing-manager' && <MarketingManagerDashboard viewer={viewer} leads={leads} onNavigate={onNavigate} />}{kind === 'sales-manager' && <SalesManagerDashboard viewer={viewer} leads={leads} onNavigate={onNavigate} />}{kind === 'marketing-agent' && <MarketingAgentDashboard viewer={viewer} leads={leads} onNavigate={onNavigate} />}{kind === 'sales-agent' && <SalesAgentDashboard viewer={viewer} leads={leads} onNavigate={onNavigate} onOpenLead={onOpenLead} />}</div>;
}
