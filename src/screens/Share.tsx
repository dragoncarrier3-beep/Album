import { Copy, Eye, Link2, Mail, Share2, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createShareLink, inviteByEmail, linkActive, revokeInvitation, revokeShareLink, setInvitationRole, updateShareLink } from '../backend/api';
import type { Album, Role } from '../backend/types';
import { timeAgo, useDB } from '../lib/hooks';
import { Button, Field, Segmented, Sheet, Toggle, errMsg, useUI } from '../ui/kit';

export const shareUrl = (token: string) => `${location.origin}/s/${token}`;

export async function copyText(t: string) {
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch {
    return false;
  }
}

export function ShareSheet({ album, open, onClose }: { album: Album; open: boolean; onClose: () => void }) {
  const nav = useNavigate();
  const { toast, confirm } = useUI();
  const links = useDB((db) => db.shareLinks.filter((l) => l.albumId === album.id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const invites = useDB((db) => db.invitations.filter((i) => i.albumId === album.id));
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('viewer');
  const [expiry, setExpiry] = useState<'never' | '1' | '7' | '30'>('never');
  const [passcode, setPasscode] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const gated = album.privacy === 'nft';

  const run = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key);
    try {
      await fn();
      if (ok) toast(ok);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  const nativeShare = async (url: string) => {
    if (navigator.share) {
      try {
        await navigator.share({ title: album.title, text: `View “${album.title}” on LUMEN`, url });
      } catch { /* user dismissed */ }
    } else {
      (await copyText(url)) ? toast('Native sharing isn’t available here — link copied instead') : toast('Couldn’t copy link', 'error');
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Share album" tall>
      <section className="share-section">
        <h3><Mail size={16} /> Invite by email</h3>
        <div className="row gap-8 align-end">
          <Field label="Email address">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
          </Field>
        </div>
        <div className="row gap-8 mt-8">
          <Segmented label="Role" value={role} onChange={setRole} options={[{ value: 'viewer', label: 'Viewer' }, { value: 'contributor', label: 'Contributor' }]} />
          <Button size="sm" loading={busy === 'invite'} onClick={() => run('invite', async () => { await inviteByEmail(album.id, email, role); setEmail(''); }, 'Invitation sent')}>Invite</Button>
        </div>
        <p className="xsmall muted mt-6">Viewers can see photos. Contributors can also add photos.</p>
        {invites.length > 0 && (
          <ul className="people">
            {invites.map((i) => (
              <li key={i.id}>
                <span className="person-dot">{i.email[0].toUpperCase()}</span>
                <span className="grow min0">
                  <span className="ellipsis small strong">{i.email}</span>
                  <span className="xsmall muted">{i.status === 'pending' ? 'Invitation pending' : 'Has access'}</span>
                </span>
                <select aria-label={`Role for ${i.email}`} value={i.role} onChange={(e) => setInvitationRole(i.id, e.target.value as Role)}>
                  <option value="viewer">Viewer</option>
                  <option value="contributor">Contributor</option>
                </select>
                <button className="icon-btn" aria-label={`Remove ${i.email}`} onClick={async () => {
                  if (await confirm({ title: 'Remove access?', body: `${i.email} will no longer be able to open this album.`, confirmLabel: 'Remove', danger: true }))
                    run('rm' + i.id, () => revokeInvitation(i.id), 'Access removed');
                }}><Trash2 size={16} /></button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="share-section">
        <h3><Link2 size={16} /> Private sharing link</h3>
        {gated ? (
          <p className="small muted">This album uses NFT Owner Access, so it can’t be opened with a link — only a wallet that owns the linked collectible can unlock it.</p>
        ) : (
          <>
            <div className="link-opts">
              <Field label="Expires">
                <select value={expiry} onChange={(e) => setExpiry(e.target.value as typeof expiry)}>
                  <option value="never">Never</option>
                  <option value="1">In 24 hours</option>
                  <option value="7">In 7 days</option>
                  <option value="30">In 30 days</option>
                </select>
              </Field>
              <Field label="Passcode" hint="Optional">
                <input value={passcode} onChange={(e) => setPasscode(e.target.value)} placeholder="e.g. italy24" />
              </Field>
            </div>
            <Button block variant="soft" loading={busy === 'create'} icon={<Link2 size={16} />}
              onClick={() => run('create', async () => {
                const l = await createShareLink(album.id, {
                  expiresAt: expiry === 'never' ? undefined : new Date(Date.now() + +expiry * 86400000).toISOString(),
                  passcode: passcode.trim() || undefined,
                });
                setPasscode('');
                await copyText(shareUrl(l.token));
              }, 'View-only link created and copied')}>
              Create view-only link
            </Button>
            {links.length > 0 && (
              <ul className="links">
                {links.map((l) => {
                  const active = linkActive(l);
                  const expired = l.expiresAt && new Date(l.expiresAt).getTime() <= Date.now();
                  return (
                    <li key={l.id} className={active ? '' : 'inactive'}>
                      <div className="row between">
                        <code className="ellipsis">{shareUrl(l.token).replace(/^https?:\/\//, '')}</code>
                        {!l.revokedAt && <Toggle label="Link enabled" checked={l.enabled} onChange={(v) => run('t' + l.id, () => updateShareLink(l.id, { enabled: v }), v ? 'Link enabled' : 'Link turned off')} />}
                      </div>
                      <div className="xsmall muted mt-4">
                        {l.revokedAt ? `Revoked ${timeAgo(l.revokedAt)}` : expired ? 'Expired' : l.enabled ? 'Active' : 'Turned off'} · View only · {l.views} views
                        {l.expiresAt && !expired && ` · Expires ${new Date(l.expiresAt).toLocaleDateString()}`}
                        {l.passcode && ' · Passcode protected'}
                      </div>
                      <div className="row gap-6 mt-8 wrap">
                        {!l.revokedAt && (
                          <>
                            <Button size="sm" variant="secondary" icon={<Copy size={14} />} onClick={async () => ((await copyText(shareUrl(l.token))) ? toast('Link copied') : toast('Couldn’t copy', 'error'))}>Copy</Button>
                            <Button size="sm" variant="secondary" icon={<Share2 size={14} />} onClick={() => nativeShare(shareUrl(l.token))}>Share</Button>
                          </>
                        )}
                        <Button size="sm" variant="secondary" icon={<Eye size={14} />} onClick={() => { onClose(); nav(`/s/${l.token}`); }}>
                          {l.revokedAt ? 'Test link' : 'Preview as recipient'}
                        </Button>
                        {!l.revokedAt && (
                          <Button size="sm" variant="ghost" className="danger-text" loading={busy === 'r' + l.id} onClick={async () => {
                            if (await confirm({ title: 'Revoke this link?', body: 'Anyone using it will immediately lose access. This can’t be undone.', confirmLabel: 'Revoke link', danger: true }))
                              run('r' + l.id, () => revokeShareLink(l.id), 'Link revoked');
                          }}>Revoke</Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </section>

      <button className="list-btn" onClick={() => { onClose(); nav('/privacy'); }}>
        <span><ShieldCheck size={16} /> Manage access in Privacy Center</span>
      </button>
    </Sheet>
  );
}
