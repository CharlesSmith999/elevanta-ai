import type { LeadCategory, User } from './domain';

export const researchStates = ['new', 'researching', 'found', 'not_found', 'connected', 'ready_for_sales', 'sent_to_sales', 'rejected'] as const;
export type ResearchState = typeof researchStates[number];
export type ResearchMethod = { type: 'phone' | 'email'; value: string; label?: string };
export type ResearchLead = {
  id: string;
  providerMessageId: string;
  providerThreadId?: string;
  receivedAt: string;
  source: string;
  name: string;
  maskedPhone?: string;
  maskedEmail?: string;
  address?: string;
  category: LeadCategory;
  credits?: number;
  description?: string;
  details?: string;
  marketingOwnerId: string;
  state: ResearchState;
  methods: ResearchMethod[];
  evidenceLinks: string[];
  researchNotes?: string;
  duplicateState: 'clear' | 'possible' | 'confirmed';
  publishedOpportunityId?: string;
};

export const researchStateLabels: Record<ResearchState, string> = {
  new: 'New', researching: 'Researching', found: 'Found', not_found: 'Not Found',
  connected: 'Connected', ready_for_sales: 'Ready for Sales', sent_to_sales: 'Sent to Sales', rejected: 'Rejected',
};

export const isMaskedContact = (value: string) => /\*/.test(value) || /x{2,}/i.test(value);
export const validResearchMethod = (method: ResearchMethod) => {
  const value = method.value.trim();
  if (!value || value.includes('*') || (method.type === 'phone' && /[a-z]/i.test(value))) return false;
  if (method.type === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const digits = value.replace(/\D/g, '');
  return /^[+\d\s().-]+$/.test(value) && digits.length >= 7 && digits.length <= 15;
};
export const researchMethodKey = (method: ResearchMethod) => method.type + ':' + (method.type === 'phone' ? method.value.replace(/\D/g, '') : method.value.trim().toLowerCase());
export const validEvidenceUrl = (value: string) => { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; } };
export const isReadyForSales = (lead: Pick<ResearchLead, 'name' | 'methods' | 'duplicateState'>) => Boolean(lead.name.trim()) && lead.duplicateState !== 'confirmed' && lead.methods.some(validResearchMethod);

export function canViewResearchLead(viewer: User, lead: ResearchLead, users: User[]) {
  if (viewer.role === 'admin') return true;
  if (viewer.role === 'marketer') return lead.marketingOwnerId === viewer.id;
  if (viewer.role !== 'manager' || viewer.department !== 'marketing') return false;
  return users.find((user) => user.id === lead.marketingOwnerId)?.managerId === viewer.id;
}

export const seedResearchLeads: ResearchLead[] = [
  { id: 'research-safe-1', providerMessageId: 'safe-message-001', receivedAt: '2026-09-17T14:20:00Z', source: 'Bark Stalk', name: 'Sample Web Lead', maskedPhone: '(555) ***-****', maskedEmail: 's*****@e*****.com', address: 'Austin, TX', category: 'web', credits: 28, description: 'Needs a new business website.', details: 'Budget and timing require research.', marketingOwnerId: 'muzammil', state: 'new', methods: [], evidenceLinks: [], duplicateState: 'clear' },
  { id: 'research-safe-2', providerMessageId: 'safe-message-002', receivedAt: '2026-09-17T13:05:00Z', source: 'Bark Stalk', name: 'Sample App Lead', maskedPhone: '(555) ***-****', maskedEmail: 'a*****@e*****.com', address: 'Chicago, IL', category: 'app', credits: 35, description: 'Exploring a mobile application.', marketingOwnerId: 'muzammil', state: 'researching', methods: [], evidenceLinks: ['https://example.com/sample-company'], researchNotes: 'Company website identified; contact details not yet verified.', duplicateState: 'possible' },
];
