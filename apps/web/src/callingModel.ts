import type { CallingRecord, CallingMethod } from '../../api/src/callingList';
import { usableCallingMethod } from '../../api/src/callingList';
export type { CallingRecord, CallingMethod };
export const callResults = { connected: 'Connected', no_answer: 'No Answer', voicemail: 'Voicemail', busy: 'Busy', callback_requested: 'Callback', meeting_booked: 'Meeting booked', not_interested: 'Not Interested', wrong_number: 'Wrong Number', other: 'Other' };
export const callResultTones: Record<CallResult | 'never', string> = { connected: 'green', meeting_booked: 'green-strong', callback_requested: 'blue', voicemail: 'purple', no_answer: 'amber', busy: 'orange', not_interested: 'red', wrong_number: 'red-strong', other: 'gray', never: 'gray' };
export type CallResult = keyof typeof callResults;
export type CallRow = { key: string; record: CallingRecord; method: CallingMethod; latest?: CallingRecord['events'][number]; calledToday: boolean; usable: boolean; due?: string };
export function localDay(date: Date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
export function callingRows(records: CallingRecord[], day: string): CallRow[] {
  return records.flatMap(record => record.methods.filter(method => method.type === 'phone').map(method => {
    const events = record.events.filter(event => event.methodId === method.id).sort((a,b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
    const specific = record.followUps.filter(item => item.methodId === method.id);
    const due = (specific.length ? specific : record.followUps.filter(item => !item.methodId)).map(item => item.dueAt).sort()[0];
    return { key: `${record.id}:${method.id}`, record, method, latest: events[0], calledToday: events.some(event => localDay(new Date(event.at)) === day), usable: !record.blocked && usableCallingMethod(method), due };
  })).sort((a,b) => (b.record.assignedAt ?? '').localeCompare(a.record.assignedAt ?? '') || a.record.name.localeCompare(b.record.name) || a.key.localeCompare(b.key));
}
export function callTab(row: CallRow, tab: string, now: Date) {
  if (tab === 'called') return row.calledToday;
  if (tab === 'followup') return row.usable && Boolean(row.due) && !row.calledToday;
  return row.usable && !row.calledToday && (!row.due || Date.parse(row.due) <= now.getTime());
}
export function callMetrics(records: CallingRecord[], day: string, actorId?: string) {
  const events = [...new Map(records.flatMap(record => record.events).filter(event => (!actorId || event.actorId === actorId) && localDay(new Date(event.at)) === day).map(event => [event.id, event])).values()];
  const connected = events.filter(event => ['connected','meeting_booked'].includes(event.outcome)).length;
  const numbers = new Map(records.flatMap(record => record.methods.map(method => [method.id, method.value.replace(/\D/g,'')] as const)));
  return { attempts: events.length, unique: new Set(events.map(event => numbers.get(event.methodId) ?? event.methodId)).size, connected, rate: events.length ? Math.round(connected/events.length*100) : 0 };
}
export function callingCsv(records: CallingRecord[]) {
  const cell = (value: string) => `"${(/^[=+\-@\t\r\n]/.test(value) ? "'" + value : value).replaceAll('"','""')}"`;
  const rows = [['Lead ID','Name','Service','Phone','Last call result']];
  for (const row of callingRows(records, '')) if (row.usable) rows.push([row.record.id,row.record.name,row.record.category,row.method.value,row.latest?.outcome ?? 'Never dialed']);
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n');
}
