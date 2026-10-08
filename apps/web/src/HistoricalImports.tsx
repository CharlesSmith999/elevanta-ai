import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { request } from './api';
import { importChunks } from './importChunks';

type Batch = { id: string; workbook_name: string; expected_rows: number; state: string };
type StagedRow = { record_id: string; group_id: string; disposition: string; source_sheet: string; source_row: number; payload: { name: string; values: Record<string, unknown> }; activation?: { state: string; reason?: string | null } | null };
type Bundle = { manifest: { format: string; expectedRows: number }; rows: unknown[] };
export function HistoricalImports({ session }: { session: Session }) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batch, setBatch] = useState('');
  const [rows, setRows] = useState<StagedRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [file, setFile] = useState<File>();
  async function refresh() { const data = await request<{ batches: Batch[] }>(session, '/v1/imports'); setBatches(data.batches); }
  useEffect(() => { let current = true; request<{ batches: Batch[] }>(session, '/v1/imports').then(data => { if (current) setBatches(data.batches); }).catch(e => { if (current) setError(String(e.message)); }); return () => { current = false; }; }, [session]);
  useEffect(() => {
    let current = true; setRows([]);
    if (batch) request<{ rows: StagedRow[]; count: number }>(session, `/v1/imports/${batch}/rows?offset=${offset}${filter ? `&disposition=${filter}` : ''}`)
      .then(data => { if (current) { setRows(data.rows); setTotal(data.count); } }).catch(e => { if (current) setError(String(e.message)); });
    return () => { current = false; };
  }, [session, batch, offset, filter, refreshCounter]);
  async function upload() {
    if (!file || busy) return;
    setBusy(true); setError(''); setNotice('Checking the prepared import file…');
    try {
      if (file.size > 150 * 1024 * 1024) throw new Error('Import file exceeds 150 MB.');
      const bundle = JSON.parse(await file.text()) as Bundle;
      if (bundle.manifest?.format !== 'elevanta-history-v1' || !Array.isArray(bundle.rows) || !Number.isInteger(bundle.manifest.expectedRows) || bundle.rows.length !== bundle.manifest.expectedRows) throw new Error('Use a validated Elevanta historical import JSON file.');
      let batchId = '';
      // Bound both row count and bytes. Same-file retries remain idempotent.
      let stored = 0;
      for (const rows of importChunks(bundle.manifest, bundle.rows)) {
        const response = await request<{ batchId: string }>(session, '/v1/imports/stage', { method: 'POST', body: JSON.stringify({ manifest: bundle.manifest, rows }) });
        batchId = response.batchId;
        stored += rows.length;
        setNotice(`Stored ${stored.toLocaleString()} of ${bundle.rows.length.toLocaleString()} records. No leads activated.`);
      }
      const result = await request<{ rows: number; readyCandidates: number; review: number }>(session, '/v1/imports/validate', { method: 'POST', body: JSON.stringify({ batchId }) });
      setNotice(`Preserved ${result.rows.toLocaleString()} records: ${result.readyCandidates.toLocaleString()} ready candidates and ${result.review.toLocaleString()} for review. No leads activated or deleted.`);
      await refresh(); setBatch(batchId); setOffset(0);
    } catch (e) { setError(`${e instanceof Error ? e.message : 'Upload failed.'} Previously confirmed chunks are retained. Select the same unchanged file and retry to resume safely.`); }
    finally { setBusy(false); }
  }
  async function activate() {
    if (!batch || busy) return;
    setBusy(true); setError(''); setNotice('Activating records that pass the safety checks…');
    let activatedTotal = 0; let reviewTotal = 0; let processed = 0;
    try {
      while (true) {
        const result = await request<{ processed: number; activated: number; review: number; activatedTotal: number; reviewTotal: number }>(session, '/v1/imports/commit', { method: 'POST', body: JSON.stringify({ batchId: batch, limit: 100 }) });
        activatedTotal = result.activatedTotal; reviewTotal = result.reviewTotal; processed += result.processed;
        setNotice(`Checked ${processed.toLocaleString()} candidates this run. ${activatedTotal.toLocaleString()} are activated and ${reviewTotal.toLocaleString()} are in Admin review. Existing leads were not changed or deleted.`);
        if (result.processed < 100) break;
      }
      setNotice(`Activation pass complete. ${activatedTotal.toLocaleString()} total leads are activated and ${reviewTotal.toLocaleString()} candidates need Admin review. Source rows stay preserved; no existing lead was changed or deleted.`);
      await refresh(); setRefreshCounter(value => value + 1);
    } catch (e) {
      setError(`${e instanceof Error ? e.message : 'Activation failed.'} Completed chunks are committed safely. Click the activation button again to resume without adding the same lead twice.`);
    } finally { setBusy(false); }
  }
  return <article className="panel"><h2>Historical import</h2><p>Private Admin staging. Original values and linked source copies are preserved. Ready candidates still need CRM validation before activation. Uploading never deletes existing leads.</p>
    <label>Prepared import file<input type="file" accept=".json,application/json" disabled={busy} onChange={e => setFile(e.target.files?.[0])} /></label>
    <button type="button" disabled={!file || busy} onClick={() => void upload()}>{busy ? 'Uploading…' : 'Upload to staging'}</button>
    {notice && <p role="status">{notice}</p>}{error && <p role="alert">{error}</p>}
    <label>Import batch<select value={batch} onChange={e => { setBatch(e.target.value); setOffset(0); }}><option value="">Choose batch</option>{batches.map(b => <option key={b.id} value={b.id}>{b.workbook_name} · {b.expected_rows.toLocaleString()} · {b.state}</option>)}</select></label>
    {batch && <>{batches.find(item => item.id === batch)?.state === 'staged' && <><p>Activation keeps historical “Incorrect” and unsupported statuses in Admin review, and sends any contact collision to review. No call history, financial value, loss reason, or follow-up is invented.</p><button type="button" disabled={busy} onClick={() => void activate()}>{busy ? 'Activating safe records…' : 'Activate safe records'}</button></>}<label>Records<select value={filter} onChange={e => { setFilter(e.target.value); setOffset(0); }}><option value="">All</option><option value="ready">Ready candidates</option><option value="review">Needs review</option></select></label><p>{total.toLocaleString()} matching records</p>
      <div style={{ overflowX: 'auto' }}><table><thead><tr><th>Record</th><th>Name</th><th>Source</th><th>Original status</th><th>Group</th><th>Review</th><th>Activation</th><th>Reason</th></tr></thead><tbody>{rows.map(r => <tr key={r.record_id}><td>{r.record_id}</td><td>{r.payload.name}</td><td>{r.source_sheet}:{r.source_row}</td><td>{String(r.payload.values.Status ?? 'Not available')}</td><td>{r.group_id}</td><td>{r.disposition}</td><td>{r.activation?.state ?? 'Pending'}</td><td>{r.activation?.reason ?? ''}</td></tr>)}</tbody></table></div>
      <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}>Previous</button><button disabled={offset + 50 >= total} onClick={() => setOffset(offset + 50)}>Next</button></>}
  </article>;
}
