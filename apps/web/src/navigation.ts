import type { User } from './domain';

export type NavigationItem = { label: string; page: string };

const admin: NavigationItem[] = [
  { label: 'Command Center', page: 'Dashboard' },
  { label: 'Leads', page: 'Lead inbox' },
  { label: 'Follow-ups', page: 'Follow-ups' },
  { label: 'Assignments', page: 'Assignments' },
  { label: 'Reports', page: 'Reports' },
  { label: 'Benchmark Board', page: 'Benchmark Board' },
  { label: 'Leaderboard', page: 'Leaderboard' },
  { label: 'Data quality', page: 'Data quality' },
  { label: 'Review queue', page: 'Review queue' },
  { label: 'User management', page: 'User management' },
  { label: 'Xaviar', page: 'Xaviar' },
];

const marketingManager: NavigationItem[] = [
  { label: 'Command Center', page: 'Dashboard' },
  { label: 'Leads', page: 'Lead inbox' },
  { label: 'Assignments', page: 'Assignments' },
  { label: 'Reports', page: 'Reports' },
  { label: 'Benchmark Board', page: 'Benchmark Board' },
  { label: 'Leaderboard', page: 'Leaderboard' },
  { label: 'Data quality', page: 'Data quality' },
  { label: 'Xaviar', page: 'Xaviar' },
];

const salesManager: NavigationItem[] = [
  { label: 'Sales Command Center', page: 'Dashboard' },
  { label: 'Opportunities', page: 'Lead inbox' },
  { label: 'Follow-ups', page: 'Follow-ups' },
  { label: 'Handoffs', page: 'Assignments' },
  { label: 'Reports', page: 'Reports' },
  { label: 'Benchmark Board', page: 'Benchmark Board' },
  { label: 'Leaderboard', page: 'Leaderboard' },
  { label: 'Data quality', page: 'Data quality' },
  { label: 'Xaviar', page: 'Xaviar' },
];

const marketingAgent: NavigationItem[] = [
  { label: 'Workspace', page: 'Dashboard' },
  { label: 'Leads', page: 'Lead inbox' },
  { label: 'Follow-ups', page: 'Follow-ups' },
  { label: 'Reports', page: 'Reports' },
  { label: 'My standing', page: 'Leaderboard' },
  { label: 'Xaviar', page: 'Xaviar' },
];

const salesAgent: NavigationItem[] = [
  { label: 'Workspace', page: 'Dashboard' },
  { label: 'Leads', page: 'Lead inbox' },
  { label: 'Follow-ups', page: 'Follow-ups' },
  { label: 'Assignments', page: 'Assignments' },
  { label: 'Reports', page: 'Reports' },
  { label: 'My standing', page: 'Leaderboard' },
  { label: 'Xaviar', page: 'Xaviar' },
];

export function navigationFor(viewer: User): NavigationItem[] {
  if (viewer.role === 'admin') return admin;
  if (viewer.role === 'manager') return viewer.department === 'marketing' ? marketingManager : salesManager;
  return viewer.role === 'marketer' ? marketingAgent : salesAgent;
}

export function canNavigateTo(viewer: User, page: string) {
  return navigationFor(viewer).some((item) => item.page === page);
}
