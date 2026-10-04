export type Person = { id: string; workspace_id: string; role: string; department: string | null; manager_id: string | null; full_name: string };
export type Assignment = { id: string; opportunity_id: string; assigned_to: string; started_at: string; ended_at: string | null };
export type Event = { id: string; opportunity_id: string; actor_id: string | null; assignment_id: string | null; type: string; outcome: string | null; occurred_at: string | null; created_at: string; to_status?: string | null; metadata?: Record<string, unknown> | null };
export type Opportunity = { id: string; workspace_id: string; marketing_owner_id: string | null; source: string; lead_category: string; status: string; lost_reason: string | null };
export type Research = { id: string; workspace_id: string; source: string; lead_category: string; first_found_at: string | null; first_found_by: string | null; marketing_owner_id: string | null; published_opportunity_id: string | null; duplicate_state: string; discovered_methods: unknown[]; inbound_messages: { received_at: string } | null };
export type AnalyticsInput = { people: Person[]; opportunities: Opportunity[]; assignments: Assignment[]; events: Event[]; research: Research[] };
export type AnalyticsFilter = { start?: string; end: string; source?: string; timezone: string };
const validTime = (value?: string | null) => value ? Date.parse(value) : NaN;
const success = new Set(['connected', 'replied', 'meeting_booked']);
const contactTypes = new Set(['call', 'sms', 'email', 'meeting']);
const dayKey = (date: number, timezone: string) => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  return ['year','month','day'].map((type) => parts.find((part) => part.type === type)!.value).join('-');
};
const fraction = (count: number, total: number) => total ? Math.round(count / total * 1000) / 10 : null;

export function connectionAnalytics(viewer: Person, input: AnalyticsInput, filter: AnalyticsFilter) {
  if (!['admin','manager','marketer','sales_agent'].includes(viewer.role) || (viewer.role === 'manager' && !['sales','marketing'].includes(viewer.department ?? ''))) throw new Error('Unsupported reporting role.');
  const end = validTime(filter.end); const start = filter.start ? validTime(filter.start) : -Infinity;
  if (!Number.isFinite(end) || Number.isNaN(start) || start > end) throw new Error('Invalid reporting date range.');
  dayKey(end, filter.timezone); // Validate the timezone before processing records.
  const within = (time: number) => Number.isFinite(time) && time >= start && time <= end;
  const people = input.people.filter((person) => person.workspace_id === viewer.workspace_id);
  const names = new Map(people.map((person) => [person.id, person.full_name]));
  const permitted = (id: string | null) => !!id && (viewer.role === 'admin' || id === viewer.id || (viewer.role === 'manager' && people.some((person) => person.id === id && person.manager_id === viewer.id && person.department === viewer.department)));
  const marketing = viewer.role === 'admin' || viewer.role === 'marketer' || (viewer.role === 'manager' && viewer.department === 'marketing');
  const sales = viewer.role === 'admin' || viewer.role === 'sales_agent' || (viewer.role === 'manager' && viewer.department === 'sales');
  const sourceMatches = (source: string) => !filter.source || filter.source === 'all' || source === filter.source;
  const handoffOwners = new Map(input.research.filter((item) => item.workspace_id === viewer.workspace_id && item.published_opportunity_id).map((item) => [item.published_opportunity_id, item.marketing_owner_id]));
  const opportunities = input.opportunities.filter((opportunity) => opportunity.workspace_id === viewer.workspace_id && sourceMatches(opportunity.source) && !['incorrect', 'duplicate'].includes(opportunity.status)).map((item) => ({ ...item, marketing_owner_id: handoffOwners.has(item.id) ? handoffOwners.get(item.id)! : item.marketing_owner_id }));
  const opportunityIds = new Set(opportunities.map((item) => item.id));
  const assignments = input.assignments.filter((item) => opportunityIds.has(item.opportunity_id) && people.some((person) => person.id === item.assigned_to && person.role === 'sales_agent'));
  const byId = new Map(assignments.map((item) => [item.id, item]));
  const evidence = input.events.filter((event) => {
    const assignment = event.assignment_id ? byId.get(event.assignment_id) : assignments.find((item) => item.opportunity_id === event.opportunity_id && item.assigned_to === event.actor_id && validTime(event.occurred_at ?? event.created_at) >= validTime(item.started_at) && (!item.ended_at || validTime(event.occurred_at ?? event.created_at) < validTime(item.ended_at)));
    const at = validTime(event.occurred_at ?? event.created_at);
    return assignment && assignment.opportunity_id === event.opportunity_id && assignment.assigned_to === event.actor_id && contactTypes.has(event.type) && Number.isFinite(at) && at >= validTime(assignment.started_at) && (!assignment.ended_at || at < validTime(assignment.ended_at)) && at <= end;
  }).sort((a,b) => validTime(a.occurred_at ?? a.created_at) - validTime(b.occurred_at ?? b.created_at) || a.id.localeCompare(b.id));
  const firstConnection = new Map<string, Event>();
  for (const event of evidence) if (success.has(event.outcome ?? '') && !firstConnection.has(event.opportunity_id)) firstConnection.set(event.opportunity_id,event);
  const cohort = assignments.filter((item) => within(validTime(item.started_at)));
  const visibleOpportunities = opportunities.filter((item) => viewer.role === 'admin' || (marketing ? permitted(item.marketing_owner_id) : assignments.some((assignment) => assignment.opportunity_id === item.id && permitted(assignment.assigned_to))));
  const visibleIds = new Set(visibleOpportunities.map((item) => item.id));
  const connections = [...firstConnection.values()].filter((event) => visibleIds.has(event.opportunity_id) && within(validTime(event.occurred_at ?? event.created_at)) && (marketing || permitted(event.actor_id)));
  const research = marketing ? input.research.filter((item) => item.workspace_id === viewer.workspace_id && sourceMatches(item.source)) : [];
  const found = research.filter((item) => within(validTime(item.first_found_at)) && permitted(item.first_found_by));
  const times = [...connections.map((item) => validTime(item.occurred_at ?? item.created_at)), ...cohort.filter((item) => visibleIds.has(item.opportunity_id)).map((item) => validTime(item.started_at)), ...research.map((item) => validTime(item.inbound_messages?.received_at)), ...found.map((item) => validTime(item.first_found_at))].filter((time) => Number.isFinite(time) && time <= end);
  const firstDay = dayKey(Number.isFinite(start) ? start : times.length ? times.reduce((a,b) => Math.min(a,b),end) : end - 13 * 86400000, filter.timezone);
  const lastDay = dayKey(end, filter.timezone);
  const daily = [] as Array<{ day: string; connected: number; mql: number; sql: number; unqualified: number; unknown: number; received: number; found: number }>;
  for (let date = Date.parse(`${firstDay}T12:00:00Z`); date <= Date.parse(`${lastDay}T12:00:00Z`); date += 86400000) {
    if (daily.length >= 4000) throw new Error('Choose a reporting range shorter than 4000 days.');
    daily.push({ day: new Date(date).toISOString().slice(0,10), connected: 0, mql: 0, sql: 0, unqualified: 0, unknown: 0, received: 0, found: 0 });
  }
  const days = new Map(daily.map((row) => [row.day,row]));
  for (const event of connections) {
    const row = days.get(dayKey(validTime(event.occurred_at ?? event.created_at),filter.timezone)); if (!row) continue;
    row.connected++;
    const q = event.metadata?.qualification_at_connection;
    if (q === 'mql' || q === 'sql') row[q]++; else if (q === 'not_available') row.unqualified++; else row.unknown++;
  }
  for (const item of research.filter((item) => item.lead_category === 'app' && within(validTime(item.inbound_messages?.received_at)))) {
    const row = days.get(dayKey(validTime(item.inbound_messages?.received_at),filter.timezone)); if (row) row.received++;
  }
  for (const item of found.filter((item) => item.lead_category === 'app')) {
    const row = days.get(dayKey(validTime(item.first_found_at),filter.timezone)); if (row) row.found++;
  }
  function agentRows(kind: 'marketing' | 'sales') {
    const relevantPeople = people.filter((person) => permitted(person.id) && (kind === 'marketing' ? ['marketer','admin'].includes(person.role) || (person.role === 'manager' && person.department === 'marketing') : person.role === 'sales_agent'));
    return relevantPeople.map((person) => {
      const assigned = new Set(cohort.filter((assignment) => kind === 'sales' ? assignment.assigned_to === person.id : opportunities.find((item) => item.id === assignment.opportunity_id)?.marketing_owner_id === person.id).map((item) => item.opportunity_id));
      let connected = 0, attempted = 0, connectedByOther = 0;
      for (const id of assigned) {
        const event = firstConnection.get(id);
        if (event && (kind === 'marketing' || event.actor_id === person.id)) connected++;
        else if (event) connectedByOther++;
        else if (evidence.some((event) => event.opportunity_id === id && (kind === 'marketing' || event.actor_id === person.id))) attempted++;
      }
      const ownConnections = connections.filter((event) => kind === 'sales' ? event.actor_id === person.id : opportunities.find((item) => item.id === event.opportunity_id)?.marketing_owner_id === person.id);
      const periodConnections = ownConnections.length;
      const trend = daily.map(({day}) => {
        const events = ownConnections.filter((event) => dayKey(validTime(event.occurred_at ?? event.created_at),filter.timezone) === day);
        return { day, connected: events.length, mql: events.filter((e) => e.metadata?.qualification_at_connection === 'mql').length, sql: events.filter((e) => e.metadata?.qualification_at_connection === 'sql').length, unknown: events.filter((e) => !['mql','sql'].includes(String(e.metadata?.qualification_at_connection))).length };
      });
      return { id: person.id, name: person.full_name, assigned: assigned.size, connected, attempted, notAttempted: assigned.size - connected - attempted - connectedByOther, connectedByOther, rate: fraction(connected,assigned.size), periodConnections, dailyAverage: daily.length ? Math.round(periodConnections / daily.length * 100) / 100 : null, found: found.filter((item) => item.first_found_by === person.id).length, trend };
    });
  }
  const losses = new Map<string,number>(); let missingLossDates = 0;
  for (const opportunity of visibleOpportunities) {
    const loss = input.events.filter((event) => event.opportunity_id === opportunity.id && ['lost','not_interested'].includes(event.to_status ?? '') && within(validTime(event.occurred_at ?? event.created_at))).sort((a,b) => validTime(b.occurred_at ?? b.created_at)-validTime(a.occurred_at ?? a.created_at))[0];
    if (!loss) { if (['lost','not_interested'].includes(opportunity.status) && !input.events.some((event) => event.opportunity_id === opportunity.id && ['lost','not_interested'].includes(event.to_status ?? '') && Number.isFinite(validTime(event.occurred_at ?? event.created_at)))) missingLossDates++; continue; }
    if (!marketing && !permitted(loss.actor_id)) continue;
    const reason = String(loss.metadata?.loss_reason ?? opportunity.lost_reason ?? 'Reason not available');
    losses.set(reason,(losses.get(reason) ?? 0)+1);
  }
  const pairs = new Map<string,{ marketer: string; salesperson: string; connected: number }>();
  for (const event of connections) {
    const opportunity = opportunities.find((item) => item.id === event.opportunity_id)!;
    const key = `${opportunity.marketing_owner_id}:${event.actor_id}`;
    const row = pairs.get(key) ?? { marketer: names.get(opportunity.marketing_owner_id ?? '') ?? 'Not available', salesperson: names.get(event.actor_id ?? '') ?? 'Not available', connected: 0 };
    row.connected++; pairs.set(key,row);
  }
  const visibleCohort = new Set(cohort.filter((assignment) => visibleIds.has(assignment.opportunity_id) && (marketing || permitted(assignment.assigned_to))).map((item) => item.opportunity_id));
  let connected = 0, attempted = 0, connectedByOther = 0;
  for (const id of visibleCohort) {
    const event = firstConnection.get(id);
    if (event && (marketing || permitted(event.actor_id))) connected++;
    else if (event) connectedByOther++;
    else if (evidence.some((event) => event.opportunity_id === id && (marketing || permitted(event.actor_id)))) attempted++;
  }
  const received = research.filter((item) => within(validTime(item.inbound_messages?.received_at)));
  return {
    marketing, sales, timezone: filter.timezone, days: daily.length,
    totals: { assigned: visibleCohort.size, connected, attempted, notAttempted: visibleCohort.size-connected-attempted-connectedByOther, connectedByOther, rate: fraction(connected,visibleCohort.size), periodConnections: connections.length, dailyAverage: daily.length ? Math.round(connections.length / daily.length * 100) / 100 : null },
    categories: marketing ? ['app','web','game','smm'].map((name) => ({ name: name.toUpperCase(), count: received.filter((item) => item.lead_category===name).length })) : [],
    excludedCategories: received.filter((item) => !['app','web','game','smm'].includes(item.lead_category)).length,
    marketingAgents: marketing ? agentRows('marketing') : [], salesAgents: sales ? agentRows('sales') : [],
    daily, losses: [...losses].map(([name,count])=>({name,count})), handoffs: [...pairs.values()],
    missing: { foundEvidence: research.filter((item) => !item.first_found_at && item.discovered_methods?.length && permitted(item.marketing_owner_id)).length, qualification: connections.filter((item) => !item.metadata?.qualification_at_connection).length, lossDates: missingLossDates },
  };
}
