import { zipSync } from 'fflate';
import { blobStore } from './blobs';
import { DemoVerifier, type OwnershipVerifier, type VerificationResult } from './nft';
import { DEMO_USER_ID, DEMO_WALLET } from './seed';
import { getDB, resetDB, setDB } from './store';
import type { Album, DB, Invitation, NFTAsset, Photo, Privacy, Role, ShareLink, ThemeId, User, WalletConnection } from './types';

/**
 * LUMEN demo backend. Every function here re-checks authorisation against the
 * current session, the same way Supabase RLS policies + Edge Functions do in the
 * production architecture. The UI never decides access on its own.
 */

export class ApiError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export const config = { latency: 350 };
const wait = (ms?: number) => (config.latency ? new Promise((r) => setTimeout(r, ms ?? config.latency)) : Promise.resolve());
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-3)}`;
const now = () => new Date().toISOString();
const GRANT_TTL_MS = 10 * 60 * 1000;
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export const verifier: OwnershipVerifier = new DemoVerifier(() => getDB().settings.demoScenario);

function audit(db: DB, action: string, target?: string) {
  db.audit.unshift({ id: uid('ev'), at: now(), actor: db.sessionUserId ?? 'anonymous', action, target });
  db.audit = db.audit.slice(0, 200);
}

function requireUser(): User {
  const db = getDB();
  const u = db.users.find((x) => x.id === db.sessionUserId);
  if (!u) throw new ApiError('unauthenticated', 'Please sign in to continue.');
  return u;
}

function ownAlbum(albumId: string): Album {
  const u = requireUser();
  const a = getDB().albums.find((x) => x.id === albumId);
  if (!a) throw new ApiError('not_found', 'Album not found.');
  if (a.ownerId !== u.id) throw new ApiError('forbidden', 'Only the album owner can do that.');
  return a;
}

// ---------------------------------------------------------------- Auth

export async function exploreDemo() {
  await wait(200);
  setDB((db) => {
    db.sessionUserId = DEMO_USER_ID;
    db.onboarded = true;
    if (!db.wallets[DEMO_USER_ID]) db.wallets[DEMO_USER_ID] = { address: DEMO_WALLET, network: 'Demo', mode: 'demo', verifiedAt: now() };
    audit(db, 'auth.demo_sign_in');
  });
}

export async function signIn(email: string, password: string) {
  await wait();
  const u = getDB().users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
  if (!u || !u.password || u.password !== password) throw new ApiError('invalid_credentials', 'Email or password is incorrect.');
  setDB((db) => {
    db.sessionUserId = u.id;
    db.onboarded = true;
    audit(db, 'auth.sign_in');
  });
}

export async function signUp(name: string, email: string, password: string) {
  await wait();
  const e = email.trim().toLowerCase();
  if (!name.trim()) throw new ApiError('validation', 'Please enter your name.');
  if (!/^\S+@\S+\.\S+$/.test(e)) throw new ApiError('validation', 'Please enter a valid email address.');
  if (password.length < 8) throw new ApiError('validation', 'Password must be at least 8 characters.');
  if (getDB().users.some((x) => x.email.toLowerCase() === e)) throw new ApiError('exists', 'An account with this email already exists.');
  const id = uid('u');
  setDB((db) => {
    db.users.push({ id, name: name.trim(), username: e.split('@')[0].replace(/[^a-z0-9]/g, ''), email: e, password, createdAt: now() });
    db.sessionUserId = id;
    db.onboarded = true;
    audit(db, 'auth.sign_up');
  });
}

export function signOut() {
  setDB((db) => {
    audit(db, 'auth.sign_out');
    db.sessionUserId = null;
  });
}

export async function updateProfile(patch: Partial<Pick<User, 'name' | 'bio' | 'avatar'>>) {
  const u = requireUser();
  if (patch.name !== undefined && !patch.name.trim()) throw new ApiError('validation', 'Display name cannot be empty.');
  await wait();
  setDB((db) => {
    Object.assign(db.users.find((x) => x.id === u.id)!, patch);
  });
}

export async function deleteAccount() {
  const u = requireUser();
  await wait(600);
  const mine = getDB().photos.filter((p) => p.ownerId === u.id && p.src.startsWith('idb:'));
  await Promise.all(mine.flatMap((p) => [blobStore.remove(p.src.slice(4)), blobStore.remove(p.thumb.slice(4))]));
  if (u.id === DEMO_USER_ID) {
    resetDB();
    return;
  }
  setDB((db) => {
    const albumIds = new Set(db.albums.filter((a) => a.ownerId === u.id).map((a) => a.id));
    db.albums = db.albums.filter((a) => !albumIds.has(a.id));
    db.photos = db.photos.filter((p) => p.ownerId !== u.id);
    db.shareLinks = db.shareLinks.filter((l) => !albumIds.has(l.albumId));
    db.invitations = db.invitations.filter((i) => !albumIds.has(i.albumId));
    db.users = db.users.filter((x) => x.id !== u.id);
    delete db.wallets[u.id];
    db.sessionUserId = null;
  });
}

// ---------------------------------------------------------------- Access control

export type Access = 'owner' | 'public' | 'invited' | 'nft-grant';

/** Equivalent of the `can_view_album()` SQL function used by RLS. */
export function accessFor(db: DB, album: Album, userId: string | null): Access | null {
  if (userId && album.ownerId === userId) return 'owner';
  if (album.privacy === 'public') return 'public';
  if (!userId) return null;
  if (album.privacy === 'invite' && db.invitations.some((i) => i.albumId === album.id && i.userId === userId && i.status === 'accepted'))
    return 'invited';
  if (album.privacy === 'nft' && db.grants.some((g) => g.albumId === album.id && g.userId === userId && g.expiresAt > Date.now()))
    return 'nft-grant';
  return null;
}

export interface AlbumView {
  album: Album;
  owner: User;
  access: Access | null;
  photos: Photo[]; // empty unless access is granted
  locked: boolean;
  nft?: NFTAsset;
}

export function viewAlbum(albumId: string, opts: { asVisitor?: boolean } = {}): AlbumView {
  const db = getDB();
  const album = db.albums.find((a) => a.id === albumId);
  if (!album) throw new ApiError('not_found', 'This album doesn’t exist or was deleted.');
  let access = accessFor(db, album, db.sessionUserId);
  if (opts.asVisitor && access === 'owner') access = accessFor(db, album, '__visitor__');
  const owner = db.users.find((u) => u.id === album.ownerId)!;
  const nft = db.nfts.find((n) => n.id === album.nftId);
  if (!access) {
    if (album.privacy === 'nft') return { album, owner, access, photos: [], locked: true, nft };
    throw new ApiError('forbidden', 'This album is private. Ask the owner for an invitation or a sharing link.');
  }
  const photos = album.photoIds.map((id) => db.photos.find((p) => p.id === id)).filter(Boolean) as Photo[];
  return { album, owner, access, photos, locked: false, nft };
}

const urlCache = new Map<string, string>();
/** Returns a displayable URL for a photo after checking access ("signed URL"). */
export async function getPhotoUrl(photo: Photo, variant: 'thumb' | 'full'): Promise<string> {
  const ref = variant === 'thumb' ? photo.thumb : photo.src;
  if (!ref.startsWith('idb:')) return ref;
  const db = getDB();
  const album = db.albums.find((a) => a.id === photo.albumId);
  const shared = db.shareLinks.some((l) => l.albumId === photo.albumId && linkActive(l));
  if (!album || (!accessFor(db, album, db.sessionUserId) && !shared)) throw new ApiError('forbidden', 'No access to this photo.');
  const cached = urlCache.get(ref);
  if (cached) return cached;
  const blob = await blobStore.get(ref.slice(4));
  if (!blob) throw new ApiError('missing', 'This photo’s file is no longer available on this device.');
  const url = URL.createObjectURL(blob);
  urlCache.set(ref, url);
  return url;
}

// ---------------------------------------------------------------- Albums

export interface AlbumInput {
  title: string;
  description: string;
  theme: ThemeId;
  privacy: Privacy;
  nftId?: string;
  coverFile?: File;
}

export async function createAlbum(input: AlbumInput): Promise<Album> {
  const u = requireUser();
  if (!input.title.trim()) throw new ApiError('validation', 'Please give your album a title.');
  if (input.title.trim().length > 60) throw new ApiError('validation', 'Title must be 60 characters or fewer.');
  if (input.privacy === 'nft' && !input.nftId) throw new ApiError('validation', 'Choose a collectible for NFT Owner Access.');
  if (input.nftId) await assertOwnsNft(input.nftId);
  await wait();
  const album: Album = {
    id: uid('a'), ownerId: u.id, title: input.title.trim(), description: input.description.trim(), theme: input.theme,
    privacy: input.privacy, photoIds: [], nftId: input.nftId, createdAt: now(), updatedAt: now(),
  };
  setDB((db) => {
    db.albums.unshift(album);
    audit(db, 'album.create', album.id);
  });
  if (input.coverFile) {
    const p = await uploadPhoto(album.id, input.coverFile, '', {});
    await updateAlbum(album.id, { coverPhotoId: p.id });
  }
  return getDB().albums.find((a) => a.id === album.id)!;
}

export async function updateAlbum(albumId: string, patch: Partial<Pick<Album, 'title' | 'description' | 'theme' | 'privacy' | 'coverPhotoId' | 'category'>>) {
  const a = ownAlbum(albumId);
  if (patch.title !== undefined && !patch.title.trim()) throw new ApiError('validation', 'Title cannot be empty.');
  if (patch.privacy === 'nft' && !a.nftId) throw new ApiError('validation', 'Link a collectible first to use NFT Owner Access.');
  if (patch.coverPhotoId && !a.photoIds.includes(patch.coverPhotoId)) throw new ApiError('validation', 'Cover must be a photo in this album.');
  await wait(200);
  setDB((db) => {
    const t = db.albums.find((x) => x.id === albumId)!;
    Object.assign(t, patch, { updatedAt: now() });
    if (patch.privacy && patch.privacy !== 'nft') db.grants = db.grants.filter((g) => g.albumId !== albumId);
    audit(db, patch.privacy ? `album.privacy.${patch.privacy}` : 'album.update', albumId);
  });
}

export async function deleteAlbum(albumId: string) {
  const a = ownAlbum(albumId);
  await wait();
  const photos = getDB().photos.filter((p) => p.albumId === a.id);
  await Promise.all(photos.filter((p) => p.src.startsWith('idb:')).flatMap((p) => [blobStore.remove(p.src.slice(4)), blobStore.remove(p.thumb.slice(4))]));
  setDB((db) => {
    db.albums = db.albums.filter((x) => x.id !== albumId);
    db.photos = db.photos.filter((p) => p.albumId !== albumId);
    db.shareLinks = db.shareLinks.filter((l) => l.albumId !== albumId);
    db.invitations = db.invitations.filter((i) => i.albumId !== albumId);
    db.grants = db.grants.filter((g) => g.albumId !== albumId);
    audit(db, 'album.delete', albumId);
  });
}

export async function reorderPhotos(albumId: string, photoIds: string[]) {
  const a = ownAlbum(albumId);
  if (photoIds.length !== a.photoIds.length || !photoIds.every((id) => a.photoIds.includes(id))) throw new ApiError('validation', 'Invalid order.');
  setDB((db) => {
    db.albums.find((x) => x.id === albumId)!.photoIds = photoIds;
  });
}

export async function updateCaption(photoId: string, caption: string) {
  const p = getDB().photos.find((x) => x.id === photoId);
  if (!p) throw new ApiError('not_found', 'Photo not found.');
  ownAlbum(p.albumId);
  await wait(150);
  setDB((db) => {
    db.photos.find((x) => x.id === photoId)!.caption = caption.trim().slice(0, 280);
  });
}

export async function movePhoto(photoId: string, toAlbumId: string) {
  const p = getDB().photos.find((x) => x.id === photoId);
  if (!p) throw new ApiError('not_found', 'Photo not found.');
  ownAlbum(p.albumId);
  ownAlbum(toAlbumId);
  if (p.albumId === toAlbumId) return;
  await wait(200);
  setDB((db) => {
    const from = db.albums.find((a) => a.id === p.albumId)!;
    const to = db.albums.find((a) => a.id === toAlbumId)!;
    from.photoIds = from.photoIds.filter((id) => id !== photoId);
    if (from.coverPhotoId === photoId) from.coverPhotoId = from.photoIds[0];
    to.photoIds.unshift(photoId);
    to.coverPhotoId ??= photoId;
    db.photos.find((x) => x.id === photoId)!.albumId = toAlbumId;
    from.updatedAt = to.updatedAt = now();
    audit(db, 'photo.move', photoId);
  });
}

export async function removePhoto(photoId: string) {
  const p = getDB().photos.find((x) => x.id === photoId);
  if (!p) throw new ApiError('not_found', 'Photo not found.');
  ownAlbum(p.albumId);
  await wait(200);
  if (p.src.startsWith('idb:')) await Promise.all([blobStore.remove(p.src.slice(4)), blobStore.remove(p.thumb.slice(4))]);
  setDB((db) => {
    const a = db.albums.find((x) => x.id === p.albumId)!;
    a.photoIds = a.photoIds.filter((id) => id !== photoId);
    if (a.coverPhotoId === photoId) a.coverPhotoId = a.photoIds[0];
    a.updatedAt = now();
    db.photos = db.photos.filter((x) => x.id !== photoId);
    db.favorites = db.favorites.filter((f) => f.photoId !== photoId);
    audit(db, 'photo.remove', photoId);
  });
}

export function toggleFavorite(photoId: string) {
  const u = requireUser();
  setDB((db) => {
    const i = db.favorites.findIndex((f) => f.userId === u.id && f.photoId === photoId);
    if (i >= 0) db.favorites.splice(i, 1);
    else db.favorites.push({ userId: u.id, photoId });
  });
}

// ---------------------------------------------------------------- Uploads

export interface Thumbnailer {
  (file: Blob, maxW: number): Promise<{ blob: Blob; w: number; h: number }>;
}

export const canvasThumbnailer: Thumbnailer = async (file, maxW) => {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    throw new ApiError('unsupported_format', 'This browser can’t read that image format. Try JPEG, PNG or WebP.');
  }
  const scale = Math.min(1, maxW / bmp.width);
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
  const ow = bmp.width;
  const oh = bmp.height;
  bmp.close();
  const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new ApiError('thumb', 'Could not create thumbnail.'))), 'image/jpeg', 0.82));
  return { blob, w: ow, h: oh };
};

export function validateFile(file: File) {
  const type = file.type || (/\.(heic|heif)$/i.test(file.name) ? 'image/heic' : '');
  if (!ACCEPTED_TYPES.includes(type)) throw new ApiError('unsupported_format', `${file.name}: unsupported format. Use JPEG, PNG, WebP or HEIC.`);
  if (file.size > MAX_UPLOAD_BYTES) throw new ApiError('too_large', `${file.name} is larger than 25 MB.`);
  if (file.size === 0) throw new ApiError('empty', `${file.name} is empty.`);
}

export interface UploadOpts {
  onProgress?: (pct: number) => void;
  signal?: AbortSignal;
  thumbnailer?: Thumbnailer;
}

/** Uploads a real file. Resolves only after the "server" has committed the record. */
export async function uploadPhoto(albumId: string, file: File, caption: string, opts: UploadOpts): Promise<Photo> {
  const u = requireUser();
  ownAlbum(albumId);
  validateFile(file);
  const { onProgress = () => {}, signal, thumbnailer = canvasThumbnailer } = opts;
  const abortCheck = () => {
    if (signal?.aborted) throw new ApiError('cancelled', 'Upload cancelled.');
  };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new ApiError('offline', 'You’re offline. Reconnect and tap retry.');
  onProgress(4);
  const thumb = await thumbnailer(file, 480);
  abortCheck();
  onProgress(18);

  let original: Blob = file;
  if (getDB().settings.uploadPolicy === 'optimized' && file.size > 1.5 * 1024 * 1024) {
    original = (await thumbnailer(file, 2048)).blob;
  }

  // Chunked transfer to private storage (resumable-upload style progress).
  const chunk = 256 * 1024;
  const parts: Blob[] = [];
  const total = Math.max(1, Math.ceil(original.size / chunk));
  const fail = getDB().settings.simulateNetworkFailure;
  for (let i = 0; i < total; i++) {
    abortCheck();
    if (fail && i >= Math.floor(total * 0.6)) {
      setDB((db) => {
        db.settings.simulateNetworkFailure = false;
      });
      throw new ApiError('network', 'Network interrupted. Your photo wasn’t saved — tap retry.');
    }
    parts.push(original.slice(i * chunk, (i + 1) * chunk));
    await wait(Math.min(120, 900 / total) * (config.latency ? 1 : 0));
    onProgress(18 + Math.round(((i + 1) / total) * 72));
  }
  abortCheck();
  const id = uid('p');
  await blobStore.put(`orig-${id}`, new Blob(parts, { type: original.type || file.type }));
  await blobStore.put(`thumb-${id}`, thumb.blob);
  await wait(250);
  const photo: Photo = {
    id, albumId, ownerId: u.id, src: `idb:orig-${id}`, thumb: `idb:thumb-${id}`, w: thumb.w, h: thumb.h,
    name: file.name, caption: caption.trim(), mime: file.type, size: file.size, createdAt: now(),
  };
  setDB((db) => {
    db.photos.push(photo);
    const a = db.albums.find((x) => x.id === albumId)!;
    a.photoIds.unshift(id);
    a.coverPhotoId ??= id;
    a.updatedAt = now();
    audit(db, 'photo.upload', id);
  });
  onProgress(100);
  return photo;
}

export async function downloadPhoto(photoId: string): Promise<{ blob: Blob; filename: string }> {
  const db = getDB();
  const p = db.photos.find((x) => x.id === photoId);
  if (!p) throw new ApiError('not_found', 'Photo not found.');
  const album = db.albums.find((a) => a.id === p.albumId)!;
  if (!accessFor(db, album, db.sessionUserId)) throw new ApiError('forbidden', 'You don’t have permission to download this photo.');
  let blob: Blob | undefined;
  if (p.src.startsWith('idb:')) blob = await blobStore.get(p.src.slice(4));
  else blob = await (await fetch(p.src)).blob();
  if (!blob) throw new ApiError('missing', 'Original file not found.');
  setDB((d) => audit(d, 'photo.download', photoId));
  return { blob, filename: p.name };
}

export async function exportMyData(): Promise<Blob> {
  const u = requireUser();
  const db = getDB();
  const mine = db.photos.filter((p) => p.ownerId === u.id);
  const files: Record<string, Uint8Array> = {};
  for (const p of mine) {
    const { blob } = await downloadPhoto(p.id);
    const album = db.albums.find((a) => a.id === p.albumId)?.title ?? 'Unsorted';
    files[`${album}/${p.name}`] = new Uint8Array(await blob.arrayBuffer());
  }
  const manifest = { user: { name: u.name, username: u.username }, albums: db.albums.filter((a) => a.ownerId === u.id), photos: mine, exportedAt: now() };
  files['lumen-manifest.json'] = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
  return new Blob([zipSync(files, { level: 0 })], { type: 'application/zip' });
}

// ---------------------------------------------------------------- Sharing

export function linkActive(l: ShareLink) {
  return l.enabled && !l.revokedAt && (!l.expiresAt || new Date(l.expiresAt).getTime() > Date.now());
}

export async function createShareLink(albumId: string, opts: { expiresAt?: string; passcode?: string } = {}): Promise<ShareLink> {
  const a = ownAlbum(albumId);
  if (a.privacy === 'nft') throw new ApiError('validation', 'NFT Owner Access albums can’t be shared by link.');
  await wait();
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (b) => 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 56]).join('');
  const link: ShareLink = { id: uid('sl'), albumId, token, enabled: true, role: 'viewer', views: 0, createdAt: now(), ...opts };
  setDB((db) => {
    db.shareLinks.push(link);
    const t = db.albums.find((x) => x.id === albumId)!;
    if (t.privacy === 'private') t.privacy = 'link';
    audit(db, 'share_link.create', link.id);
  });
  return link;
}

export async function updateShareLink(linkId: string, patch: Partial<Pick<ShareLink, 'enabled' | 'expiresAt' | 'passcode'>>) {
  const l = getDB().shareLinks.find((x) => x.id === linkId);
  if (!l) throw new ApiError('not_found', 'Link not found.');
  ownAlbum(l.albumId);
  await wait(150);
  setDB((db) => {
    Object.assign(db.shareLinks.find((x) => x.id === linkId)!, patch);
    audit(db, 'share_link.update', linkId);
  });
}

export async function revokeShareLink(linkId: string) {
  const l = getDB().shareLinks.find((x) => x.id === linkId);
  if (!l) throw new ApiError('not_found', 'Link not found.');
  ownAlbum(l.albumId);
  await wait();
  setDB((db) => {
    const t = db.shareLinks.find((x) => x.id === linkId)!;
    t.revokedAt = now();
    t.enabled = false;
    audit(db, 'share_link.revoke', linkId);
  });
}

/** Public endpoint (no session needed): resolves a share token server-side. */
export async function openShareLink(token: string, passcode?: string): Promise<{ album: Album; owner: User; photos: Photo[]; link: ShareLink }> {
  await wait();
  const db = getDB();
  const link = db.shareLinks.find((l) => l.token === token);
  if (!link) throw new ApiError('invalid_link', 'This link isn’t valid.');
  if (link.revokedAt) throw new ApiError('revoked', 'This link has been revoked by the owner and no longer gives access.');
  if (!link.enabled) throw new ApiError('disabled', 'This link is currently turned off by the owner.');
  if (link.expiresAt && new Date(link.expiresAt).getTime() <= Date.now()) throw new ApiError('expired', 'This link has expired.');
  const album = db.albums.find((a) => a.id === link.albumId);
  if (!album || album.privacy === 'nft') throw new ApiError('invalid_link', 'This album is no longer available.');
  if (link.passcode && link.passcode !== passcode) throw new ApiError(passcode ? 'bad_passcode' : 'passcode_required', passcode ? 'That passcode isn’t right.' : 'Enter the passcode to view this album.');
  setDB((d) => {
    d.shareLinks.find((l) => l.id === link.id)!.views++;
  });
  const photos = album.photoIds.map((id) => db.photos.find((p) => p.id === id)).filter(Boolean) as Photo[];
  return { album, owner: db.users.find((u) => u.id === album.ownerId)!, photos, link };
}

export async function inviteByEmail(albumId: string, email: string, role: Role): Promise<Invitation> {
  ownAlbum(albumId);
  const e = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(e)) throw new ApiError('validation', 'Enter a valid email address.');
  if (getDB().invitations.some((i) => i.albumId === albumId && i.email === e)) throw new ApiError('exists', 'That person is already invited.');
  await wait();
  const existing = getDB().users.find((u) => u.email === e);
  const inv: Invitation = { id: uid('inv'), albumId, email: e, role, status: 'pending', createdAt: now(), userId: existing?.id };
  setDB((db) => {
    db.invitations.push(inv);
    const t = db.albums.find((x) => x.id === albumId)!;
    if (t.privacy === 'private') t.privacy = 'invite';
    audit(db, 'invitation.create', inv.id);
  });
  return inv;
}

export async function setInvitationRole(invId: string, role: Role) {
  const inv = getDB().invitations.find((i) => i.id === invId);
  if (!inv) throw new ApiError('not_found', 'Invitation not found.');
  ownAlbum(inv.albumId);
  setDB((db) => {
    db.invitations.find((i) => i.id === invId)!.role = role;
  });
}

export async function revokeInvitation(invId: string) {
  const inv = getDB().invitations.find((i) => i.id === invId);
  if (!inv) throw new ApiError('not_found', 'Invitation not found.');
  ownAlbum(inv.albumId);
  await wait(200);
  setDB((db) => {
    db.invitations = db.invitations.filter((i) => i.id !== invId);
    audit(db, 'invitation.revoke', invId);
  });
}

// ---------------------------------------------------------------- Wallet & NFTs

export function walletFor(db: DB = getDB()): WalletConnection | undefined {
  return db.sessionUserId ? db.wallets[db.sessionUserId] : undefined;
}

export async function requestWalletChallenge(): Promise<{ address: string; nonce: string; message: string }> {
  requireUser();
  await wait();
  const nonce = Math.random().toString(36).slice(2, 12);
  const address = DEMO_WALLET;
  const message = `lumen.app wants you to sign in with your wallet:\n${address}\n\nVerify you control this wallet to view your collectibles. This request will not trigger a blockchain transaction or cost any fees.\n\nNonce: ${nonce}\nIssued At: ${now()}`;
  return { address, nonce, message };
}

/** In production: verify the EIP-4361 signature server-side, then store the connection. */
export async function completeWalletConnection(address: string, _signature: string) {
  const u = requireUser();
  await wait(600);
  setDB((db) => {
    db.wallets[u.id] = { address, network: 'Demo', mode: 'demo', verifiedAt: now() };
    audit(db, 'wallet.connect', address);
  });
}

export async function switchNetwork(network: string) {
  const u = requireUser();
  await wait(300);
  setDB((db) => {
    const w = db.wallets[u.id];
    if (w) w.network = network;
  });
}

export function disconnectWallet() {
  const u = requireUser();
  setDB((db) => {
    delete db.wallets[u.id];
    db.grants = db.grants.filter((g) => g.userId !== u.id);
    audit(db, 'wallet.disconnect');
  });
}

export function myCollectibles(db: DB = getDB()): NFTAsset[] {
  const w = walletFor(db);
  if (!w) return [];
  return db.nfts.filter((n) => n.ownerWallet.toLowerCase() === w.address.toLowerCase());
}

async function assertOwnsNft(nftId: string): Promise<VerificationResult> {
  const nft = getDB().nfts.find((n) => n.id === nftId);
  if (!nft) throw new ApiError('not_found', 'Collectible not found.');
  const res = await verifier.verify(walletFor(), nft);
  if (!res.owned) throw verificationError(res);
  return res;
}

export function verificationError(r: VerificationResult) {
  switch (r.reason) {
    case 'disconnected':
      return new ApiError('wallet_disconnected', 'Connect your wallet to continue.');
    case 'wrong_network':
      return new ApiError('wrong_network', 'Your wallet is on a different network. Switch to the collectible’s network and try again.');
    case 'unavailable':
      return new ApiError('verification_unavailable', 'Ownership verification is temporarily unavailable. Please try again shortly.');
    default:
      return new ApiError('not_owned', 'This wallet doesn’t currently own the required collectible.');
  }
}

export async function linkNft(albumId: string, nftId: string) {
  ownAlbum(albumId);
  await assertOwnsNft(nftId);
  await wait();
  setDB((db) => {
    db.albums.find((a) => a.id === albumId)!.nftId = nftId;
    audit(db, 'album.nft_link', `${albumId}:${nftId}`);
  });
}

export async function unlinkNft(albumId: string) {
  ownAlbum(albumId);
  await wait(250);
  setDB((db) => {
    const a = db.albums.find((x) => x.id === albumId)!;
    a.nftId = undefined;
    if (a.privacy === 'nft') a.privacy = 'private';
    db.grants = db.grants.filter((g) => g.albumId !== albumId);
    audit(db, 'album.nft_unlink', albumId);
  });
}

/**
 * Edge Function `request-gated-access`: re-checks current ownership on every request
 * and issues a short-lived grant. Photos stay hidden until this succeeds.
 */
export async function requestGatedAccess(albumId: string): Promise<VerificationResult> {
  const u = requireUser();
  const album = getDB().albums.find((a) => a.id === albumId);
  if (!album) throw new ApiError('not_found', 'Album not found.');
  if (album.privacy !== 'nft' || !album.nftId) throw new ApiError('validation', 'This album isn’t NFT-gated.');
  const nft = getDB().nfts.find((n) => n.id === album.nftId)!;
  await wait(900);
  const res = await verifier.verify(walletFor(), nft);
  setDB((db) => {
    db.grants = db.grants.filter((g) => !(g.albumId === albumId && g.userId === u.id));
    if (res.owned) db.grants.push({ albumId, userId: u.id, expiresAt: Date.now() + GRANT_TTL_MS });
    audit(db, res.owned ? 'nft_access.granted' : `nft_access.denied.${res.reason}`, albumId);
  });
  if (!res.owned) throw verificationError(res);
  return res;
}

export function relockAlbum(albumId: string) {
  setDB((db) => {
    db.grants = db.grants.filter((g) => g.albumId !== albumId);
  });
}

/** Demo-only: simulate the collectible being transferred to someone else (and back). */
export async function demoTransferNft(nftId: string, away: boolean) {
  requireUser();
  await wait(500);
  setDB((db) => {
    const n = db.nfts.find((x) => x.id === nftId)!;
    n.ownerWallet = away ? '0x7ra115fe2000000000000000000000000000dEm0' : DEMO_WALLET;
    // Ownership changed: invalidate any grants that depended on it.
    const gated = db.albums.filter((a) => a.nftId === nftId).map((a) => a.id);
    db.grants = db.grants.filter((g) => !gated.includes(g.albumId));
    audit(db, away ? 'nft.transfer_out' : 'nft.transfer_in', nftId);
  });
}

// ---------------------------------------------------------------- Misc

export function markNotificationsRead() {
  setDB((db) => db.notifications.forEach((n) => (n.read = true)));
}

export function updateSettings(patch: Partial<DB['settings']>) {
  setDB((db) => {
    Object.assign(db.settings, patch);
  });
}

export function completeOnboarding() {
  setDB((db) => {
    db.onboarded = true;
  });
}
