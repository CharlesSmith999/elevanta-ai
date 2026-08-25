export type ContactMethodType = 'phone' | 'email';
export type ContactHealth = 'unverified' | 'verified' | 'incorrect' | 'wrong_person' | 'reception_gatekeeper' | 'do_not_contact';
export type ContactFocus = 'active' | 'secondary' | 'removed';
export type LeadContactMethod = { id: string; type: ContactMethodType; value: string; label?: string; health: ContactHealth; focus: ContactFocus; reason?: string; restricted?: boolean; lastAttemptAt?: string; lastOutcome?: string };

export const healthLabel: Record<ContactHealth, string> = {
  unverified: 'Unverified', verified: 'Verified', incorrect: 'Incorrect', wrong_person: 'Wrong person', reception_gatekeeper: 'Reception / gatekeeper', do_not_contact: 'Do not contact',
};

export function focusForHealth(health: ContactHealth): ContactFocus {
  if (health === 'incorrect' || health === 'wrong_person' || health === 'do_not_contact') return 'removed';
  if (health === 'reception_gatekeeper') return 'secondary';
  return 'active';
}

export function canRestore(method: LeadContactMethod, role: 'sales_agent' | 'manager' | 'marketer' | 'admin'): boolean {
  if (method.focus !== 'removed') return false;
  if (method.health === 'do_not_contact') return role === 'manager' || role === 'admin';
  return role !== 'sales_agent';
}

export function isCallable(method: LeadContactMethod): boolean {
  return method.type === 'phone' && method.focus !== 'removed' && !method.restricted;
}

export function isEmailable(method: LeadContactMethod): boolean {
  return method.type === 'email' && method.focus !== 'removed' && !method.restricted;
}

export function validateContactMethod(type: ContactMethodType, value: string): string | undefined {
  const trimmed = value.trim();
  if (type === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? undefined : 'Enter a valid email address.';
  const digits = trimmed.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15 ? undefined : 'Enter a valid phone number with 7 to 15 digits.';
}
