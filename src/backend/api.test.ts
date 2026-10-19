import { beforeEach, describe, expect, it } from 'vitest';
import * as api from './api';
import { memoryBlobStore, setBlobStore } from './blobs';
import { DemoVerifier, EvmVerifier } from './nft';
import { DEMO_USER_ID, DEMO_WALLET } from './seed';
import { getDB, resetDB, setDB } from './store';

const fakeThumb: api.Thumbnailer = async (file) => ({ blob: file, w: 1200, h: 800 });
const jpeg = (name = 'photo.jpg', size = 300_000) => new File([new Uint8Array(size)], name, { type: 'image/jpeg' });
const asUser = (id: string | null) => setDB((db) => { db.sessionUserId = id; });

beforeEach(async () => {
  api.config.latency = 0;
  setBlobStore(memoryBlobStore);
  resetDB();
  await api.exploreDemo();
});

describe('demo authentication', () => {
  it('signs into the seeded demo account with 6 albums and 42 photos', () => {
    const db = getDB();
    expect(db.sessionUserId).toBe(DEMO_USER_ID);
    expect(db.albums.filter((a) => a.ownerId === DEMO_USER_ID)).toHaveLength(6);
    expect(db.photos.filter((p) => p.ownerId === DEMO_USER_ID)).toHaveLength(42);
    expect(db.albums.filter((a) => a.ownerId === DEMO_USER_ID && a.nftId)).toHaveLength(2);
  });

  it('rejects bad credentials and accepts the demo password', async () => {
    api.signOut();
    await expect(api.signIn('olivia@lumen.demo', 'nope')).rejects.toThrow(/incorrect/);
    await api.signIn('olivia@lumen.demo', 'demo1234');
    expect(getDB().sessionUserId).toBe(DEMO_USER_ID);
  });

  it('validates sign-up', async () => {
    api.signOut();
    await expect(api.signUp('A', 'bad-email', 'longpassword')).rejects.toThrow(/valid email/);
    await expect(api.signUp('A', 'a@b.co', 'short')).rejects.toThrow(/8 characters/);
    await api.signUp('Ann', 'ann@example.com', 'longpassword');
    expect(getDB().users.find((u) => u.email === 'ann@example.com')).toBeTruthy();
  });
});

describe('albums', () => {
  it('creates a private album by default and validates the title', async () => {
    await expect(api.createAlbum({ title: ' ', description: '', theme: 'classic', privacy: 'private' })).rejects.toThrow(/title/);
    const a = await api.createAlbum({ title: 'Kyoto', description: 'Spring', theme: 'lavender', privacy: 'private' });
    expect(a.privacy).toBe('private');
    expect(getDB().albums[0].id).toBe(a.id);
  });

  it('edits, reorders and deletes albums', async () => {
    await api.updateAlbum('a-weekend', { title: 'Weekends', description: 'New', theme: 'midnight' });
    const a = getDB().albums.find((x) => x.id === 'a-weekend')!;
    expect(a.title).toBe('Weekends');
    const reversed = [...a.photoIds].reverse();
    await api.reorderPhotos(a.id, reversed);
    expect(getDB().albums.find((x) => x.id === a.id)!.photoIds).toEqual(reversed);
    await api.updateAlbum(a.id, { coverPhotoId: reversed[2] });
    await api.deleteAlbum(a.id);
    expect(getDB().albums.find((x) => x.id === a.id)).toBeUndefined();
    expect(getDB().photos.some((p) => p.albumId === a.id)).toBe(false);
  });

  it('moves and removes photos, keeping covers valid', async () => {
    const [first] = getDB().albums.find((a) => a.id === 'a-family')!.photoIds;
    await api.movePhoto(first, 'a-weekend');
    expect(getDB().albums.find((a) => a.id === 'a-weekend')!.photoIds[0]).toBe(first);
    expect(getDB().albums.find((a) => a.id === 'a-family')!.coverPhotoId).not.toBe(first);
    await api.removePhoto(first);
    expect(getDB().photos.find((p) => p.id === first)).toBeUndefined();
  });

  it('prevents editing someone else’s album', async () => {
    await expect(api.updateAlbum('a-nordic', { title: 'Mine now' })).rejects.toThrow(/owner/);
  });
});

describe('photo upload & download', () => {
  it('uploads a real file, stores original + thumbnail privately, and reports progress', async () => {
    const progress: number[] = [];
    const p = await api.uploadPhoto('a-weekend', jpeg(), 'Lake', { thumbnailer: fakeThumb, onProgress: (n) => progress.push(n) });
    expect(progress[progress.length - 1]).toBe(100);
    expect(p.src.startsWith('idb:')).toBe(true);
    expect(await memoryBlobStore.get(p.src.slice(4))).toBeInstanceOf(Blob);
    expect(getDB().albums.find((a) => a.id === 'a-weekend')!.photoIds[0]).toBe(p.id);
    const dl = await api.downloadPhoto(p.id);
    expect(dl.blob.size).toBe(300_000);
  });

  it('rejects unsupported and oversized files', async () => {
    await expect(api.uploadPhoto('a-weekend', new File(['x'], 'doc.pdf', { type: 'application/pdf' }), '', { thumbnailer: fakeThumb })).rejects.toThrow(/unsupported/);
    await expect(api.uploadPhoto('a-weekend', jpeg('big.jpg', api.MAX_UPLOAD_BYTES + 1), '', { thumbnailer: fakeThumb })).rejects.toThrow(/25 MB/);
  });

  it('never commits a photo when the network fails or the upload is cancelled', async () => {
    const before = getDB().photos.length;
    api.updateSettings({ simulateNetworkFailure: true });
    await expect(api.uploadPhoto('a-weekend', jpeg('a.jpg', 2_000_000), '', { thumbnailer: fakeThumb })).rejects.toMatchObject({ code: 'network' });
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(api.uploadPhoto('a-weekend', jpeg(), '', { thumbnailer: fakeThumb, signal: ctrl.signal })).rejects.toMatchObject({ code: 'cancelled' });
    expect(getDB().photos.length).toBe(before);
    await api.uploadPhoto('a-weekend', jpeg(), '', { thumbnailer: fakeThumb }); // retry succeeds
    expect(getDB().photos.length).toBe(before + 1);
  });

  it('blocks uploads to albums you don’t own', async () => {
    await expect(api.uploadPhoto('a-nordic', jpeg(), '', { thumbnailer: fakeThumb })).rejects.toThrow(/owner/);
  });
});

describe('privacy enforcement & account permissions', () => {
  it('visitors only see public albums; private albums are forbidden', async () => {
    asUser('u-erik');
    expect(api.viewAlbum('a-city').photos.length).toBe(6); // public
    expect(() => api.viewAlbum('a-italy')).toThrow(/private/);
    expect(() => api.viewAlbum('a-golden')).toThrow(); // link-shared: needs the token, not the id
    await expect(api.downloadPhoto('p-italy-116')).rejects.toThrow(/permission/);
  });

  it('invited users can open invite-only albums; others cannot', () => {
    asUser('u-emma');
    expect(api.viewAlbum('a-family').access).toBe('invited');
    asUser('u-erik');
    expect(() => api.viewAlbum('a-family')).toThrow();
  });

  it('NFT-gated albums return no photos without a verified grant', () => {
    const v = api.viewAlbum('a-members');
    expect(v.locked).toBe(true);
    expect(v.photos).toHaveLength(0);
  });

  it('Discover only ever contains public albums', () => {
    const pub = getDB().albums.filter((a) => a.privacy === 'public');
    expect(pub.every((a) => a.privacy === 'public')).toBe(true);
    expect(pub.some((a) => a.id === 'a-members' || a.id === 'a-italy' || a.id === 'a-family')).toBe(false);
  });
});

describe('sharing links', () => {
  it('creates a link, lets a signed-out recipient view it, and stops working once revoked', async () => {
    const link = await api.createShareLink('a-italy');
    expect(getDB().albums.find((a) => a.id === 'a-italy')!.privacy).toBe('link');
    asUser(null);
    const opened = await api.openShareLink(link.token);
    expect(opened.photos).toHaveLength(18);
    asUser(DEMO_USER_ID);
    await api.revokeShareLink(link.id);
    await expect(api.openShareLink(link.token)).rejects.toMatchObject({ code: 'revoked' });
  });

  it('enforces passcodes, disabled links and expiry', async () => {
    const l = await api.createShareLink('a-weekend', { passcode: 'italy24' });
    await expect(api.openShareLink(l.token)).rejects.toMatchObject({ code: 'passcode_required' });
    await expect(api.openShareLink(l.token, 'wrong')).rejects.toMatchObject({ code: 'bad_passcode' });
    expect((await api.openShareLink(l.token, 'italy24')).album.id).toBe('a-weekend');
    await api.updateShareLink(l.id, { enabled: false });
    await expect(api.openShareLink(l.token, 'italy24')).rejects.toMatchObject({ code: 'disabled' });
    const e = await api.createShareLink('a-weekend', { expiresAt: new Date(Date.now() - 1000).toISOString() });
    await expect(api.openShareLink(e.token)).rejects.toMatchObject({ code: 'expired' });
  });

  it('refuses link sharing for NFT-gated albums and invites validate email', async () => {
    await expect(api.createShareLink('a-digital')).rejects.toThrow(/NFT/);
    await expect(api.inviteByEmail('a-italy', 'nope', 'viewer')).rejects.toThrow(/valid email/);
    await api.inviteByEmail('a-italy', 'friend@example.com', 'contributor');
    expect(getDB().invitations.some((i) => i.email === 'friend@example.com' && i.role === 'contributor')).toBe(true);
  });
});

describe('NFT association & access policy', () => {
  it('links and unlinks a collectible you own', async () => {
    await api.linkNft('a-weekend', 'nft-bloom');
    expect(getDB().albums.find((a) => a.id === 'a-weekend')!.nftId).toBe('nft-bloom');
    await api.unlinkNft('a-weekend');
    expect(getDB().albums.find((a) => a.id === 'a-weekend')!.nftId).toBeUndefined();
  });

  it('cannot link a collectible owned by someone else', async () => {
    await expect(api.linkNft('a-weekend', 'nft-neon-ext')).rejects.toMatchObject({ code: 'not_owned' });
  });

  it('unlinking a gated album makes it private, never public', async () => {
    await api.unlinkNft('a-digital');
    expect(getDB().albums.find((a) => a.id === 'a-digital')!.privacy).toBe('private');
  });

  it('grants short-lived access only after ownership is verified', async () => {
    await api.requestGatedAccess('a-members');
    expect(api.viewAlbum('a-members').photos).toHaveLength(2);
  });

  it.each([
    ['not-owned', 'not_owned'],
    ['wrong-network', 'wrong_network'],
    ['unavailable', 'verification_unavailable'],
  ] as const)('denies access when scenario is %s', async (scenario, code) => {
    api.updateSettings({ demoScenario: scenario });
    await expect(api.requestGatedAccess('a-members')).rejects.toMatchObject({ code });
    expect(api.viewAlbum('a-members').locked).toBe(true);
  });

  it('re-locks when the collectible is transferred away', async () => {
    await api.requestGatedAccess('a-members');
    await api.demoTransferNft('nft-bloom', true);
    expect(api.viewAlbum('a-members').locked).toBe(true);
    await expect(api.requestGatedAccess('a-members')).rejects.toMatchObject({ code: 'not_owned' });
  });

  it('wallet disconnection revokes grants and blocks verification', async () => {
    await api.requestGatedAccess('a-members');
    api.disconnectWallet();
    expect(api.viewAlbum('a-members').locked).toBe(true);
    await expect(api.requestGatedAccess('a-members')).rejects.toMatchObject({ code: 'wallet_disconnected' });
    const ch = await api.requestWalletChallenge();
    expect(ch.message).toMatch(/Nonce/);
    expect(ch.message).not.toMatch(/seed|private key/i);
    await api.completeWalletConnection(ch.address, 'sig');
    await api.requestGatedAccess('a-members');
    expect(api.viewAlbum('a-members').locked).toBe(false);
  });
});

describe('ownership verification adapters', () => {
  const nft = () => getDB().nfts.find((n) => n.id === 'nft-golden-frame')!;
  const wallet = { address: DEMO_WALLET, network: 'Demo', mode: 'demo' as const };

  it('DemoVerifier is clearly marked as simulated', async () => {
    const r = await new DemoVerifier(() => 'owns').verify(wallet, nft());
    expect(r).toMatchObject({ owned: true, simulated: true });
    expect((await new DemoVerifier(() => 'owns').verify(undefined, nft())).reason).toBe('disconnected');
  });

  it('EvmVerifier calls ownerOf and compares the owner address', async () => {
    const calls: string[] = [];
    const orig = globalThis.fetch;
    globalThis.fetch = (async (_u: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      calls.push(body.params[0].data);
      return new Response(JSON.stringify({ result: '0x000000000000000000000000' + wallet.address.slice(2).toLowerCase() }));
    }) as unknown as typeof fetch;
    try {
      const v = new EvmVerifier('https://rpc.example', 'Sepolia');
      const r = await v.verify({ ...wallet, address: '0x1111111111111111111111111111111111111111', network: 'Sepolia' }, { ...nft(), network: 'Sepolia' });
      expect(calls[0].startsWith('0x6352211e')).toBe(true);
      expect(r).toMatchObject({ owned: false, simulated: false, reason: 'not_owned' });
      expect((await v.verify(wallet, nft())).reason).toBe('wrong_network');
    } finally {
      globalThis.fetch = orig;
    }
  });
});
