import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { connectionAnalytics } from '../../api/src/connectionAnalytics';

type Report = ReturnType<typeof connectionAnalytics>;
type Series = { key: string; label: string; color: string };
const purple = 'var(--accent)';
const teal = 'var(--success)';
const blue = 'var(--accent-blue)';
const tooltipStyle = { background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 10 };

function DailyComparison({ title, description, data, series, empty }: {
  title: string; description: string; data: Report['daily']; series: Series[]; empty: string;
}) {
  const rows = data as unknown as Array<Record<string, string | number>>;
  const hasData = rows.some(row => series.some(item => Number(row[item.key]) > 0));
  return <article className="ca-card">
    <h3>{title}</h3><p>{description}</p>
    {hasData ? <ResponsiveContainer width="100%" height={230}>
      <BarChart data={data} margin={{ top: 8, right: 10, bottom: 4, left: -16 }}>
        <CartesianGrid stroke="var(--border)" vertical={false}/>
        <XAxis dataKey="day" minTickGap={42} tick={{ fill: 'var(--muted)', fontSize: 11 }}/>
        <YAxis allowDecimals={false} tick={{ fill: 'var(--muted)', fontSize: 11 }}/>
        <Tooltip contentStyle={tooltipStyle}/><Legend/>
        {series.map(item => <Bar key={item.key} dataKey={item.key} name={item.label} fill={item.color} radius={[3,3,0,0]} isAnimationActive={false}/>)}
      </BarChart>
    </ResponsiveContainer> : <p className="ca-empty">{empty}</p>}
    <details className="ca-chart-values"><summary>View daily values</summary><div className="ca-table-scroll"><table>
      <thead><tr><th>Date</th>{series.map(item => <th key={item.key}>{item.label}</th>)}</tr></thead>
      <tbody>{rows.map(row => <tr key={row.day}><th>{row.day}</th>{series.map(item => <td key={item.key}>{row[item.key]}</td>)}</tr>)}</tbody>
    </table></div></details>
  </article>;
}

function OutcomeComparison({ title, description, rows, rate, empty }: {
  title: string; description: string; rows: Array<{ name: string; count: number }>; rate: number | null; empty: string;
}) {
  return <article className="ca-card"><h3>{title}</h3><p>{description}</p>
    {rows[0].count ? <ResponsiveContainer width="100%" height={185}><BarChart data={rows} layout="vertical" margin={{ right: 18, left: 0 }}>
      <CartesianGrid stroke="var(--border)" horizontal={false}/><XAxis type="number" allowDecimals={false} tick={{ fill: 'var(--muted)', fontSize: 11 }}/>
      <YAxis type="category" dataKey="name" width={95} tick={{ fill: 'var(--text)', fontSize: 12 }}/><Tooltip contentStyle={tooltipStyle}/>
      <Bar dataKey="count" name="Leads" fill={purple} radius={[0,5,5,0]} isAnimationActive={false}/>
    </BarChart></ResponsiveContainer> : <p className="ca-empty">{empty}</p>}
    <div className="ca-outcome-values">{rows.map(row => <span key={row.name}>{row.name} <b>{row.count}</b></span>)}<span>Rate <b>{rate === null ? 'Not available' : `${rate}%`}</b></span></div>
  </article>;
}

export function AgentRequestedCharts({ report, audience }: { report: Report; audience: 'marketing-agent' | 'sales-agent' | 'management' }) {
  const funnel = report.researchFunnel;
  const personal = audience === 'marketing-agent';
  return <>
    {report.marketing && <>
      <DailyComparison title="Total App Leads by Day" description="App research arrivals in the shared Marketing queue." data={report.daily} series={[{ key: 'received', label: 'App received', color: purple }]} empty="No App research leads arrived in this period. New arrivals will appear here."/>
      <DailyComparison title="App leads vs all other leads by day" description="Shared arrivals. Other includes every non-App category, including unclassified leads." data={report.daily} series={[{ key: 'received', label: 'App', color: purple }, { key: 'otherReceived', label: 'All other leads', color: blue }]} empty="No research arrivals in this period. Try a wider date range."/>
      <DailyComparison title="App leads found vs connected" description="Discovery and first Sales connection dates. These daily workloads can refer to different leads." data={report.daily} series={[{ key: 'found', label: personal ? 'App found · your work' : 'App found · your scope', color: teal }, { key: 'appConnected', label: 'App first connected', color: purple }]} empty="No App discoveries or first connections recorded in this period. Save researched contact details and log successful Sales conversations to populate this chart."/>
      <DailyComparison title="Found vs received leads" description="All project types. Shared arrivals compared with discoveries credited to your scope; this is not a conversion rate." data={report.daily} series={[{ key: 'allReceived', label: 'Received · shared queue', color: purple }, { key: 'allFound', label: personal ? 'Found · your work' : 'Found · your scope', color: teal }]} empty="No arrivals or discoveries in this period. Try a wider date range."/>
      {funnel && <article className="ca-card ca-wide"><h3>Research lead funnel</h3><p>Leads received in the selected period, followed through the period end. Shared workload is separate from {personal ? 'your credited work' : 'your team’s credited work'}.</p>
        <div className="ca-research-backlog"><span>Received · shared <b>{funnel.received}</b></span><span>Not found · shared <b>{funnel.notFound}</b></span><span>Discovery date unavailable <b>{funnel.unknown}</b></span></div>
        <ol className="ca-research-stages">{[{ name: 'Found', count: funnel.found }, { name: 'Routed to Sales', count: funnel.routed }, { name: 'Connected', count: funnel.connected }].map(stage => <li key={stage.name}><span>{stage.name} · {personal ? 'your leads' : 'your scope'}</span><strong>{stage.count}</strong><progress value={stage.count} max={Math.max(funnel.found, 1)} aria-label={`${stage.name}: ${stage.count} of ${funnel.found} found leads`}/></li>)}</ol>
        {funnel.finders.length ? <div className="ca-table-scroll"><table><caption>Found by Marketing Agent</caption><thead><tr><th>Agent</th><th>Found</th><th>Routed</th><th>Connected</th></tr></thead><tbody>{funnel.finders.map(row => <tr key={row.name}><th>{row.name}</th><td>{row.found}</td><td>{row.routed}</td><td>{row.connected}</td></tr>)}</tbody></table></div> : <p className="ca-empty">No dated discoveries credited to your scope for these arrivals.</p>}
        {funnel.connections.length ? <div className="ca-table-scroll"><table><caption>Connected by Sales Agent</caption><thead><tr><th>Found by</th><th>Connected by</th><th>Leads</th></tr></thead><tbody>{funnel.connections.map((row, index) => <tr key={index}><th>{row.finder}</th><td>{row.salesperson}</td><td>{row.connected}</td></tr>)}</tbody></table></div> : <p className="ca-footnote">Sales Agent names will appear after a first successful conversation is recorded for these researched leads.</p>}
        {!!funnel.excludedDuplicates && <p className="ca-footnote">{funnel.excludedDuplicates} confirmed duplicate arrivals are excluded from this funnel.</p>}
      </article>}
    </>}
    {report.sales && <>
      <OutcomeComparison title="Leads received vs connected" description="Unique leads assigned in the selected period and their first connection recorded by your Sales scope, through the period end." rows={[{ name: 'Received', count: report.totals.assigned }, { name: 'Connected', count: report.totals.connected }]} rate={report.totals.rate} empty="No Sales assignments in this period. Assigned leads will appear here."/>
      <OutcomeComparison title="Connected vs Won (converted)" description={`Leads first connected in this period, then marked Won with recorded evidence by your Sales scope. ${report.conversion.wonByOther} won by another Sales Agent are excluded from your wins.`} rows={[{ name: 'Connected', count: report.conversion.connected }, { name: 'Won', count: report.conversion.won }]} rate={report.conversion.rate} empty="No first connections recorded in this period. A successful Sales activity starts this comparison."/>
    </>}
  </>;
}
