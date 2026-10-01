import type { ResearchLead } from './inboundResearch';

const receivedTime = (lead: Pick<ResearchLead, 'receivedAt'>) => {
  const time = Date.parse(lead.receivedAt);
  return Number.isFinite(time) ? time : -Infinity;
};

export function newestResearchFirst<T extends Pick<ResearchLead, 'id' | 'receivedAt'>>(leads: T[]): T[] {
  return [...leads].sort((a, b) => {
    const left = receivedTime(a), right = receivedTime(b);
    return left === right ? a.id.localeCompare(b.id) : left > right ? -1 : 1;
  });
}

export function isRecentResearchArrival(lead: Pick<ResearchLead, 'receivedAt'>, now = Date.now()): boolean {
  const time = receivedTime(lead);
  return Number.isFinite(time) && time <= now && time >= now - 24 * 60 * 60 * 1000;
}
