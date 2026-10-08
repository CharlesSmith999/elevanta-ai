// Leave room for JSONB formatting overhead under the database's 1.5 MB cap.
export function* importChunks(manifest: unknown, rows: unknown[]) {
  const encoder = new TextEncoder();
  const overhead = encoder.encode(JSON.stringify({ manifest, rows: [] })).length;
  let chunk: unknown[] = [], bytes = overhead;
  for (const row of rows) {
    const size = encoder.encode(JSON.stringify(row)).length + 1;
    if (size + overhead > 900000) throw new Error('One source record exceeds the safe upload size. It has not been truncated.');
    if (chunk.length === 100 || bytes + size > 900000) {
      yield chunk;
      chunk = []; bytes = overhead;
    }
    chunk.push(row); bytes += size;
  }
  if (chunk.length) yield chunk;
}
