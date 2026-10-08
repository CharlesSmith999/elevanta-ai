import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
let checks = 0;
const check = async (label, fn) => { await fn(); checks++; console.log(`PASS ${label}`); };
try {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;
    create table public.workspaces(id uuid primary key);
    create table public.profiles(id uuid primary key,workspace_id uuid,active boolean,role text);
    create table public.audit_events(id uuid default gen_random_uuid(),workspace_id uuid,actor_id uuid,entity_type text,entity_id uuid,action text,after_json jsonb);
    grant select on public.profiles to authenticated;
    insert into workspaces values('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
    insert into profiles values
      ('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000001',true,'admin'),
      ('00000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000002',true,'admin'),
      ('00000000-0000-4000-8000-000000000013','00000000-0000-4000-8000-000000000001',true,'sales_agent'),
      ('00000000-0000-4000-8000-000000000014','00000000-0000-4000-8000-000000000001',false,'admin');
  `);
  await db.exec(await readFile(new URL('../supabase/migrations/202610070001_historical_import_staging.sql', import.meta.url), 'utf8'));
  const login = async suffix => { await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub='00000000-0000-4000-8000-${suffix}';`); };
  const manifest = { format: 'elevanta-history-v1', sourceSha256: 'a'.repeat(64), workbookName: 'synthetic.xlsx', expectedRows: 2 };
  const row = { recordId: 'R000001', groupId: 'G1', disposition: 'ready', sourceSheet: 'Synthetic', sourceRow: 2, name: 'Synthetic', phones: ['2025550100'], emails: [], values: { Status: 'Not available', Revenue: null }, sourceLinks: [{ Details: 'Original' }] };
  const stage = (rows, m = manifest) => db.query('select public.stage_historical_import($1::jsonb,$2::jsonb) as id', [JSON.stringify(m), JSON.stringify(rows)]);
  await login('000000000011');
  let batch;
  await check('Admin stages history without changing missing values', async () => {
    batch = (await stage([row])).rows[0].id;
    const saved = (await db.query('select payload from lead_import_rows')).rows[0].payload;
    assert.deepEqual(saved, row);
  });
  await check('Retry keeps one copy', async () => { await stage([row]); assert.equal((await db.query('select count(*)::int as n from lead_import_rows')).rows[0].n, 1); });
  await check('Changed record cannot overwrite history', async () => { await assert.rejects(stage([{ ...row, name: 'Different' }]), /differs/); });
  await check('Partial batch cannot be sealed', async () => { await assert.rejects(db.query('select seal_historical_import($1)', [batch]), /incomplete/); });
  await check('Bad later row rolls back the entire chunk', async () => {
    await assert.rejects(stage([{ ...row, recordId: 'R000002', sourceRow: 3 }, { ...row, recordId: 'R000003', sourceRow: 4, phones: [] }]), /contact method/);
    assert.equal((await db.query('select count(*)::int as n from lead_import_rows')).rows[0].n, 1);
  });
  await check('Repeated provenance cannot create another record', async () => { await assert.rejects(stage([{ ...row, recordId: 'R000002' }]), /unique/); });
  await check('Manifest changes cannot change the expected total', async () => { await assert.rejects(stage([row], { ...manifest, expectedRows: 3 }), /Manifest differs/); });
  await check('Same-workspace Sales cannot read or write staging', async () => {
    await login('000000000013');
    assert.equal((await db.query('select count(*)::int as n from lead_import_rows')).rows[0].n, 0);
    await assert.rejects(stage([row]), /Only an active Admin/);
  });
  await check('Other-workspace Admin cannot read or seal this batch', async () => {
    await login('000000000012');
    assert.equal((await db.query('select count(*)::int as n from lead_import_rows')).rows[0].n, 0);
    await assert.rejects(db.query('select seal_historical_import($1)', [batch]), /not found/);
  });
  await check('Inactive Admin cannot write staging', async () => { await login('000000000014'); await assert.rejects(stage([row]), /Only an active Admin/); });
  await login('000000000011');
  await check('Complete batch seals with exact ready/review counts and zero activation', async () => {
    await stage([{ ...row, recordId: 'R000002', sourceRow: 3, disposition: 'review' }]);
    const result = (await db.query('select seal_historical_import($1) as result', [batch])).rows[0].result;
    assert.equal(result.rows, 2); assert.equal(result.readyCandidates, 1); assert.equal(result.review, 1); assert.equal(result.activated, 0);
    await stage([row]); // A network retry after seal remains safe.
  });
  await check('Direct delete and update are forbidden even to application Admin', async () => {
    await assert.rejects(db.query('delete from lead_import_rows where batch_id=$1', [batch]), /permission denied/);
    await assert.rejects(db.query("update lead_import_batches set expected_rows=3 where id=$1", [batch]), /permission denied/);
  });
  console.log(`${checks} database checks passed. Synthetic fixtures only.`);
} finally { await db.close(); }
