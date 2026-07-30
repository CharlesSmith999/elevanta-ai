import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { z, ZodError } from 'zod';

type Profile = { id: string; workspace_id: string; role: 'admin' | 'manager' | 'sales_agent' | 'marketer'; full_name: string; manager_id: string | null; department?: 'marketing' | 'sales' | null; active: boolean };
type AuthenticatedRequest = Request & { profile?: Profile; supabase?: SupabaseClient };
const sourceOptions = ['Bark Paid', 'Bark Stalk', 'Thumbtack', 'SEO', 'Social Media', 'Clutch', 'Email Marketing', 'LinkedIn', 'PPC', 'Other'] as const;
const dashboardRoles = z.enum(['agent', 'manager', 'admin', 'marketer']);
const dashboardPeriods = z.enum(['daily', 'weekly', 'monthly', 'yearly', 'lifetime', 'custom']);

const id = z.string().uuid();
const newLead = z.object({ name: z.string().trim().min(1).max(160), phone: z.string().trim().max(60).optional(), email: z.string().trim().email().max(254).optional(), source: z.enum(sourceOptions).default('Other'), marketingOwnerId: id.optional(), salesOwnerId: id.optional(), description: z.string().trim().max(4000).optional() }).refine((value) => Boolean(value.phone || value.email), { message: 'A lead needs a phone number or email address.' });
const lostReasonOptions = ['Price or budget', 'No response', 'Timing or priority', 'Competitor selected', 'Not a fit', 'Proposal declined', 'Other'] as const;
const statusUpdate = z.object({ status: z.enum(['assigned', 'contacted', 'connected', 'follow_up_required', 'qualified', 'proposal_sent', 'won', 'lost', 'not_interested', 'incorrect', 'duplicate', 'do_not_contact']), qualification: z.enum(['mql', 'sql', 'not_available']).optional(), totalProjectCost: z.number().nonnegative().optional(), upfrontPaymentAmount: z.number().nonnegative().optional(), lostReason: z.enum(lostReasonOptions).optional() });
const assignment = z.object({ assignedTo: id, visibility: z.enum(['full_context', 'fresh_start']), reason: z.string().trim().min(1).max(1000) });
const note = z.object({ body: z.string().trim().min(1).max(5000) });
const followUp = z.object({ dueAt: z.string().datetime({ offset: true }), actionType: z.enum(['Call', 'Email', 'SMS', 'Task']) });
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

export function createApp() {
  const app = express();
  app.use(cors({ origin: process.env.WEB_ORIGIN?.split(',') ?? true }));
  app.use(express.json({ limit: '100kb' }));
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
    const { data, error } = await request.supabase!.rpc('create_opportunity', { p_name: value.name, p_phone: value.phone ?? null, p_email: value.email ?? null, p_source: value.source ?? null, p_marketing_owner_id: value.marketingOwnerId ?? null, p_sales_owner_id: value.salesOwnerId ?? null, p_description: value.description ?? null });
    if (error) throw error; response.status(201).json({ opportunityId: data });
  }));
  app.get('/v1/opportunities/:id', ...protectedRoute(async (request, response) => {
    const opportunityId = parse(id, request.params.id);
    const { data, error } = await request.supabase!.from('opportunities').select('*, contacts(*), assignments(*), activities(*), follow_ups(*), incorrect_reports(*), incorrect_reviews(*)').eq('id', opportunityId).maybeSingle();
    if (error) throw error; if (!data) { response.status(404).json({ message: 'Lead not found.' }); return; } response.json({ opportunity: data });
  }));
  app.patch('/v1/opportunities/:id', ...protectedRoute(async (request, response) => {
    const value = parse(statusUpdate.partial(), request.body); const opportunityId = parse(id, request.params.id);
    if (!value.status) { response.status(400).json({ message: 'Use a supported field update.' }); return; }
    const { error } = await request.supabase!.rpc('set_opportunity_status', { p_opportunity_id: opportunityId, p_status: value.status, p_qualification: value.qualification ?? null, p_total_project_cost: value.totalProjectCost ?? null, p_upfront_payment_amount: value.upfrontPaymentAmount ?? null, p_lost_reason: value.lostReason ?? null }); if (error) throw error; response.status(204).end();
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
    const value = parse(note, request.body); const opportunityId = parse(id, request.params.id);
    const { error } = await request.supabase!.rpc('add_opportunity_note', { p_opportunity_id: opportunityId, p_body: value.body }); if (error) throw error; response.status(204).end();
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
  app.get('/v1/coaching/:userId', ...protectedRoute(async (_request, response) => { response.status(409).json({ message: 'Xaviar coaching is deferred until the Milestone 4 evaluation gate.' }); }));
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
