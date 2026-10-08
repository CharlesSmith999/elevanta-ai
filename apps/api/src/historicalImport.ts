import { z } from 'zod';

// Raw cells are retained alongside extracted keys. This boundary does not activate leads.
const cells = z.record(z.union([z.string().max(100000), z.number().finite(), z.boolean(), z.null()]));
export const historicalRow = z.object({
  recordId: z.string().regex(/^R\d{6}$/),
  groupId: z.string().trim().min(1).max(80),
  disposition: z.enum(['ready', 'review']),
  sourceSheet: z.string().trim().min(1).max(120),
  sourceRow: z.number().int().positive(),
  name: z.string().trim().min(1).max(1000),
  phones: z.array(z.string().regex(/^\d{7,15}$/)).max(100),
  emails: z.array(z.string().email().max(254)).max(100),
  values: cells,
  sourceLinks: z.array(cells).min(1).max(100),
}).strict().superRefine((row, ctx) => {
  if (!row.phones.length && !row.emails.length) ctx.addIssue({ code: 'custom', message: 'Name plus at least one phone or email is required.' });
  if (new Set(row.phones).size !== row.phones.length || new Set(row.emails.map(v => v.toLowerCase())).size !== row.emails.length) ctx.addIssue({ code: 'custom', message: 'Contact methods must be unique within a row.' });
});
export const importManifest = z.object({
  format: z.literal('elevanta-history-v1'),
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  workbookName: z.string().trim().min(1).max(255),
  expectedRows: z.number().int().min(1).max(100000),
}).strict();
export const stageImportRequest = z.object({
  manifest: importManifest,
  rows: z.array(historicalRow).min(1).max(100),
}).strict().superRefine((input, ctx) => {
  if (new Set(input.rows.map(row => row.recordId)).size !== input.rows.length) ctx.addIssue({ code: 'custom', message: 'Repeated record IDs in one upload chunk.' });
  if (input.rows.length > input.manifest.expectedRows) ctx.addIssue({ code: 'custom', message: 'Chunk exceeds declared workbook count.' });
});
export const sealImportRequest = z.object({ batchId: z.string().uuid() }).strict();
export const importPageQuery = z.object({
  offset: z.coerce.number().int().min(0).max(100000).default(0),
  disposition: z.enum(['ready', 'review']).optional(),
}).strict();
