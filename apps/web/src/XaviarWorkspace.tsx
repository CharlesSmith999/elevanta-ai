import { useMemo, useState } from 'react';
import {
  IconAlertTriangle, IconBrain, IconChartDots, IconCheck, IconClock,
  IconEye, IconLock, IconSparkles, IconTargetArrow,
} from '@tabler/icons-react';
import type { Lead, User } from './domain';
import { buildXaviarReport, type XaviarPeriod, type XaviarRecommendationState } from './xaviar';

const periodLabels: Record<XaviarPeriod, string> = { daily: 'Today', weekly: '7 days', monthly: '30 days', lifetime: 'Lifetime' };

export function XaviarWorkspace({ viewer, leads }: { viewer: User; leads: Lead[] }) {
  const [period, setPeriod] = useState<XaviarPeriod>('weekly');
  const [states, setStates] = useState<Record<string, XaviarRecommendationState>>({});
  const report = useMemo(() => buildXaviarReport(viewer, leads, period), [viewer, leads, period]);

  return <section className="xaviar-workspace">
    <header className="xaviar-hero">
      <div><span className="spark"><IconSparkles size={16} /> XAVIAR</span><h2>Your evidence-backed performance coach</h2><p>{report.summary}</p></div>
      <label>Period<select value={period} onChange={(event) => setPeriod(event.target.value as XaviarPeriod)}>{Object.entries(periodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </header>

    <section className="xaviar-proof-grid">
      <article><IconEye /><span>Visible evidence</span><b>{report.sampleSize}</b><small>{report.scope} scope</small></article>
      <article><IconTargetArrow /><span>Actions</span><b>{report.recommendations.length}</b><small>ranked by urgency</small></article>
      <article><IconChartDots /><span>Benchmark</span><b>{report.benchmark.status === 'available' ? `${report.benchmark.value}%` : 'Not ready'}</b><small>{report.benchmark.sampleSize} samples</small></article>
      <article><IconLock /><span>Mode</span><b>Advisory</b><small>no automatic changes</small></article>
    </section>

    <div className="xaviar-layout">
      <section className="xaviar-main">
        <article className="xaviar-panel">
          <div className="xaviar-heading"><div><span className="eyebrow">NEXT BEST ACTIONS</span><h3>What to work on now</h3></div><IconBrain /></div>
          {report.recommendations.length ? report.recommendations.map((item) => {
            const state = states[item.id] ?? item.state;
            return <div className={`xaviar-recommendation priority-${item.priority}`} key={item.id}>
              <div className="xaviar-recommendation-top"><span>{item.priority} priority</span><small>{item.confidence} confidence</small></div>
              <h4>{item.title}</h4><p>{item.reason}</p><strong>{item.action}</strong>
              <details><summary>View {item.evidence.length} evidence {item.evidence.length === 1 ? 'item' : 'items'}</summary>{item.evidence.map((evidence) => <div className="xaviar-evidence" key={evidence.id}><IconCheck size={14} /> {evidence.label}</div>)}</details>
              <div className="xaviar-actions"><button className={state === 'acknowledged' ? 'active' : ''} onClick={() => setStates((current) => ({ ...current, [item.id]: 'acknowledged' }))}>Acknowledge</button><button className={state === 'completed' ? 'active' : ''} onClick={() => setStates((current) => ({ ...current, [item.id]: 'completed' }))}>Mark complete</button><button className={state === 'deferred' ? 'active' : ''} onClick={() => setStates((current) => ({ ...current, [item.id]: 'deferred' }))}>Defer</button></div>
            </div>;
          }) : <p className="empty">No evidence-backed action is available for this period.</p>}
        </article>

        <article className="xaviar-panel">
          <div className="xaviar-heading"><div><span className="eyebrow">FORECASTS</span><h3>Predictions with uncertainty</h3></div><IconChartDots /></div>
          <div className="xaviar-prediction-grid">{report.predictions.map((item) => <div key={item.id}><span>{item.outcome.replaceAll('_', ' ')}</span><b>{item.status === 'available' ? `${item.probability}%` : 'Not enough evidence'}</b><small>{item.reason}</small><em>{item.modelVersion}</em></div>)}</div>
        </article>
      </section>

      <aside className="xaviar-side">
        <article className="xaviar-panel"><span className="eyebrow">STRENGTHS</span>{report.strengths.map((item) => <p className="xaviar-good" key={item}><IconCheck size={16} />{item}</p>)}</article>
        <article className="xaviar-panel"><span className="eyebrow">RISKS</span>{report.risks.map((item) => <p className="xaviar-risk" key={item}><IconAlertTriangle size={16} />{item}</p>)}</article>
        <article className="xaviar-panel"><span className="eyebrow">EVIDENCE GAPS</span>{report.missingData.length ? report.missingData.map((item) => <p className="xaviar-gap" key={item}><IconClock size={16} />{item}</p>) : <p className="xaviar-good"><IconCheck size={16} />No material evidence gap detected.</p>}</article>
        <article className="xaviar-panel xaviar-boundary"><span className="eyebrow">SAFETY BOUNDARY</span>{report.limitations.map((item) => <p key={item}><IconLock size={15} />{item}</p>)}</article>
      </aside>
    </div>
  </section>;
}
