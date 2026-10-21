import type { User } from './domain';
import type { WorkspaceSummary } from '../../api/src/workspaceTypes';
export type { WorkspaceSummary } from '../../api/src/workspaceTypes';

export function summaryPercent(value: number | null | undefined, denominator: number | null | undefined) {
  if (value == null || denominator == null || denominator <= 0) return 'Not available';
  return `${Math.round(value / denominator * 100)}%`;
}

export function summaryNumber(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? 'Not available' : value.toLocaleString();
}

export function performanceRows(summary: WorkspaceSummary, viewer: User) {
  // The API enforces permission scope; this extra restriction avoids showing
  // peer names in personal dashboards even if a cached management response is passed.
  return viewer.role === 'sales_agent' || viewer.role === 'marketer'
    ? summary.agentPerformance.filter(row => row.userId === viewer.id)
    : summary.agentPerformance;
}

export function historicalStatusCounts(summary: WorkspaceSummary, viewer: User) {
  const result: Record<string, number> = {};
  const marketing = viewer.role === 'marketer' || (viewer.role === 'manager' && viewer.department === 'marketing');
  for (const row of performanceRows(summary, viewer).filter(row => marketing ? row.role === 'marketer' : row.role !== 'marketer')) {
    const statuses = row.statuses ?? { connected: row.connected, proposal_sent: row.proposal, won: row.won, lost: row.lost };
    for (const [status, count] of Object.entries(statuses)) result[status] = (result[status] ?? 0) + count;
  }
  return result;
}

export function workloadBuckets(summary: WorkspaceSummary) {
  const agents = summary.agentPerformance.filter(row => row.role === 'sales_agent');
  const average = agents.length ? agents.reduce((sum, row) => sum + row.currentAssigned, 0) / agents.length : 0;
  return [
    { name: 'Within average', value: agents.filter(row => row.currentAssigned <= average).length, color: '#20b99a' },
    { name: 'Above average', value: agents.filter(row => row.currentAssigned > average && row.currentAssigned <= average * 1.2).length, color: '#f2a400' },
    { name: 'High workload', value: agents.filter(row => row.currentAssigned > average * 1.2).length, color: '#fb4d5c' },
  ];
}
