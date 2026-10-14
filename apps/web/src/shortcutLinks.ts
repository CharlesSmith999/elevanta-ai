import type { LeadContactMethod } from './leadWorkflow';

export function shortcutHref(method: LeadContactMethod): string | undefined {
  if (method.restricted || method.focus === 'removed' || ['incorrect', 'wrong_person', 'do_not_contact'].includes(method.health)) return undefined;
  const value = method.value.trim();
  if (method.type === 'email') return /^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(value) ? `mailto:${encodeURIComponent(value)}` : undefined;
  const digits = value.replace(/\D/g, '');
  if (!/^\+?[\d\s().-]+$/.test(value) || digits.length < 7 || digits.length > 15) return undefined;
  return `tel:${value.startsWith('+') ? '+' : ''}${digits}`;
}
