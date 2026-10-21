import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { IconArrowUpRight, IconCalendar, IconChartBar, IconClock, IconCurrencyDollar, IconFilter, IconRefresh, IconTrophy, IconUsers } from '@tabler/icons-react';
import { Bar, BarChart, CartesianGrid, Cell, Funnel, FunnelChart, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { sourceOptions, statusLabels, type DashboardPeriod, type OpportunityStatus, type User } from './domain';
import { RoleSwitcher } from './RoleReferenceDashboards';
import { ConnectionAnalyticsPanel } from './ConnectionAnalyticsPanel';
import { historicalStatusCounts, performanceRows, summaryNumber, summaryPercent, workloadBuckets, type WorkspaceSummary } from './workspaceSummary';
import './remoteDashboard.css';

export type RemoteDashboardProps = {
  viewer: User; viewers: User[]; summary?: WorkspaceSummary; loading?: boolean; error?: string; onRetry: () => void;
  period: DashboardPeriod; customStart: string; customEnd: string; source: string; theme: 'light' | 'dark';
  onViewer: (id: string) => void; onPeriod: (period: DashboardPeriod) => void;
  onCustomStart: (value: string) => void; onCustomEnd: (value: string) => void;
  onSource: (value: string) => void; onTheme: (theme: 'light' | 'dark') => void; onNavigate: (page: string) => void;
  onOpenLead?: (id: string) => void; session?: Session | null; start?: string; end?: string;
  page?: 'Dashboard' | 'Reports' | 'Leaderboard' | 'Benchmark Board' | 'Data quality';
};

const periods: Record<DashboardPeriod, string> = { daily: 'Today', weekly: 'This week', monthly: 'This month', yearly: 'This year', lifetime: 'Lifetime', custom: 'Custom range' };
const palette = ['#8b5cf6', '#6659f4', '#2579df', '#15aaa4', '#53ca94'];
const tooltipStyle = { background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)', borderRadius: 8 };
const labelFor = (status: string) => statusLabels[status as OpportunityStatus] ?? status.replaceAll('_', ' ');
const money = (amount: number | null | undefined) => amount == null ? 'Not available' : `$${amount.toLocaleString()}`;
type Metric = { label: string; value: string; note?: string };

function Panel({ title, note, children, action, onAction }: { title: string; note?: string; children: ReactNode; action?: string; onAction?: () => void }) {
  return <article className="admin-reference-panel remote-summary-panel"><div className="admin-reference-panel-heading"><h3>{title}</h3>{note && <span>{note}</span>}</div>{children}{action && onAction && <button className="admin-reference-footer-link" onClick={onAction}>{action} <IconArrowUpRight size={14} /></button>}</article>;
}

function Metrics({ values }: { values: Metric[] }) {
  const icons = [IconUsers, IconFilter, IconChartBar, IconTrophy, IconCurrencyDollar, IconClock];
  return <div className="admin-reference-metrics remote-summary-metrics">{values.map((item, index) => {
    const Icon = icons[index % icons.length];
    return <article className={`admin-reference-metric tone-${['violet', 'pink', 'blue', 'green', 'cyan', 'amber'][index % 6]}`} key={item.label}><span className="admin-reference-metric-icon"><Icon size={24} /></span><div><h3>{item.label}</h3><strong>{item.value}</strong><small>{item.note ?? 'All matching records, not the visible list page'}</small></div></article>;
  })}</div>;
}

function Bars({ values, title, color = '#8b5cf6' }: { values: Array<{ name: string; value: number }>; title: string; color?: string }) {
  if (!values.length || values.every(row => row.value === 0)) return <p className="role-empty">No recorded results for this selection.</p>;
  return <div role="img" aria-label={`${title}: ${values.map(row => `${row.name} ${row.value}`).join(', ')}`}><ResponsiveContainer width="100%" height={Math.max(220, Math.min(540, values.length * 35))}><BarChart data={values} layout="vertical" margin={{ left: 0, right: 24 }}><CartesianGrid stroke="var(--border)" horizontal={false} /><XAxis type="number" allowDecimals={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} /><YAxis type="category" dataKey="name" width={125} tick={{ fill: 'var(--text)', fontSize: 11 }} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="value" name="Leads" fill={color} isAnimationActive={false} radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div>;
}

function Ring({ values, title }: { values: Array<{ name: string; value: number; color: string }>; title: string }) {
  return <div className="remote-summary-ring" role="img" aria-label={`${title}: ${values.map(row => `${row.name} ${row.value}`).join(', ')}`}><ResponsiveContainer width="100%" height={190}><PieChart><Pie data={values} dataKey="value" nameKey="name" innerRadius={48} outerRadius={74} isAnimationActive={false}>{values.map(row => <Cell key={row.name} fill={row.color} />)}</Pie><Tooltip contentStyle={tooltipStyle} /></PieChart></ResponsiveContainer><dl>{values.map(row => <div key={row.name}><dt><i style={{ background: row.color }} />{row.name}</dt><dd>{row.value}</dd></div>)}</dl></div>;
}

function HistoricalPerformance({ summary, viewer }: { summary: WorkspaceSummary; viewer: User }) {
  const rows = performanceRows(summary, viewer);
  const aggregate = historicalStatusCounts(summary, viewer);
  return <><Panel title={viewer.role === 'sales_agent' ? 'My historical status achievements' : viewer.role === 'marketer' ? 'Historical outcomes from my leads' : 'Historical sales performance'} note="Retained after status changes and reassignment"><p className="remote-summary-note">Each lead is counted once per agent and status. One lead can appear in several stages. These are not the current pipeline counts.</p><Bars title="Historical status achievements" values={Object.entries(aggregate).map(([status, value]) => ({ name: labelFor(status), value }))} /></Panel>
    <Panel title="Historical results by agent" note="Credit stays with the person who recorded the outcome"><div className="table-wrap"><table className="responsive-data-table"><thead><tr><th>Agent</th><th>Worked leads</th><th>Connected</th><th>Proposal</th><th>Won</th><th>Lost</th><th>Assigned now</th></tr></thead><tbody>{rows.map(row => <tr key={row.userId}><th>{row.name}</th><td>{row.worked}</td><td>{row.connected}</td><td>{row.proposal}</td><td>{row.won}</td><td>{row.lost}</td><td>{row.currentAssigned}</td></tr>)}</tbody></table>{!rows.length && <p className="role-empty">No attributed activity in this selection.</p>}</div></Panel></>;
}

function SourceComparison({ summary, onNavigate }: { summary: WorkspaceSummary; onNavigate: (page: string) => void }) {
  return <Panel title="Source quality" note="Current qualification and outcome by source" action="View full source report" onAction={() => onNavigate('Benchmark Board')}><Bars title="Leads by source" values={summary.sourceCounts.map(row => ({ name: row.source, value: row.count }))} /><div className="table-wrap"><table><thead><tr><th>Source</th><th>Leads</th><th>MQL</th><th>SQL</th><th>Won</th><th>Won rate</th></tr></thead><tbody>{summary.sourceCounts.map(row => <tr key={row.source}><th>{row.source}</th><td>{row.count}</td><td>{summaryNumber(row.mql)}</td><td>{summaryNumber(row.sql)}</td><td>{summaryNumber(row.won)}</td><td>{summaryPercent(row.won, row.count)}</td></tr>)}</tbody></table></div></Panel>;
}

function Quality({ summary, onNavigate }: { summary: WorkspaceSummary; onNavigate: (page: string) => void }) {
  const t = summary.totals;
  const rows = [
    ['Missing contact details', t.missingContact], ['Duplicate candidates', t.duplicateCandidates], ['Incorrect', t.incorrect],
    ['Needs more information', t.needsInformation], ['Unassigned', t.unassigned], ['Slow routing', t.slowRouting], ['Admin review', t.pendingReview],
  ] as const;
  return <Panel title="Quality risks" note="Categories can overlap; do not add them together" action="Open review queue" onAction={() => onNavigate('Review queue')}><dl className="remote-summary-facts">{rows.map(([label, count]) => <div key={label}><dt>{label}</dt><dd>{summaryNumber(count)}</dd></div>)}</dl><p className="remote-summary-note">Summary covers all permitted matching records. Original lead data remains unchanged.</p></Panel>;
}

function Trend({ summary }: { summary: WorkspaceSummary }) {
  return <Panel title="Daily activity & routing" note="Recorded events"><div role="img" aria-label={`Activity trend across ${summary.trend.length} dates`}><ResponsiveContainer width="100%" height={260}><LineChart data={summary.trend}><CartesianGrid stroke="var(--border)" strokeDasharray="3 3" /><XAxis dataKey="date" minTickGap={35} tick={{ fill: 'var(--muted)', fontSize: 10 }} /><YAxis allowDecimals={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} /><Tooltip contentStyle={tooltipStyle} /><Legend /><Line type="monotone" dataKey="activity" name="Activities" stroke="#8b5cf6" dot={false} isAnimationActive={false} /><Line type="monotone" dataKey="routing" name="Assignments" stroke="#16b6bd" dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div></Panel>;
}

function Pipeline({ summary, marketing }: { summary: WorkspaceSummary; marketing: boolean }) {
  const t = summary.totals;
  const stages = [{ name: 'Leads', value: t.total }, ...(marketing ? [{ name: 'Routed', value: t.assigned }] : []), { name: 'MQL', value: t.mql }, { name: 'SQL', value: t.sql }, { name: 'Won', value: t.won }].map((row, index) => ({ ...row, fill: palette[index % palette.length] }));
  return <Panel title={marketing ? 'Lead quality journey' : 'Conversion funnel'} note="Current pipeline snapshot"><div className="remote-summary-funnel"><div role="img" aria-label={`Current pipeline: ${stages.map(stage => `${stage.name} ${stage.value}`).join(', ')}`}><ResponsiveContainer width="100%" height={250}><FunnelChart><Tooltip contentStyle={tooltipStyle} /><Funnel data={stages} dataKey="value" isAnimationActive={false} /></FunnelChart></ResponsiveContainer></div><dl>{stages.map(stage => <div key={stage.name}><dt>{stage.name}</dt><dd>{stage.value}<small>{summaryPercent(stage.value, t.total)}</small></dd></div>)}</dl></div><p className="remote-summary-note">MQL and SQL show current qualification. Historical achievements are reported separately below.</p></Panel>;
}

export function RemoteDashboard(props: RemoteDashboardProps) {
  const { viewer, viewers, summary, loading, error, onRetry, period, customStart, customEnd, source, theme, onViewer, onPeriod, onCustomStart, onCustomEnd, onSource, onTheme, onNavigate, onOpenLead, session, start, end, page = 'Dashboard' } = props;
  const admin = viewer.role === 'admin';
  const marketing = viewer.role === 'marketer' || (viewer.role === 'manager' && viewer.department === 'marketing');
  const personal = viewer.role === 'sales_agent' || viewer.role === 'marketer';
  const title = page !== 'Dashboard' ? page : admin ? 'Company Command Center' : marketing ? (personal ? 'My Marketing Workspace' : 'Marketing Quality Command') : (personal ? 'My Sales Workspace' : 'Sales Command Center');
  const header = <header className="admin-reference-topbar"><h1>{title}</h1><div className="admin-reference-controls">{viewers.length > 1 && <RoleSwitcher viewer={viewer} viewers={viewers} onViewer={onViewer} />}<label className="admin-reference-select"><IconCalendar size={17} /><select aria-label="Period" value={period} onChange={event => onPeriod(event.target.value as DashboardPeriod)}>{Object.entries(periods).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="admin-reference-select"><IconFilter size={17} /><select aria-label="Source" value={source} onChange={event => onSource(event.target.value)}><option value="all">All Sources</option>{sourceOptions.map(value => <option key={value} value={value}>{value}</option>)}</select></label><button className="quiet" onClick={onRetry} disabled={loading}><IconRefresh size={16} /> Refresh</button><button className="quiet" aria-label="Toggle dark mode" aria-pressed={theme === 'dark'} onClick={() => onTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? 'Light' : 'Dark'}</button></div></header>;
  const dateControls = period === 'custom' && <section className="custom-date-range"><label>From<input aria-label="Custom range from" type="date" value={customStart} max={customEnd || undefined} onChange={event => onCustomStart(event.target.value)} /></label><label>To<input aria-label="Custom range to" type="date" value={customEnd} min={customStart || undefined} onChange={event => onCustomEnd(event.target.value)} /></label>{customStart && customEnd && customStart > customEnd && <p role="alert">The To date must be on or after the From date.</p>}</section>;
  // Never show sample records, zero placeholders, or a stale different user's
  // totals while an authenticated summary request is unresolved.
  if (!summary || summary.viewerId !== viewer.id) return <div className="admin-reference-dashboard remote-summary-dashboard">{header}{dateControls}<section className="remote-summary-state" role={error ? 'alert' : 'status'}><h2>{error ? 'Dashboard could not load' : 'Loading your dashboard'}</h2><p>{error || 'Fetching complete counts and historical performance. Lead pages load separately.'}</p>{error && <button onClick={onRetry}>Retry dashboard</button>}</section></div>;
  const t = summary.totals;
  const metrics: Metric[] = admin ? [
    { label: 'Leads', value: summaryNumber(t.total) }, { label: 'MQL', value: summaryNumber(t.mql) }, { label: 'SQL', value: summaryNumber(t.sql) },
    { label: 'Won', value: summaryNumber(t.won) }, { label: 'Pipeline Value', value: t.financialRecordCount ? money(t.totalProjectValue) : 'Not available', note: 'Recorded value of Won leads' }, { label: 'Overdue', value: summaryNumber(t.overdue) },
  ] : marketing ? [
    { label: 'Leads created', value: summaryNumber(t.total) }, { label: 'Actionable lead yield', value: summaryPercent(t.actionable, t.total) },
    { label: 'MQL', value: summaryNumber(t.mql) }, { label: 'SQL', value: summaryNumber(t.sql) }, { label: 'Routed to Sales', value: summaryPercent(t.assigned, t.total) }, { label: 'Clean-data rate', value: summaryPercent(t.cleanData, t.total) },
  ] : [
    { label: 'Open leads', value: summaryNumber(t.open) }, { label: 'Due today', value: summaryNumber(t.dueToday) }, { label: 'Overdue', value: summaryNumber(t.overdue) },
    { label: 'Median response time', value: t.medianResponseHours == null ? 'Not available' : `${t.medianResponseHours}h` },
    { label: 'Follow-up completion', value: t.followUpsCompleted == null || t.followUpsOpen == null ? 'Not available' : summaryPercent(t.followUpsCompleted, t.followUpsCompleted + t.followUpsOpen) },
    { label: 'Assigned now', value: summaryNumber(t.assigned) },
  ];
  if (!admin && !marketing && viewer.role === 'manager') {
    const salesRows = performanceRows(summary, viewer).filter(row => row.role !== 'marketer');
    const worked = salesRows.reduce((sum, row) => sum + row.worked, 0);
    const connections = salesRows.reduce((sum, row) => sum + row.connected, 0);
    const proposals = salesRows.reduce((sum, row) => sum + row.proposal, 0);
    const wins = salesRows.reduce((sum, row) => sum + row.won, 0);
    metrics.push({ label: 'Historical connection rate', value: summaryPercent(connections, worked), note: 'Connected / worked agent-lead pairs' }, { label: 'Historical proposal-to-won', value: summaryPercent(wins, Math.max(proposals, wins)), note: 'Historical achievements retained after reassignment' });
  }
  const followHealth = [{ name: 'Open, not overdue', value: Math.max(0, (t.followUpsOpen ?? t.dueToday + t.overdue) - t.overdue), color: '#20b99a' }, { name: 'Overdue', value: t.overdue, color: '#fb4d5c' }, { name: 'Completed', value: t.followUpsCompleted ?? 0, color: '#8b5cf6' }];
  const roles = performanceRows(summary, viewer);
  const wonRank = roles.filter(row => row.role !== 'marketer').slice().sort((a, b) => b.won - a.won).slice(0, 5);
  const sourcePanel = <SourceComparison summary={summary} onNavigate={onNavigate} />;
  const qualityPanel = <Quality summary={summary} onNavigate={onNavigate} />;
  let body: ReactNode;
  if (page === 'Leaderboard') body = <><HistoricalPerformance summary={summary} viewer={viewer} /><Panel title={personal ? 'My standing' : 'Recognition'} note="Historical Won leads"><Bars title="Won leads by agent" values={wonRank.map(row => ({ name: row.name, value: row.won }))} color="#20b99a" /><p className="remote-summary-note">Most improved: Not available. A comparable prior-period baseline is required. Current assignments and historical credit are different measures.</p></Panel></>;
  else if (page === 'Benchmark Board') body = <>{sourcePanel}<Panel title="Service mix" note="All matching leads"><Bars title="Lead categories" values={summary.categoryCounts.map(row => ({ name: row.category, value: row.count }))} /></Panel></>;
  else if (page === 'Data quality') body = <>{qualityPanel}<Panel title="Data reconciliation" note="Complete permission-scoped summary"><dl className="remote-summary-facts"><div><dt>Leads</dt><dd>{t.total}</dd></div><div><dt>Status distribution</dt><dd>{Object.values(summary.statusCounts).reduce((sum, count) => sum + count, 0)}</dd></div><div><dt>Source distribution</dt><dd>{summary.sourceCounts.reduce((sum, row) => sum + row.count, 0)}</dd></div><div><dt>Review items</dt><dd>{t.pendingReview}</dd></div></dl><p className="remote-summary-note">Lead records are available on demand from the inbox and review queue. No full workspace history download is needed.</p></Panel></>;
  else body = <>
    {page === 'Dashboard' && personal && !marketing && <Panel title="Today's priority queue" action="View all tasks" onAction={() => onNavigate('Follow-ups')}><div className="remote-summary-priorities">{summary.priorities?.length ? summary.priorities.map(row => <button key={row.id} onClick={() => onOpenLead ? onOpenLead(row.id) : onNavigate('Lead inbox')}><b>{row.name}</b><span>{labelFor(row.status)}</span><span>{row.source}</span><small>{row.dueAt ? new Date(row.dueAt).toLocaleDateString() : 'No follow-up date'}</small><IconArrowUpRight size={15} /></button>) : <p className="role-empty">No active priority work in this selection.</p>}</div></Panel>}
    <Pipeline summary={summary} marketing={marketing} />
    <Panel title="Current lead statuses" note="One current status per lead"><Bars title="Current lead statuses" values={Object.entries(summary.statusCounts).map(([status, value]) => ({ name: labelFor(status), value }))} /></Panel>
    {sourcePanel}
    <Panel title="Overdue follow-ups" action="View follow-ups" onAction={() => onNavigate('Follow-ups')}><dl className="remote-summary-facts"><div><dt>Overdue now</dt><dd>{t.overdue}</dd></div><div><dt>Due today</dt><dd>{t.dueToday}</dd></div><div><dt>1 to 3 days overdue</dt><dd>{summaryNumber(t.overdue1To3)}</dd></div><div><dt>3 to 7 days overdue</dt><dd>{summaryNumber(t.overdue3To7)}</dd></div><div><dt>7 or more days overdue</dt><dd>{summaryNumber(t.overdue7Plus)}</dd></div></dl><Ring title="Follow-up health" values={followHealth} /></Panel>
    <Trend summary={summary} />
    {admin && <Panel title="Sales execution" note="Recorded activity, not inferred from notes"><dl className="remote-summary-facts"><div><dt>Meetings booked</dt><dd>{summaryNumber(t.meetingsBooked)}</dd></div><div><dt>Meetings held</dt><dd>{summaryNumber(t.meetingsHeld)}</dd></div><div><dt>Current proposals</dt><dd>{t.proposal}</dd></div><div><dt>Current win rate</dt><dd>{summaryPercent(t.won, t.total)}</dd></div></dl><p className="remote-summary-note">Unavailable means the corresponding event has not been recorded in a supported field.</p></Panel>}
    <Panel title="Loss & recovery" note="Recorded reasons"><Bars title="Loss reasons" values={summary.lossReasons.map(row => ({ name: row.reason, value: row.count }))} color="#e65c6f" /></Panel>
    <HistoricalPerformance summary={summary} viewer={viewer} />
    {qualityPanel}
    {!personal && <Panel title="Workload & discipline" note="Current assignments, not historical credit"><Ring title="Agent workload" values={workloadBuckets(summary)} /></Panel>}
    <Panel title="Top performers" note="Historical Won leads"><Bars title="Historical Won leads by agent" values={wonRank.map(row => ({ name: row.name, value: row.won }))} color="#20b99a" /><p className="remote-summary-note">Past Won and Lost work stays credited after reassignment.</p></Panel>
    <Panel title="Recent wins" action="View leads" onAction={() => onNavigate('Lead inbox')}><div className="remote-summary-priorities">{summary.recentWins?.length ? summary.recentWins.map(row => <button key={row.id} onClick={() => onOpenLead ? onOpenLead(row.id) : onNavigate('Lead inbox')}><IconTrophy size={18} /><b>{row.name}</b><span>{row.source}</span><small>{row.wonAt ? new Date(row.wonAt).toLocaleDateString() : 'Date not available'}</small></button>) : <p className="role-empty">No recorded wins in this selection.</p>}</div></Panel>
    <Panel title={personal ? 'My growth & recognition' : 'Momentum & recognition'}><dl className="remote-summary-facts"><div><dt>Prior-period improvement</dt><dd>Not available</dd></div><div><dt>{marketing ? 'Median routing time' : 'Median response time'}</dt><dd>{(marketing ? t.medianRoutingHours : t.medianResponseHours) == null ? 'Not available' : `${marketing ? t.medianRoutingHours : t.medianResponseHours}h`}</dd></div><div><dt>Won value recorded</dt><dd>{t.financialRecordCount ? money(t.totalProjectValue) : 'Not available'}</dd></div><div><dt>Improvement focus</dt><dd>{t.overdue ? 'Clear overdue follow-ups' : marketing ? 'Improve qualification evidence' : 'Advance conversations'}</dd></div></dl></Panel>
  </>;
  return <div className="admin-reference-dashboard remote-summary-dashboard">{header}{dateControls}
    {error && <div className="connection-banner" role="alert"><strong>Dashboard refresh failed</strong><span>{error}. Showing the last successful summary.</span><button onClick={onRetry}>Retry</button></div>}
    <p className="remote-summary-note" role="status">{loading ? 'Refreshing complete summary…' : `Complete summary for this selection. Updated ${new Date(summary.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`}</p>
    <section className="admin-reference-section"><div className="admin-reference-section-heading"><h2>{page === 'Dashboard' ? 'Work now' : 'Overview'}</h2></div><Metrics values={metrics} /></section>
    <section className="remote-summary-grid" aria-label={page === 'Dashboard' ? 'Performance' : page}>{body}</section>
  </div>;
}
