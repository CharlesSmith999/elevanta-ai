import { currentAssignment, type Lead, type User } from './domain';
import { isRemoteCrmId, type LeadContactMethod } from './leadWorkflow';

export function workbenchMethods(lead: Lead): LeadContactMethod[] {
  if (lead.contactMethods) return lead.contactMethods;
  // Real records must have opportunity-level health before outreach is offered.
  if (isRemoteCrmId(lead.id)) return [];
  const methods = lead.discoveredContactMethods ?? [
    ...(lead.phone ? [{ type: 'phone' as const, value: lead.phone }] : []),
    ...(lead.email ? [{ type: 'email' as const, value: lead.email }] : []),
  ];
  return methods.map((method, index) => ({ ...method, id: `${lead.id}-${index}`, health: 'unverified', focus: 'active' }));
}

export function outreachAllowed(lead: Lead, method: LeadContactMethod): boolean {
  return !lead.routingPaused && !['incorrect', 'do_not_contact', 'duplicate'].includes(lead.status)
    && method.focus !== 'removed' && !method.restricted
    && !['incorrect', 'wrong_person', 'do_not_contact'].includes(method.health);
}

export function contactLinks(method: LeadContactMethod) {
  const value = method.value.trim();
  if (method.type === 'email') return /^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(value)
    ? { email: `mailto:${encodeURIComponent(value)}` } : {};
  if (!/^\+?[\d\s().-]+$/.test(value)) return {};
  const digits = value.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return {};
  return {
    call: `tel:${value.startsWith('+') ? '+' : ''}${digits}`,
    // Do not guess a country code for local/imported phone numbers.
    whatsapp: value.startsWith('+') ? `https://wa.me/${digits}` : undefined,
  };
}

export function workbenchHistory(lead: Lead, viewer: User) {
  const assignment = currentAssignment(lead);
  return lead.activities.filter((item) => viewer.role !== 'sales_agent' || assignment?.visibility !== 'fresh_start' || Date.parse(item.at) >= Date.parse(assignment.at))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

export function nextWorkbenchId(ids: string[], current: string): string | undefined {
  const index = ids.indexOf(current);
  return index < 0 ? undefined : ids[index + 1];
}

export const workbenchOutcomes = [
  ['connected', 'Connected'], ['no_answer', 'No answer'], ['voicemail', 'Voicemail'],
  ['busy', 'Busy'], ['callback_requested', 'Callback requested'], ['email_sent', 'Email sent'],
  ['replied', 'Replied'], ['meeting_booked', 'Meeting booked'], ['not_interested', 'Not interested'], ['other', 'Other'],
] as const;
