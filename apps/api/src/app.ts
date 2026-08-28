import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { z, ZodError } from 'zod';
import { buildApiXaviarReport, canRequestXaviar, opportunityBelongsToSubject, type XaviarOpportunity, type XaviarProfile } from './xaviar.js';

type Profile = { id: string; workspace_id: string; role: 'admin' | 'manager' | 'sales_agent' | 'marketer'; full_name: string; manager_id: string | null; department?: 'marketing' | 'sales' | null; active: boolean };
type AuthenticatedRequest = Request & { profile?: Profile; supabase?: SupabaseClient };
const sourceOptions = ['Bark Paid', 'Bark Stalk', 'Thumbtack', 'SEO', 'Social Media', 'Clutch', 'Email Marketing', 'LinkedIn', 'PPC', 'Other'] as const;
const leadCategories = ['app', 'game', 'seo', 'smm', 'web', 'not_available'] as const;
const dashboardRoles = z.enum(['agent', 'manager', 'admin', 'marketer']);
const dashboardPeriods = z.enum(['daily', 'weekly', 'monthly', 'yearly', 'lifetime', 'custom']);

const id = z.string().uuid();
const newLead = z.object({ name: z.string().trim().min(1).max(160), phone: z.string().trim().max(60).optional(), email: z.string().trim().email().max(254).optional(), source: z.enum(sourceOptions).default('Other'), category: z.enum(leadCategories).default('not_available'), marketingOwnerId: id.optional(), salesOwnerId: id.optional(), description: z.string().trim().max(4000).optional() }).refine((value) => Boolean(value.phone || value.email), { message: 'A lead needs a phone number or email address.' });
const leadDetailsUpdate = z.object({ name: z.string().trim().min(1).max(160), source: z.enum(sourceOptions), category: z.enum(leadCategories), description: z.string().trim().max(4000).default('') });
const lostReasonOptions = ['Price or budget', 'No response', 'Timing or priority', 'Competitor selected', 'Not a fit', 'Proposal declined', 'Other'] as const;
const statusUpdate = z.object({ status: z.enum(['assigned', 'contacted', 'connected', 'follow_up_required', 'qualified', 'proposal_sent', 'won', 'lost', 'not_interested', 'incorrect', 'duplicate', 'do_not_contact']), qualification: z.enum(['mql', 'sql', 'not_available']).optional(), totalProjectCost: z.number().nonnegative().optional(), upfrontPaymentAmount: z.number().nonnegative().optional(), lostReason: z.enum(lostReasonOptions).optional() });
const assignment = z.object({ assignedTo: id, visibility: z.enum(['full_context', 'fresh_start']), reason: z.string().trim().min(1).max(1000) });
const note = z.object({ body: z.string().trim().min(1).max(5000) });
const followUp = z.object({ dueAt: z.string().datetime({ offset: true }), actionType: z.enum(['Call', 'Email', 'SMS', 'Task']) });
const contactMethodType = z.enum(['phone', 'email']);
const contactHealth = z.enum(['unverified', 'verified', 'incorrect', 'wrong_person', 'reception_gatekeeper', 'do_not_contact']);
const addContactMethod = z.object({ methodType: contactMethodType, value: z.string().trim().min(3).max(254), label: z.string().trim().max(120).optional() }).superRefine((value, ctx) => {
  if (value.methodType === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.value)) ctx.addIssue({ code: 'custom', path: ['value'], message: 'Enter a valid email address.' });
  if (value.methodType === 'phone') {
    const digits = value.value.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) ctx.addIssue({ code: 'custom', path: ['value'], message: 'Enter a valid phone number with 7 to 15 digits.' });
  }
});
const assessContactMethod = z.object({ health: contactHealth, reason: z.string().trim().max(1000).optional() });
const restoreContactMethod = z.object({ reason: z.string().trim().min(3).max(1000) });
const salesActivity = z.object({
  contactMethodId: id,
  type: z.enum(['call', 'sms', 'email', 'meeting', 'note']),
  outcome: z.enum(['connected', 'no_answer', 'voicemail', 'busy', 'callback_requested', 'email_sent', 'replied', 'meeting_booked', 'not_interested', 'other']),
  body: z.string().trim().max(5000).optional(),
  followUpAt: z.string().datetime({ offset: true }).optional(),
  followUpAction: z.enum(['Call', 'Email', 'SMS', 'Task']).optional(),
  followUpPurpose: z.string().trim().max(1000).optional(),
});
const incorrectReport = z.object({ reasonCode: z.enum(['Invalid contact information', 'Wrong person or business', 'Spam or fake request', 'Duplicate contact']), evidence: z.string().trim().max(3000).optional() });
const reviewDecision = z.object({ decision: z.enum(['confirmed_incorrect', 'rejected', 'merge_duplicate']), reason: z.string().trim().max(3000).optional() });
const dashboardQuery = z.object({ period: dashboardPeriods.default('lifetime'), source: z.enum(sourceOptions).optional(), start: z.string().date().optional(), end: z.string().date().optional() });
const userRole = z.enum(['admin', 'manager', 'sales_agent', 'marketer']);
const department = z.enum(['marketing', 'sales']);
const createUser = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  fullName: z.string().trim().min(2).max(160),
  role: userRole,
  department: department.nullable().optional(),
  managerId: id.nullable().optional(),
  password: z.string().min(8).max(128),
}).superRefine((value, ctx) => {
  if (value.role === 'admin' && (value.managerId || value.department)) ctx.addIssue({ code: 'custom', path: ['role'], message: 'Admins cannot have a department or manager.' });
  if (value.role !== 'admin' && !value.department) ctx.addIssue({ code: 'custom', path: ['department'], message: 'Choose a department for this user.' });
  if (value.role !== 'admin' && value.role !== 'manager' && !value.managerId) ctx.addIssue({ code: 'custom', path: ['managerId'], message: 'Choose a manager for this user.' });
});
const updateUser = z.object({
  fullName: z.string().trim().min(2).max(160).optional(),
  role: userRole.optional(),
  department: department.nullable().optional(),
  managerId: id.nullable().optional(),
  active: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'Provide at least one profile field to update.' });
const xaviarFeedback = z.object({ state: z.enum(['acknowledged', 'deferred', 'completed', 'dismissed']), reason: z.string().trim().max(1000).optional() });
const coachingPlan = z.object({ subjectUserId: id, title: z.string().trim().min(2).max(200), objective: z.string().trim().min(2).max(2000), periodStart: z.string().date(), periodEnd: z.string().date(), managerNotes: z.string().trim().max(3000).optional() }).refine((value) => value.periodEnd >= value.periodStart, { message: 'The coaching-plan end date must not be before its start date.' });
const coachingPlanUpdate = z.object({ status: z.enum(['draft', 'active', 'completed', 'cancelled']).optional(), title: z.string().trim().min(2).max(200).optional(), objective: z.string().trim().min(2).max(2000).optional(), managerNotes: z.string().trim().max(3000).optional() }).refine((value) => Object.keys(value).length > 0, { message: 'Provide a coaching-plan change.' });
const xaviarReleaseReview = z.object({ decision: z.enum(['approved', 'changes_required']), notes: z.string().trim().min(1).max(3000), releaseVersion: z.string().trim().min(1).max(100) });

function configuredClient(token: string) {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY.');
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
}

function serviceClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('Admin user management is not configured. Add SUPABASE_SERVICE_ROLE_KEY to the API environment.');
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

function parse(schema: z.ZodTypeAny, value: unknown) { return schema.parse(value); }
function asyncRoute(handler: (request: AuthenticatedRequest, response: Response) => Promise<void>) { return (request: AuthenticatedRequest, response: Response, next: NextFunction) => { handler(request, response).catch(next); }; }

async function persistXaviarReport(subject: XaviarProfile, report: ReturnType<typeof buildApiXaviarReport>) {
  const admin = serviceClient();
  const dayStart = new Date(report.generatedAt); dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart); dayEnd.setUTCHours(23, 59, 59, 999);
  const { error: snapshotError } = await admin.from('xaviar_performance_snapshots').upsert({
    workspace_id: subject.workspace_id, subject_user_id: subject.id, period_start: dayStart.toISOString(), period_end: dayEnd.toISOString(),
    metrics: { sampleSize: report.sampleSize, summary: report.summary }, evidence_count: report.sampleSize,
    data_quality: { missingData: report.missingData }, model_version: report.reportVersion,
  }, { onConflict: 'subject_user_id,period_start,period_end,model_version' });
  if (snapshotError) throw snapshotError;

  const storedIds = new Map<string, string>();
  for (const recommendation of report.recommendations) {
    const { data, error } = await admin.from('xaviar_recommendations').upsert({
      workspace_id: subject.workspace_id, subject_user_id: subject.id, recommendation_key: recommendation.id,
      opportunity_id: null, capability: recommendation.capability, title: recommendation.title, reason: recommendation.reason,
      action: recommendation.action, confidence: recommendation.confidence, priority: recommendation.priority,
      expires_at: recommendation.expiresAt, model_version: report.reportVersion, prompt_version: null,
      evidence_version: 'structured-events-v1', updated_at: report.generatedAt,
    }, { onConflict: 'subject_user_id,recommendation_key,model_version' }).select('id').single();
    if (error) throw error;
    storedIds.set(recommendation.id, data.id);
    const { error: clearError } = await admin.from('xaviar_evidence').delete().eq('recommendation_id', data.id);
    if (clearError) throw clearError;
    if (recommendation.evidence.length) {
      const { error: evidenceError } = await admin.from('xaviar_evidence').insert(recommendation.evidence.map((item) => ({
        recommendation_id: data.id, evidence_type: item.kind, entity_id: item.opportunityId ?? null,
        label: item.label, occurred_at: item.occurredAt ?? null,
      })));
      if (evidenceError) throw evidenceError;
    }
  }

  const { data: existingPredictions, error: existingError } = await admin.from('xaviar_predictions').select('outcome_type').eq('subject_user_id', subject.id).eq('model_version', report.reportVersion).gte('predicted_at', dayStart.toISOString()).lte('predicted_at', dayEnd.toISOString());
  if (existingError) throw existingError;
  const existingOutcomes = new Set((existingPredictions ?? []).map((item) => item.outcome_type));
  const newPredictions = report.predictions.filter((item) => item.status === 'available' && !existingOutcomes.has(item.outcome));
  if (newPredictions.length) {
    const { error: predictionError } = await admin.from('xaviar_predictions').insert(newPredictions.map((item) => ({
      workspace_id: subject.workspace_id, subject_user_id: subject.id, outcome_type: item.outcome,
      probability: item.probability === undefined ? null : item.probability / 100, confidence: item.confidence,
      sample_size: item.sampleSize, model_version: item.modelVersion, predicted_at: item.predictedAt, expires_at: item.expiresAt,
    })));
    if (predictionError) throw predictionError;
  }
  return { ...report, recommendations: report.recommendations.map((item) => ({ ...item, id: storedIds.get(item.id) ?? item.id })) };
}

export function createApp() {
  const app = express();
  app.use(cors({ origin: process.env.WEB_ORIGIN?.split(',') ?? true }));
  app.use(express.json({ limit: '100kb' }));
  // Keep the shared app resilient if a platform adapter forwards the
  // deployment prefix instead of removing it first.
  app.use((request, _response, next) => {
    if (request.url === '/api' || request.url.startsWith('/api/')) {
      request.url = request.url.slice('/api'.length) || '/';
    }
    next();
  });
  app.get('/health', (_request, response) => response.json({ service: 'elevanta-api', status: 'ok', phase: 1 }));

  const requireUser = asyncRoute(async (request, response) => {
    const header = request.header('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) { response.status(401).json({ message: 'A signed-in user is required.' }); return; }
    const supabase = configuredClient(token);
    const { data: auth, error: authError } = await supabase.auth.getUser(token);
    if (authError || !auth.user) { response.status(401).json({ message: 'Your session is invalid or expired.' }); return; }
    const { data: profile, error: profileError } = await supabase.from('profiles').select('id, workspace_id, role, full_name, manager_id, department, active').eq('id', auth.user.id).maybeSingle();
    if (profileError || !profile || !profile.active) { response.status(403).json({ message: 'Your CRM profile is inactive or unavailable.' }); return; }
    request.profile = profile as Profile; request.supabase = supabase; response.locals.ready = true;
  });
  const protectedRoute = (handler: (request: AuthenticatedRequest, response: Response) => Promise<void>) => [requireUser, asyncRoute(async (request, response) => { if (!response.locals.ready) return; await handler(request, response); })];

  app.get('/v1/me', ...protectedRoute(async (request, response) => { response.json({ profile: request.profile }); }));
  app.get('/v1/workspace-members', ...protectedRoute(async (request, response) => {
    const { data, error } = await request.supabase!
      .from('profiles')
      .select('id, full_name, role, department, manager_id, active')
      .eq('workspace_id', request.profile!.workspace_id)
      .eq('active', true)
      .order('full_name', { ascending: true });
    if (error) throw error;
    response.json({ users: data ?? [] });
  }));
  app.get('/v1/contacts', ...protectedRoute(async (request, response) => {
    const search = typeof request.query.search === 'string' ? request.query.search.trim() : '';
    let query = request.supabase!.from('contacts').select('*').order('updated_at', { ascending: false });
    if (search) query = query.or(`name.ilike.%${search}%,normalized_email.ilike.%${search}%,normalized_phone.ilike.%${search}%`);
    const { data, error } = await query; if (error) throw error; response.json({ contacts: data });
  }));
  app.get('/v1/opportunities', ...protectedRoute(async (request, response) => {
    const status = typeof request.query.status === 'string' ? request.query.status : undefined;
    let query = request.supabase!.from('opportunities').select('*, contacts(*), assignments(*), activities(*), follow_ups(*), incorrect_reports(*), incorrect_reviews(*)').order('updated_at', { ascending: false });
    if (status) query = query.eq('status', status);
    const { data, error } = await query; if (error) throw error; response.json({ opportunities: data });
  }));
  app.post('/v1/opportunities', ...protectedRoute(async (request, response) => {
    const value = parse(newLead, request.body);
    const { data, error } = await request.supabase!.rpc('create_opportunity_v17', { p_name: value.name, p_phone: value.phone ?? null, p_email: value.email ?? null, p_source: value.source ?? null, p_marketing_owner_id: value.marketingOwnerId ?? null, p_sales_owner_id: value.salesOwnerId ?? null, p_description: value.description ?? null, p_lead_category: value.category });
    if (error) throw error; response.status(201).json({ opportunityId: data });
  }));
  app.get('/v1/opportunities/:id', ...protectedRoute(async (request, response) => {
    const opportunityId = parse(id, request.params.id);
    const { data, error } = await request.supabase!.from('opportunities').select('*, contacts(*), assignments(*), activities(*), follow_ups(*), incorrect_reports(*), incorrect_reviews(*)').eq('id', opportunityId).maybeSingle();
    if (error) throw error; if (!data) { response.status(404).json({ message: 'Lead not found.' }); return; } response.json({ opportunity: data });
  }));
  app.get('/v1/opportunities/:id/contact-methods', ...protectedRoute(async (request, response) => {
    const opportunityId = parse(id, request.params.id);
    const { data, error } = await request.supabase!.from('opportunity_contact_methods')
      .select('id, health, focus, assessment_reason, last_assessed_at, last_assessed_by, contact_methods(id, method_type, value, label, globally_restricted), contact_method_events(id, event_type, reason, created_at, actor_id)')
      .eq('opportunity_id', opportunityId).order('created_at', { ascending: true });
    if (error) throw error; response.json({ contactMethods: data ?? [] });
  }));
  app.get('/v1/opportunities/:id/activity-history', ...protectedRoute(async (request, response) => {
    const opportunityId = parse(id, request.params.id);
    const { data, error } = await request.supabase!.from('activities')
      .select('id, type, outcome, body, created_at, occurred_at, actor_id, assignment_id, contact_method_id, metadata, contact_methods(value, method_type)')
      .eq('opportunity_id', opportunityId).order('occurred_at', { ascending: false });
    if (error) throw error; response.json({ activities: data ?? [] });
  }));
  app.patch('/v1/opportunities/:id', ...protectedRoute(async (request, response) => {
    const value = parse(statusUpdate.partial(), request.body); const opportunityId = parse(id, request.params.id);
    if (!value.status) { response.status(400).json({ message: 'Use a supported field update.' }); return; }
    const { error } = await request.supabase!.rpc('set_opportunity_status', { p_opportunity_id: opportunityId, p_status: value.status, p_qualification: value.qualification ?? null, p_total_project_cost: value.totalProjectCost ?? null, p_upfront_payment_amount: value.upfrontPaymentAmount ?? null, p_lost_reason: value.lostReason ?? null }); if (error) throw error; response.status(204).end();
  }));
  app.patch('/v1/opportunities/:id/details', ...protectedRoute(async (request, response) => {
    const value = parse(leadDetailsUpdate, request.body); const opportunityId = parse(id, request.params.id);
    const { error } = await request.supabase!.rpc('update_lead_details', { p_opportunity_id: opportunityId, p_name: value.name, p_source: value.source, p_description: value.description, p_lead_category: value.category });
    if (error) throw error; response.status(204).end();
  }));
  app.post('/v1/opportunities/:id/status', ...protectedRoute(async (request, response) => {
    const value = parse(statusUpdate, request.body); const opportunityId = parse(id, request.params.id);
    const { error } = await request.supabase!.rpc('set_opportunity_status', { p_opportunity_id: opportunityId, p_status: value.status, p_qualification: value.qualification ?? null, p_total_project_cost: value.totalProjectCost ?? null, p_upfront_payment_amount: value.upfrontPaymentAmount ?? null, p_lost_reason: value.lostReason ?? null }); if (error) throw error; response.status(204).end();
  }));
  app.post('/v1/opportunities/:id/assignments', ...protectedRoute(async (request, response) => {
    const value = parse(assignment, request.body); const opportunityId = parse(id, request.params.id);
    const { error } = await request.supabase!.rpc('reassign_opportunity', { p_opportunity_id: opportunityId, p_assigned_to: value.assignedTo, p_visibility: value.visibility, p_reason: value.reason }); if (error) throw error; response.status(204).end();
  }));
  app.post('/v1/opportunities/:id/notes', ...protectedRoute(async (request, response) => {
    const value = parse(note, request.body); const opportunityId = parse(id, request.params.id);
    const { error } = await request.supabase!.rpc('add_opportunity_note', { p_opportunity_id: opportunityId, p_body: value.body }); if (error) throw error; response.status(204).end();
  }));
  app.post('/v1/opportunities/:id/activities', ...protectedRoute(async (request, response) => {
    const value = parse(salesActivity, request.body); const opportunityId = parse(id, request.params.id);
    const { data, error } = await request.supabase!.rpc('log_sales_activity', { p_opportunity_id: opportunityId, p_contact_method_id: value.contactMethodId, p_type: value.type, p_outcome: value.outcome, p_body: value.body ?? null, p_follow_up_at: value.followUpAt ?? null, p_follow_up_action: value.followUpAction ?? null, p_follow_up_purpose: value.followUpPurpose ?? null });
    if (error) throw error; response.status(201).json({ activityId: data });
  }));
  app.post('/v1/opportunities/:id/contact-methods', ...protectedRoute(async (request, response) => {
    const value = parse(addContactMethod, request.body); const opportunityId = parse(id, request.params.id);
    const { data, error } = await request.supabase!.rpc('add_opportunity_contact_method', { p_opportunity_id: opportunityId, p_method_type: value.methodType, p_value: value.value, p_label: value.label ?? null });
    if (error) throw error; response.status(201).json({ contactMethodId: data });
  }));
  app.patch('/v1/opportunities/:id/contact-methods/:contactMethodId', ...protectedRoute(async (request, response) => {
    const value = parse(assessContactMethod, request.body); const opportunityId = parse(id, request.params.id); const contactMethodId = parse(id, request.params.contactMethodId);
    const { error } = await request.supabase!.rpc('assess_opportunity_contact_method', { p_opportunity_id: opportunityId, p_contact_method_id: contactMethodId, p_health: value.health, p_reason: value.reason ?? null });
    if (error) throw error; response.status(204).end();
  }));
  app.post('/v1/opportunities/:id/contact-methods/:contactMethodId/restore', ...protectedRoute(async (request, response) => {
    const value = parse(restoreContactMethod, request.body); const opportunityId = parse(id, request.params.id); const contactMethodId = parse(id, request.params.contactMethodId);
    const { error } = await request.supabase!.rpc('restore_opportunity_contact_method', { p_opportunity_id: opportunityId, p_contact_method_id: contactMethodId, p_reason: value.reason });
    if (error) throw error; response.status(204).end();
  }));
  app.post('/v1/opportunities/:id/follow-ups', ...protectedRoute(async (request, response) => {
    const value = parse(followUp, request.body); const opportunityId = parse(id, request.params.id);
    const { error } = await request.supabase!.rpc('create_follow_up', { p_opportunity_id: opportunityId, p_due_at: value.dueAt, p_action_type: value.actionType }); if (error) throw error; response.status(204).end();
  }));
  app.post('/v1/follow-ups/:id/complete', ...protectedRoute(async (request, response) => {
    const followUpId = parse(id, request.params.id);
    const { error } = await request.supabase!.rpc('complete_follow_up', { p_follow_up_id: followUpId }); if (error) throw error; response.status(204).end();
  }));
  app.post('/v1/opportunities/:id/incorrect-reports', ...protectedRoute(async (request, response) => {
    const value = parse(incorrectReport, request.body); const opportunityId = parse(id, request.params.id);
    const { error } = await request.supabase!.rpc('report_incorrect_lead', { p_opportunity_id: opportunityId, p_reason_code: value.reasonCode, p_evidence: value.evidence ?? null }); if (error) throw error; response.status(204).end();
  }));
  app.post('/v1/opportunities/:id/incorrect-review', ...protectedRoute(async (request, response) => {
    const value = parse(reviewDecision, request.body); const opportunityId = parse(id, request.params.id);
    const { error } = await request.supabase!.rpc('decide_incorrect_review', { p_opportunity_id: opportunityId, p_decision: value.decision, p_reason: value.reason ?? null }); if (error) throw error; response.status(204).end();
  }));
  app.get('/v1/admin/incorrect-reviews', ...protectedRoute(async (request, response) => {
    if (request.profile!.role !== 'admin') { response.status(403).json({ message: 'Only Admin can view the review queue.' }); return; }
    const { data, error } = await request.supabase!.from('incorrect_reviews').select('*, opportunities(*, contacts(*), incorrect_reports(*))').is('decision', null).order('threshold_reached_at', { ascending: true }); if (error) throw error; response.json({ reviews: data });
  }));
  app.get('/v1/admin/users', ...protectedRoute(async (request, response) => {
    if (request.profile!.role !== 'admin') { response.status(403).json({ message: 'Only Admin can manage users.' }); return; }
    const admin = serviceClient();
    const [{ data: profiles, error: profileError }, { data: authUsers, error: authError }] = await Promise.all([
      admin.from('profiles').select('id, workspace_id, role, full_name, manager_id, department, active, created_at').eq('workspace_id', request.profile!.workspace_id).order('created_at', { ascending: true }),
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);
    if (profileError) throw profileError;
    if (authError) throw authError;
    const emailById = new Map((authUsers.users ?? []).map((user) => [user.id, { email: user.email ?? '', lastSignInAt: user.last_sign_in_at ?? null }]));
    response.json({ users: (profiles ?? []).map((profile) => ({ ...profile, email: emailById.get(profile.id)?.email ?? '', last_sign_in_at: emailById.get(profile.id)?.lastSignInAt ?? null })) });
  }));
  app.post('/v1/admin/users', ...protectedRoute(async (request, response) => {
    if (request.profile!.role !== 'admin') { response.status(403).json({ message: 'Only Admin can create users.' }); return; }
    const value = parse(createUser, request.body);
    const admin = serviceClient();
    const { data: manager, error: managerError } = value.managerId ? await admin.from('profiles').select('id, workspace_id, role, department, active').eq('id', value.managerId).maybeSingle() : { data: null, error: null };
    if (managerError) throw managerError;
    if (value.managerId && (!manager || manager.workspace_id !== request.profile!.workspace_id || manager.role !== 'manager' || !manager.active)) { response.status(422).json({ message: 'Choose an active manager in this workspace.' }); return; }
    if (value.managerId && manager?.department !== value.department) { response.status(422).json({ message: 'The user and manager must belong to the same department.' }); return; }
    const { data: authUser, error: authError } = await admin.auth.admin.createUser({ email: value.email, password: value.password, email_confirm: true, user_metadata: { full_name: value.fullName } });
    if (authError || !authUser.user) { response.status(422).json({ message: authError?.message ?? 'The account could not be created.' }); return; }
    const { data: profile, error: profileError } = await admin.from('profiles').insert({ id: authUser.user.id, workspace_id: request.profile!.workspace_id, role: value.role, department: value.role === 'admin' ? null : value.department, manager_id: value.role === 'admin' ? null : value.managerId, full_name: value.fullName, active: true }).select('id, workspace_id, role, full_name, manager_id, department, active, created_at').single();
    if (profileError) { await admin.auth.admin.deleteUser(authUser.user.id); throw profileError; }
    await admin.from('audit_events').insert({ workspace_id: request.profile!.workspace_id, actor_id: request.profile!.id, entity_type: 'profile', entity_id: authUser.user.id, action: 'user_created', before_json: null, after_json: profile });
    response.status(201).json({ user: { ...profile, email: value.email, last_sign_in_at: null } });
  }));
  app.patch('/v1/admin/users/:id', ...protectedRoute(async (request, response) => {
    if (request.profile!.role !== 'admin') { response.status(403).json({ message: 'Only Admin can edit users.' }); return; }
    const targetId = parse(id, request.params.id); const value = parse(updateUser, request.body); const admin = serviceClient();
    const { data: before, error: beforeError } = await admin.from('profiles').select('id, workspace_id, role, full_name, manager_id, department, active, created_at').eq('id', targetId).maybeSingle();
    if (beforeError) throw beforeError;
    if (!before || before.workspace_id !== request.profile!.workspace_id) { response.status(404).json({ message: 'User not found in this workspace.' }); return; }
    if (targetId === request.profile!.id && value.active === false) { response.status(422).json({ message: 'You cannot deactivate your own admin account.' }); return; }
    const nextRole = value.role ?? before.role; const nextDepartment = nextRole === 'admin' ? null : (value.department === undefined ? before.department : value.department); const nextManagerId = nextRole === 'admin' ? null : (value.managerId === undefined ? before.manager_id : value.managerId);
    if (nextRole !== 'admin' && !nextDepartment) { response.status(422).json({ message: 'Choose a department for this user.' }); return; }
    if (nextRole !== 'admin' && nextRole !== 'manager' && !nextManagerId) { response.status(422).json({ message: 'Choose a manager for this user.' }); return; }
    if (nextManagerId === targetId) { response.status(422).json({ message: 'A user cannot manage themselves.' }); return; }
    if (nextManagerId) {
      const { data: manager, error: managerError } = await admin.from('profiles').select('id, workspace_id, role, department, active').eq('id', nextManagerId).maybeSingle();
      if (managerError) throw managerError;
      if (!manager || manager.workspace_id !== before.workspace_id || manager.role !== 'manager' || !manager.active || manager.department !== nextDepartment) { response.status(422).json({ message: 'Choose an active manager in the same department.' }); return; }
    }
    if (before.role === 'manager' && (nextRole !== 'manager' || nextDepartment !== before.department)) {
      const { count, error: reportError } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('workspace_id', before.workspace_id).eq('manager_id', targetId).eq('active', true);
      if (reportError) throw reportError;
      if ((count ?? 0) > 0) { response.status(422).json({ message: 'Reassign this manager’s active team members before changing their department or role.' }); return; }
    }
    if (value.active === false) {
      const { count, error: assignmentError } = await admin.from('assignments').select('id', { count: 'exact', head: true }).eq('assigned_to', targetId).is('ended_at', null);
      if (assignmentError) throw assignmentError;
      if ((count ?? 0) > 0) { response.status(422).json({ message: 'Reassign this user’s active leads before deactivation.' }); return; }
    }
    if (value.active === false && before.role === 'admin') {
      const { count, error: adminCountError } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('workspace_id', before.workspace_id).eq('role', 'admin').eq('active', true);
      if (adminCountError) throw adminCountError;
      if ((count ?? 0) <= 1) { response.status(422).json({ message: 'The workspace must retain at least one active Admin.' }); return; }
    }
    const next = { full_name: value.fullName ?? before.full_name, role: nextRole, department: nextDepartment, manager_id: nextManagerId, active: value.active ?? before.active };
    const { data: after, error: updateError } = await admin.from('profiles').update(next).eq('id', targetId).select('id, workspace_id, role, full_name, manager_id, department, active, created_at').single();
    if (updateError) throw updateError;
    await admin.from('audit_events').insert({ workspace_id: before.workspace_id, actor_id: request.profile!.id, entity_type: 'profile', entity_id: targetId, action: 'user_updated', before_json: before, after_json: after });
    const { data: authUser } = await admin.auth.admin.getUserById(targetId);
    response.json({ user: { ...after, email: authUser.user?.email ?? '', last_sign_in_at: authUser.user?.last_sign_in_at ?? null } });
  }));
  app.post('/v1/admin/incorrect-reviews/:id/decision', ...protectedRoute(async (request, response) => {
    if (request.profile!.role !== 'admin') { response.status(403).json({ message: 'Only Admin can decide a review.' }); return; }
    const value = parse(reviewDecision, request.body); const opportunityId = parse(id, request.params.id);
    const { error } = await request.supabase!.rpc('decide_incorrect_review', { p_opportunity_id: opportunityId, p_decision: value.decision, p_reason: value.reason ?? null }); if (error) throw error; response.status(204).end();
  }));
  app.post('/v1/imports/validate', ...protectedRoute(async (_request, response) => { response.status(409).json({ message: 'Production Excel import is deferred until Milestone 5.' }); }));
  app.post('/v1/imports/commit', ...protectedRoute(async (_request, response) => { response.status(409).json({ message: 'Production Excel import is deferred until Milestone 5.' }); }));
  app.get('/v1/coaching/:userId', ...protectedRoute(async (request, response) => {
    const targetId = parse(id, request.params.userId); const viewer = request.profile!;
    const { data: subject, error: subjectError } = await request.supabase!.from('profiles').select('id, workspace_id, role, manager_id, department').eq('id', targetId).maybeSingle();
    if (subjectError) throw subjectError;
    if (!subject) { response.status(404).json({ message: 'Xaviar coaching subject not found.' }); return; }
    if (!canRequestXaviar(viewer as XaviarProfile, subject as XaviarProfile)) { response.status(403).json({ message: 'Xaviar coaching is outside your permitted scope.' }); return; }
    const { data: managed, error: managedError } = subject.role === 'manager'
      ? await request.supabase!.from('profiles').select('id').eq('manager_id', subject.id).eq('active', true)
      : { data: [], error: null };
    if (managedError) throw managedError;
    const { data, error } = await request.supabase!.from('opportunities').select('id,status,qualification,source,marketing_owner_id,created_at,updated_at,won_at,lost_reason,assignments(assigned_to,started_at,ended_at),follow_ups(id,owner_id,due_at,status),activities(id,type,actor_id,created_at,occurred_at,from_status,to_status,outcome,contact_method_id),opportunity_contact_methods(health,focus,contact_method_id)').order('updated_at', { ascending: false });
    if (error) throw error;
    const scoped = ((data ?? []) as XaviarOpportunity[]).filter((item) => opportunityBelongsToSubject(item, subject as XaviarProfile, (managed ?? []).map((profile) => profile.id)));
    const report = buildApiXaviarReport(subject as XaviarProfile, scoped);
    response.json({ report: await persistXaviarReport(subject as XaviarProfile, report) });
  }));
  app.post('/v1/xaviar/recommendations/:id/feedback', ...protectedRoute(async (request, response) => {
    const recommendationId = parse(id, request.params.id); const value = parse(xaviarFeedback, request.body);
    const { error } = await request.supabase!.rpc('record_xaviar_feedback', { p_recommendation_id: recommendationId, p_state: value.state, p_reason: value.reason ?? null });
    if (error) throw error; response.status(204).end();
  }));
  app.post('/v1/xaviar/coaching-plans', ...protectedRoute(async (request, response) => {
    if (request.profile!.role !== 'admin' && request.profile!.role !== 'manager') { response.status(403).json({ message: 'Only Admin and Managers can create coaching plans.' }); return; }
    const value = parse(coachingPlan, request.body); const admin = serviceClient();
    const { data: subject, error: subjectError } = await admin.from('profiles').select('id,workspace_id,role,manager_id,department').eq('id', value.subjectUserId).maybeSingle();
    if (subjectError) throw subjectError;
    if (!subject || !canRequestXaviar(request.profile! as XaviarProfile, subject as XaviarProfile) || subject.id === request.profile!.id) { response.status(403).json({ message: 'Choose a permitted team member for this coaching plan.' }); return; }
    const { data, error } = await admin.from('xaviar_coaching_plans').insert({ workspace_id: request.profile!.workspace_id, subject_user_id: subject.id, manager_id: request.profile!.id, title: value.title, objective: value.objective, period_start: value.periodStart, period_end: value.periodEnd, manager_notes: value.managerNotes ?? null }).select('*').single();
    if (error) throw error;
    await admin.from('audit_events').insert({ workspace_id: request.profile!.workspace_id, actor_id: request.profile!.id, entity_type: 'xaviar_coaching_plan', entity_id: data.id, action: 'xaviar_coaching_plan_created', before_json: null, after_json: data });
    response.status(201).json({ plan: data });
  }));
  app.patch('/v1/xaviar/coaching-plans/:id', ...protectedRoute(async (request, response) => {
    if (request.profile!.role !== 'admin' && request.profile!.role !== 'manager') { response.status(403).json({ message: 'Only Admin and Managers can update coaching plans.' }); return; }
    const planId = parse(id, request.params.id); const value = parse(coachingPlanUpdate, request.body); const admin = serviceClient();
    const { data: before, error: beforeError } = await admin.from('xaviar_coaching_plans').select('*').eq('id', planId).maybeSingle();
    if (beforeError) throw beforeError;
    if (!before || before.workspace_id !== request.profile!.workspace_id || (request.profile!.role === 'manager' && before.manager_id !== request.profile!.id)) { response.status(404).json({ message: 'Coaching plan not found in your permitted scope.' }); return; }
    const update = { ...(value.status ? { status: value.status } : {}), ...(value.title ? { title: value.title } : {}), ...(value.objective ? { objective: value.objective } : {}), ...(value.managerNotes !== undefined ? { manager_notes: value.managerNotes } : {}), updated_at: new Date().toISOString() };
    const { data, error } = await admin.from('xaviar_coaching_plans').update(update).eq('id', planId).select('*').single();
    if (error) throw error;
    await admin.from('audit_events').insert({ workspace_id: request.profile!.workspace_id, actor_id: request.profile!.id, entity_type: 'xaviar_coaching_plan', entity_id: planId, action: 'xaviar_coaching_plan_updated', before_json: before, after_json: data });
    response.json({ plan: data });
  }));
  app.post('/v1/xaviar/release-reviews', ...protectedRoute(async (request, response) => {
    if (request.profile!.role !== 'admin' && request.profile!.role !== 'manager') { response.status(403).json({ message: 'Only Admin and Managers can review a Xaviar release.' }); return; }
    const value = parse(xaviarReleaseReview, request.body); const admin = serviceClient();
    const { data, error } = await admin.from('xaviar_release_reviews').upsert({ workspace_id: request.profile!.workspace_id, reviewer_id: request.profile!.id, release_version: value.releaseVersion, decision: value.decision, notes: value.notes }, { onConflict: 'reviewer_id,release_version' }).select('*').single();
    if (error) throw error;
    await admin.from('audit_events').insert({ workspace_id: request.profile!.workspace_id, actor_id: request.profile!.id, entity_type: 'xaviar_release_review', entity_id: data.id, action: 'xaviar_release_review_recorded', before_json: null, after_json: data });
    response.status(201).json({ review: data });
  }));
  app.get('/v1/dashboards/:role', ...protectedRoute(async (request, response) => {
    const role = parse(dashboardRoles, request.params.role); const profile = request.profile!;
    const permitted = profile.role === 'admin' || (role === 'agent' && profile.role === 'sales_agent') || profile.role === role || (role === 'manager' && profile.role === 'manager');
    if (!permitted) { response.status(403).json({ message: 'This dashboard is outside your permitted role scope.' }); return; }
    const filters = parse(dashboardQuery, request.query); let query = request.supabase!.from('opportunities').select('id,status,qualification,source,total_project_cost,upfront_payment_amount,won_at,lost_reason,first_contacted_at,qualified_at,proposal_sent_at,created_at').order('created_at', { ascending: false });
    if (filters.source) query = query.eq('source', filters.source);
    if (filters.start) query = query.gte('created_at', `${filters.start}T00:00:00.000Z`);
    if (filters.end) query = query.lte('created_at', `${filters.end}T23:59:59.999Z`);
    const { data, error } = await query; if (error) throw error; const opportunities = data ?? [];
    const bySource = sourceOptions.map((source) => opportunities.filter((item) => item.source === source)).filter((items) => items.length).map((items) => ({ source: items[0].source, sampleSize: items.length, won: items.filter((item) => item.status === 'won').length, mql: items.filter((item) => item.qualification === 'mql').length, sql: items.filter((item) => item.qualification === 'sql').length }));
    response.json({ role, period: filters.period, source: filters.source ?? 'all', sampleSize: opportunities.length, bySource, opportunities });
  }));

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof ZodError) { response.status(400).json({ message: 'Please correct the submitted fields.', issues: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })) }); return; }
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    const status = /not permitted|only admin|only the current|only admin and marketing/i.test(message) ? 403 : /not found/i.test(message) ? 404 : /requires|cannot|invalid|must|paused|duplicate/i.test(message) ? 422 : 500;
    response.status(status).json({ message });
  });
  return app;
}
