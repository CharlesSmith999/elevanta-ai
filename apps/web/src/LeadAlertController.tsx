import { useCallback, useEffect, useRef, useState } from 'react';
import { IconBellRinging, IconVolume } from '@tabler/icons-react';
import type { Session } from '@supabase/supabase-js';
import { loadRemoteLeads, loadResearchLeads } from './api';
import { ownerId, type Lead, type User } from './domain';

export const researchAlertRefreshEvent = 'elevanta:research-alert-refresh';

const volumeStorageKey = 'elevanta-lead-bell-volume-v1';
const claimsStorageKey = 'elevanta-lead-bell-claims-v1';
const minimumVolume = 15;
const pollMilliseconds = 15_000;
const claimLifetime = 86_400_000;

function savedVolume() {
  try {
    const stored = localStorage.getItem(volumeStorageKey);
    const value = stored === null ? 85 : Number(stored);
    return Number.isFinite(value) ? Math.min(100, Math.max(minimumVolume, value)) : 85;
  } catch { return 85; }
}

function claimAlert(userId: string, kind: 'research' | 'assignment', eventId: string) {
  const now = Date.now();
  let claims: Record<string, number> = {};
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(claimsStorageKey) ?? '{}');
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) claims = stored as Record<string, number>;
  } catch { claims = {}; }
  claims = Object.fromEntries(Object.entries(claims).filter(([, claimedAt]) => typeof claimedAt === 'number' && claimedAt <= now && now - claimedAt < claimLifetime));
  const key = `${userId}:${kind}:${eventId}`;
  if (claims[key]) return false;
  claims[key] = now;
  try { localStorage.setItem(claimsStorageKey, JSON.stringify(claims)); } catch { return true; }
  return true;
}

function strike(context: AudioContext, at: number, volume: number) {
  const master = context.createGain();
  master.gain.setValueAtTime(0.0001, at);
  master.gain.exponentialRampToValueAtTime(Math.max(0.025, volume * 0.34), at + 0.012);
  master.gain.exponentialRampToValueAtTime(0.0001, at + 1.35);
  master.connect(context.destination);
  [880, 1320, 1760].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const overtone = context.createGain();
    oscillator.type = index === 0 ? 'sine' : 'triangle';
    oscillator.frequency.setValueAtTime(frequency, at);
    overtone.gain.setValueAtTime(index === 0 ? 0.9 : 0.24 / index, at);
    oscillator.connect(overtone);
    overtone.connect(master);
    oscillator.start(at);
    oscillator.stop(at + 1.4);
  });
}

function ring(context: AudioContext, volume: number) {
  const now = context.currentTime + 0.015;
  strike(context, now, volume);
  strike(context, now + 0.24, volume * 0.82);
}

export function LeadAlertController({ session, user, onLeads, onNotice }: {
  session?: Session;
  user?: User;
  onLeads: (leads: Lead[]) => void;
  onNotice: (message: string) => void;
}) {
  const [volume, setVolume] = useState(savedVolume);
  const [audioReady, setAudioReady] = useState(false);
  const audioContext = useRef<AudioContext | undefined>(undefined);
  const volumeRef = useRef(volume);
  const pendingBell = useRef(false);

  const eligibleForResearch = user?.role === 'admin' || user?.role === 'marketer' || (user?.role === 'manager' && user.department === 'marketing');
  const eligibleForAssignment = user?.role === 'sales_agent';
  const eligible = Boolean(session && user && (eligibleForResearch || eligibleForAssignment));

  useEffect(() => {
    volumeRef.current = volume;
    try { localStorage.setItem(volumeStorageKey, String(volume)); } catch { /* Keep the current-session setting. */ }
  }, [volume]);

  const getAudioContext = useCallback(() => {
    if (!audioContext.current || audioContext.current.state === 'closed') {
      const AudioContextConstructor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioContextConstructor) audioContext.current = new AudioContextConstructor();
    }
    return audioContext.current;
  }, []);

  const playBell = useCallback(async () => {
    const context = getAudioContext();
    if (!context) return;
    if (context.state !== 'running') {
      pendingBell.current = true;
      return;
    }
    pendingBell.current = false;
    ring(context, volumeRef.current / 100);
  }, [getAudioContext]);

  const unlockAudio = useCallback(async () => {
    const context = getAudioContext();
    if (!context) return;
    try {
      if (context.state !== 'running') await context.resume();
      const ready = context.state === 'running';
      setAudioReady(ready);
      if (ready && pendingBell.current) await playBell();
    } catch { setAudioReady(false); }
  }, [getAudioContext, playBell]);

  useEffect(() => {
    if (!eligible) return;
    const unlock = () => { void unlockAudio(); };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [eligible, unlockAudio]);

  useEffect(() => {
    if (!session || !user || (!eligibleForResearch && !eligibleForAssignment)) return;
    let active = true;
    let initialized = false;
    let known = new Set<string>();
    let timer: number | undefined;

    const check = async () => {
      try {
        if (eligibleForResearch) {
          const records = await loadResearchLeads(session);
          if (!active) return;
          const next = new Set(records.map((record) => record.id));
          if (initialized) {
            const newIds = [...next].filter((id) => !known.has(id) && claimAlert(user.id, 'research', id));
            if (newIds.length) {
              window.dispatchEvent(new CustomEvent(researchAlertRefreshEvent));
              onNotice(`${newIds.length} new lead${newIds.length === 1 ? '' : 's'} arrived in Lead Research.`);
              void playBell();
            }
          }
          known = next;
        } else {
          const leads = await loadRemoteLeads(session);
          if (!active) return;
          const next = new Set(leads.flatMap((lead) => lead.assignments
            .filter((assignment) => !assignment.endedAt && assignment.ownerId === user.id && ownerId(lead) === user.id)
            .map((assignment) => assignment.id)));
          if (initialized) {
            const newIds = [...next].filter((id) => !known.has(id) && claimAlert(user.id, 'assignment', id));
            if (newIds.length) {
              onLeads(leads);
              onNotice(`${newIds.length} new lead${newIds.length === 1 ? '' : 's'} assigned to you.`);
              void playBell();
            }
          }
          known = next;
        }
        initialized = true;
      } catch {
        // The normal connection banner owns API failure messaging. Alerts retry quietly.
      } finally {
        if (active) timer = window.setTimeout(() => { void check(); }, pollMilliseconds);
      }
    };

    void check();
    return () => { active = false; if (timer) window.clearTimeout(timer); };
  }, [eligibleForAssignment, eligibleForResearch, onLeads, onNotice, playBell, session, user]);

  useEffect(() => () => { void audioContext.current?.close(); }, []);

  if (!eligible) return null;
  return <aside className="lead-bell-control" aria-label="New lead bell settings">
    <button type="button" className="lead-bell-test" onClick={() => { pendingBell.current = true; void unlockAudio(); }} title="Play the lead bell"><IconBellRinging size={19} /><span>Test bell</span></button>
    <label><IconVolume size={17} /><span>Bell volume</span><input aria-label="Lead bell volume" type="range" min={minimumVolume} max="100" step="5" value={volume} onChange={(event) => setVolume(Number(event.target.value))} /><b>{volume}%</b></label>
    <small>{audioReady ? 'Lead bell active' : 'Click once to enable sound'}</small>
  </aside>;
}
