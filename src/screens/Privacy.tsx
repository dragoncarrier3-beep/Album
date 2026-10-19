import { Download, Link2, Mail, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { deleteAccount, deleteAlbum, exportMyData, linkActive, revokeInvitation, revokeShareLink } from '../backend/api';
import { saveBlob, timeAgo, useDB } from '../lib/hooks';
import { Button, Empty, PrivacyBadge, TopBar, errMsg, useUI } from '../ui/kit';
import { PRIVACY, PRIVACY_ORDER } from '../ui/meta';
import { shareUrl } from './Share';

export function PrivacyCenter() {
  const db = useDB((d) => d);
  const nav = useNavigate();
  const { toast, confirm } = useUI();
  const [exporting, setExporting] = useState(false);
  const mine = db.albums.filter((a) => a.ownerId === db.sessionUserId);
  const ids = new Set(mine.map((a) => a.id));
  const links = db.shareLinks.filter((l) => ids.has(l.albumId) && linkActive(l));
  const pending = db.invitations.filter((i) => ids.has(i.albumId));
  const title = (id: string) => mine.find((a) => a.id === id)?.title ?? '';

  return (
    <div className="screen">
      <TopBar />
      <div className="pad">
        <h1 className="display">Privacy Center</h1>
        <p className="lede">Know exactly who can see each album — and change it anytime.</p>

        <section className="mt-24">
          <h2 className="label">Album visibility</h2>
          <div className="vis-summary">
            {PRIVACY_ORDER.map((p) => {
              const M = PRIVACY[p];
              const I = M.icon;
              const count = mine.filter((a) => a.privacy === p).length;
              return (
                <div key={p} className="vis-row">
                  <span className={`privacy-icon tone-${M.tone}`}><I size={17} /></span>
                  <span className="grow"><strong>{M.label}</strong><small>{M.who}</small></span>
                  <span className="vis-count">{count}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-24">
          <h2 className="label">Access by album</h2>
          <div className="card-list">
            {mine.map((a) => {
              const l = db.shareLinks.filter((x) => x.albumId === a.id && linkActive(x)).length;
              const inv = db.invitations.filter((x) => x.albumId === a.id).length;
              return (
                <Link key={a.id} to={`/album/${a.id}`} className="set-row">
                  <span className="grow">
                    <span className="row-label">{a.title}</span>
                    <small>{[l && `${l} active link${l > 1 ? 's' : ''}`, inv && `${inv} invited`, a.nftId && 'collectible linked'].filter(Boolean).join(' · ') || 'No one else has access'}</small>
                  </span>
                  <PrivacyBadge privacy={a.privacy} />
                </Link>
              );
            })}
          </div>
        </section>

        <section className="mt-24">
          <h2 className="label">Active sharing links</h2>
          {links.length === 0 ? <p className="small muted">No active links.</p> : (
            <div className="card-list">
              {links.map((l) => (
                <div key={l.id} className="set-row">
                  <Link2 size={17} className="muted" />
                  <span className="grow min0">
                    <span className="row-label">{title(l.albumId)}</span>
                    <small className="ellipsis">{shareUrl(l.token).replace(/^https?:\/\//, '')} · {l.views} views · created {timeAgo(l.createdAt)}</small>
                  </span>
                  <Button size="sm" variant="ghost" className="danger-text" onClick={async () => {
                    if (await confirm({ title: 'Revoke link?', body: 'Anyone using this link will lose access immediately.', confirmLabel: 'Revoke', danger: true })) {
                      try { await revokeShareLink(l.id); toast('Link revoked'); } catch (e) { toast(errMsg(e), 'error'); }
                    }
                  }}>Revoke</Button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-24">
          <h2 className="label">Invitations & people</h2>
          {pending.length === 0 ? <p className="small muted">No invitations.</p> : (
            <div className="card-list">
              {pending.map((i) => (
                <div key={i.id} className="set-row">
                  <Mail size={17} className="muted" />
                  <span className="grow min0">
                    <span className="row-label ellipsis">{i.email}</span>
                    <small>{title(i.albumId)} · {i.role} · {i.status === 'pending' ? 'pending' : 'has access'}</small>
                  </span>
                  <Button size="sm" variant="ghost" className="danger-text" onClick={async () => {
                    if (await confirm({ title: 'Revoke access?', body: `${i.email} will no longer be able to open “${title(i.albumId)}”.`, confirmLabel: 'Revoke', danger: true })) {
                      try { await revokeInvitation(i.id); toast('Access revoked'); } catch (e) { toast(errMsg(e), 'error'); }
                    }
                  }}>Revoke</Button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-24">
          <h2 className="label">Your data</h2>
          <div className="stack gap-10">
            <Button variant="secondary" icon={<Download size={17} />} loading={exporting} onClick={async () => {
              setExporting(true);
              try { saveBlob(await exportMyData(), 'lumen-my-photos.zip'); toast('Export ready — check your downloads'); } catch (e) { toast(errMsg(e), 'error'); } finally { setExporting(false); }
            }}>Download my photos (.zip)</Button>
            <DeleteAlbumPicker />
            <Button variant="ghost" className="danger-text" icon={<Trash2 size={17} />} onClick={async () => {
              if (!(await confirm({ title: 'Delete your account?', body: 'Everything you’ve uploaded and every sharing link will be permanently deleted.', confirmLabel: 'Delete account', danger: true }))) return;
              await deleteAccount();
              nav('/welcome', { replace: true });
            }}>Delete account</Button>
          </div>
        </section>
        <p className="xsmall muted mt-24">Photos are kept in private storage. Linking a collectible never makes an album public, and NFT metadata never contains your photo URLs.</p>
      </div>
    </div>
  );
}

function DeleteAlbumPicker() {
  const albums = useDB((db) => db.albums.filter((a) => a.ownerId === db.sessionUserId));
  const [sel, setSel] = useState('');
  const { confirm, toast } = useUI();
  if (!albums.length) return <Empty icon={<Trash2 />} title="No albums" />;
  return (
    <div className="row gap-8">
      <select value={sel} onChange={(e) => setSel(e.target.value)} aria-label="Album to delete" className="grow">
        <option value="">Delete an album…</option>
        {albums.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
      </select>
      <Button variant="danger" size="sm" disabled={!sel} onClick={async () => {
        const a = albums.find((x) => x.id === sel)!;
        if (await confirm({ title: `Delete “${a.title}”?`, body: `${a.photoIds.length} photos and all links will be permanently deleted.`, confirmLabel: 'Delete', danger: true })) {
          try { await deleteAlbum(sel); setSel(''); toast('Album deleted'); } catch (e) { toast(errMsg(e), 'error'); }
        }
      }}>Delete</Button>
    </div>
  );
}
