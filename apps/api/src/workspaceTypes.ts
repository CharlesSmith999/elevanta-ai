export type WorkspaceSummary = {
  generatedAt: string;
  viewerId: string;
  totals: {
    total: number; open: number; assigned: number; unassigned: number; mql: number; sql: number; won: number; lost: number; connected: number; proposal: number;
    overdue: number; dueToday: number; pendingReview: number; totalProjectValue: number; upfrontValue: number; financialRecordCount: number;
    followUpsOpen: number; followUpsCompleted: number; overdue1To3: number; overdue3To7: number; overdue7Plus: number;
    medianResponseHours: number | null; medianRoutingHours: number | null;
    meetingsBooked: number | null; meetingsHeld: number | null;
    actionable: number; cleanData: number; missingContact: number; duplicateCandidates: number; incorrect: number; needsInformation: number; slowRouting: number;
  };
  statusCounts: Record<string, number>;
  qualificationCounts: Record<string, number>;
  sourceCounts: Array<{ source: string; count: number; mql: number; sql: number; won: number; incorrect: number }>;
  categoryCounts: Array<{ category: string; count: number }>;
  trend: Array<{ date: string; total: number; won: number; mql: number; sql: number; activity: number; routing: number }>;
  lossReasons: Array<{ reason: string; count: number }>;
  agentPerformance: Array<{ userId: string; name: string; role: string; currentAssigned: number; worked: number; connected: number; proposal: number; won: number; lost: number; mql: number; sql: number; revenue: number; followUpCompletionRate: number | null; statuses: Record<string, number> }>;
  recentWins: Array<{ id: string; name: string; status: string; source: string; wonAt: string | null; dueAt: string | null }>;
  priorities: Array<{ id: string; name: string; status: string; source: string; wonAt: string | null; dueAt: string | null }>;
};
