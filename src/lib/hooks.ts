import { useEffect, useState, useSyncExternalStore } from 'react';
import { getPhotoUrl } from '../backend/api';
import { getDB, subscribe } from '../backend/store';
import type { DB, Photo, User } from '../backend/types';

export function useDB<T>(sel: (db: DB) => T): T {
  // The DB object is immutable between writes, so it's a stable snapshot; selectors run per render.
  return sel(useSyncExternalStore(subscribe, getDB));
}

export function useMe(): User | undefined {
  return useDB((db) => db.users.find((u) => u.id === db.sessionUserId));
}

/** Resolves a photo to a displayable URL through the access-checked API. */
export function usePhotoUrl(photo: Photo | undefined, variant: 'thumb' | 'full') {
  const ref = photo ? (variant === 'thumb' ? photo.thumb : photo.src) : undefined;
  const [url, setUrl] = useState<string | undefined>(ref && !ref.startsWith('idb:') ? ref : undefined);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!photo || !ref) return;
    if (!ref.startsWith('idb:')) {
      setUrl(ref);
      return;
    }
    let alive = true;
    getPhotoUrl(photo, variant).then(
      (u) => alive && setUrl(u),
      () => alive && setError(true),
    );
    return () => {
      alive = false;
    };
  }, [ref]); // eslint-disable-line react-hooks/exhaustive-deps
  return { url, error };
}

export function useReducedMotion() {
  const pref = useDB((db) => db.settings.reducedMotion);
  const [sys, setSys] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const m = matchMedia('(prefers-reduced-motion: reduce)');
    const h = () => setSys(m.matches);
    m.addEventListener('change', h);
    return () => m.removeEventListener('change', h);
  }, []);
  return pref === 'on' || (pref === 'system' && sys);
}

export function useOnline() {
  const [on, setOn] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const a = () => setOn(true);
    const b = () => setOn(false);
    addEventListener('online', a);
    addEventListener('offline', b);
    return () => {
      removeEventListener('online', a);
      removeEventListener('offline', b);
    };
  }, []);
  return on;
}

export function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  if (d === 1) return 'yesterday';
  if (d < 30) return `${d} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
