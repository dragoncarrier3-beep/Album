import { createSeed } from './seed';
import type { DB } from './types';

/**
 * Local demo "database". Mirrors the Supabase/Postgres schema in /supabase/migrations
 * and is persisted to localStorage so the demo survives reloads. All access goes
 * through api.ts, which plays the role of RLS policies + Edge Functions.
 */
const KEY = 'lumen.db.v3';
let state: DB = load();
const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function load(): DB {
  const s = storage();
  try {
    const raw = s?.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      if (parsed.version === createSeed().version) return parsed;
    }
  } catch {
    /* fall through to seed */
  }
  return createSeed();
}

export function getDB(): DB {
  return state;
}

export function setDB(fn: (db: DB) => DB | void) {
  const draft = structuredClone(state);
  const next = fn(draft) ?? draft;
  state = next;
  try {
    storage()?.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked — keep in memory */
  }
  listeners.forEach((l) => l());
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function resetDB(keepSession = false) {
  const prev = state;
  state = createSeed();
  if (keepSession) {
    state.sessionUserId = prev.sessionUserId;
    state.onboarded = prev.onboarded;
  }
  setDB(() => {});
}
