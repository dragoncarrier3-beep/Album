import { motion } from 'framer-motion';
import { ArrowUpDown, Eye, Gem, ImagePlus, Lock, MoreHorizontal, Pencil, Share2, ShieldCheck, Trash2, Unlink } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError, deleteAlbum, linkNft, myCollectibles, relockAlbum, unlinkNft, updateAlbum, viewAlbum, type AlbumView } from '../backend/api';
import type { Privacy } from '../backend/types';
import { timeAgo, useDB } from '../lib/hooks';
import { Masonry, useCover } from '../ui/albums';
import { Avatar, Button, Empty, IconButton, NftBadge, PhotoImg, PrivacyBadge, Sheet, TopBar, errMsg, useUI } from '../ui/kit';
import { PRIVACY, PRIVACY_ORDER } from '../ui/meta';
import { LockedAlbum, UnlockSheet } from './Gate';
import { ShareSheet } from './Share';

export function AlbumDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const db = useDB((d) => d);
  const [asVisitor, setAsVisitor] = useState(false);
  const [sheet, setSheet] = useState<null | 'share' | 'more' | 'privacy' | 'link' | 'unlock'>(null);

  let view: AlbumView | null = null;
  let error: ApiError | null = null;
  try {
    view = viewAlbum(id, { asVisitor });
  } catch (e) {
    error = e as ApiError;
  }
  // db in deps ensures re-render on change
  void db;

  if (error || !view)
    return (
      <div className="screen">
        <TopBar />
        <div className="pad">
          <Empty icon={<Lock size={26} />} title={error?.code === 'not_found' ? 'Album not found' : 'This album is private'} body={error?.message} action={<Button onClick={() => nav('/')}>Go home</Button>} />
        </div>
      </div>
    );

  const { album, owner, photos, locked, nft, access } = view;
  const isOwner = access === 'owner';

  if (locked)
    return (
      <div className="screen">
        <TopBar right={asVisitor ? <Button size="sm" variant="secondary" onClick={() => setAsVisitor(false)}>Exit preview</Button> : undefined} />
        <div className="pad">
          <LockedAlbum album={album} nft={nft} ownerName={owner.name} onUnlock={() => setSheet('unlock')} preview={asVisitor} />
        </div>
        <UnlockSheet album={album} nft={nft} open={sheet === 'unlock'} onClose={() => setSheet(null)} />
      </div>
    );

  return (
    <div className={`screen album-theme-${album.theme} album-screen`}>
      <Hero view={view} onBack={() => nav(-1)} />
      <div className="album-body">
        {access === 'nft-grant' && (
          <div className="grant-bar">
            <Gem size={15} /> Unlocked with {nft?.name} · Demo Verification
            <button onClick={() => relockAlbum(album.id)}>Lock again</button>
          </div>
        )}
        {asVisitor && (
          <div className="grant-bar">
            <Eye size={15} /> Previewing as a visitor
            <button onClick={() => setAsVisitor(false)}>Exit</button>
          </div>
        )}
        {isOwner && !asVisitor && (
          <div className="album-actions" role="toolbar" aria-label="Album actions">
            <ActionBtn icon={<ImagePlus size={20} />} label="Add Photos" onClick={() => nav(`/album/${album.id}/upload`)} />
            <ActionBtn icon={<Share2 size={20} />} label="Share" onClick={() => setSheet('share')} />
            <ActionBtn icon={<Pencil size={20} />} label="Edit Album" onClick={() => nav(`/album/${album.id}/edit`)} />
            <ActionBtn icon={<MoreHorizontal size={20} />} label="More" onClick={() => setSheet('more')} />
          </div>
        )}

        {isOwner && !asVisitor && (
          <button className="privacy-strip" onClick={() => setSheet('privacy')}>
            <PrivacyBadge privacy={album.privacy} />
            <span className="grow small">{PRIVACY[album.privacy].who}</span>
            <span className="link-sm">Change</span>
          </button>
        )}

        {album.nftId && nft && (
          <div className="nft-strip">
            <img src={nft.image} alt="" />
            <div className="grow min0">
              <NftBadge />
              <strong className="ellipsis">{nft.name}</strong>
              <small>{nft.collection} · {nft.simulated ? 'Demo collectible' : nft.network}</small>
            </div>
            {isOwner && !asVisitor && (
              <IconButton label="Unlink collectible" onClick={() => setSheet('link')}><Unlink size={18} /></IconButton>
            )}
          </div>
        )}
        {isOwner && !asVisitor && !album.nftId && (
          <button className="link-collectible" onClick={() => setSheet('link')}>
            <Gem size={18} /> <span className="grow">Link Collectible</span> <small>Optional</small>
          </button>
        )}

        {photos.length === 0 ? (
          <Empty icon={<ImagePlus size={28} />} title="No photos yet" body="Add photos from your library or camera. They stay private until you share." action={isOwner ? <Button onClick={() => nav(`/album/${album.id}/upload`)}>Add Photos</Button> : undefined} />
        ) : (
          <Masonry photos={photos} favorites={new Set(db.favorites.filter((f) => f.userId === db.sessionUserId).map((f) => f.photoId))} onOpen={(p) => nav(`/album/${album.id}/photo/${p.id}`)} cols={album.theme === 'gallery' ? 1 : 2} />
        )}
      </div>

      {isOwner && (
        <>
          <ShareSheet album={album} open={sheet === 'share'} onClose={() => setSheet(null)} />
          <MoreSheet albumId={album.id} open={sheet === 'more'} onClose={() => setSheet(null)} onPreview={() => { setSheet(null); setAsVisitor(true); }} onLink={() => setSheet('link')} onPrivacy={() => setSheet('privacy')} />
          <PrivacySheet albumId={album.id} open={sheet === 'privacy'} onClose={() => setSheet(null)} onNeedLink={() => setSheet('link')} />
          <LinkSheet albumId={album.id} open={sheet === 'link'} onClose={() => setSheet(null)} />
        </>
      )}
    </div>
  );
}

function ActionBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <motion.button className="action" whileTap={{ scale: 0.94 }} onClick={onClick}>
      <span className="action-icon">{icon}</span>
      <span>{label}</span>
    </motion.button>
  );
}

function Hero({ view, onBack }: { view: AlbumView; onBack: () => void }) {
  const { album, owner } = view;
  const cover = useCover(album);
  return (
    <div className="hero">
      <motion.div layoutId={`cover-${album.id}`} className="hero-img">
        <PhotoImg photo={cover} variant="full" eager alt={`${album.title} cover`} />
      </motion.div>
      <div className="hero-shade" />
      <div className="hero-top">
        <TopBar transparent onBack={onBack} />
      </div>
      <div className="hero-meta">
        <div className="row gap-6 wrap">
          <PrivacyBadge privacy={album.privacy} solid />
          {album.nftId && <NftBadge solid />}
        </div>
        <h1 className="hero-title">{album.title}</h1>
        {album.description && <p className="hero-desc">{album.description}</p>}
        <div className="hero-by">
          <Avatar user={owner} size={26} />
          <span>{owner.name}</span>
          <span className="dot-sep">·</span>
          <span>{album.photoIds.length} photos</span>
          <span className="dot-sep">·</span>
          <span>{timeAgo(album.updatedAt)}</span>
        </div>
      </div>
    </div>
  );
}

function MoreSheet({ albumId, open, onClose, onPreview, onLink, onPrivacy }: { albumId: string; open: boolean; onClose: () => void; onPreview: () => void; onLink: () => void; onPrivacy: () => void }) {
  const nav = useNavigate();
  const { confirm, toast } = useUI();
  const album = useDB((db) => db.albums.find((a) => a.id === albumId));
  if (!album) return null;
  return (
    <Sheet open={open} onClose={onClose} title="Album options">
      <div className="menu">
        <button onClick={() => { onClose(); nav(`/album/${albumId}/organize`); }}><ArrowUpDown size={18} /> Reorder photos & change cover</button>
        <button onClick={onPrivacy}><ShieldCheck size={18} /> Privacy setting</button>
        <button onClick={onLink}><Gem size={18} /> {album.nftId ? 'Unlink collectible' : 'Link collectible'}</button>
        <button onClick={onPreview}><Eye size={18} /> Preview as visitor</button>
        <button className="danger-text" onClick={async () => {
          onClose();
          if (await confirm({ title: `Delete “${album.title}”?`, body: `This permanently deletes the album and its ${album.photoIds.length} photos, and revokes all sharing links.`, confirmLabel: 'Delete album', danger: true })) {
            try {
              await deleteAlbum(albumId);
              toast('Album deleted');
              nav('/albums', { replace: true });
            } catch (e) {
              toast(errMsg(e), 'error');
            }
          }
        }}><Trash2 size={18} /> Delete album</button>
      </div>
    </Sheet>
  );
}

function PrivacySheet({ albumId, open, onClose, onNeedLink }: { albumId: string; open: boolean; onClose: () => void; onNeedLink: () => void }) {
  const album = useDB((db) => db.albums.find((a) => a.id === albumId));
  const { toast } = useUI();
  const [busy, setBusy] = useState<Privacy | null>(null);
  if (!album) return null;
  const pick = async (p: Privacy) => {
    if (p === 'nft' && !album.nftId) {
      toast('Link a collectible first, then choose NFT Owner Access', 'info');
      onNeedLink();
      return;
    }
    setBusy(p);
    try {
      await updateAlbum(albumId, { privacy: p });
      toast(`Now ${PRIVACY[p].label}`);
      onClose();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(null);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Who can see this album?">
      <div className="privacy-list">
        {PRIVACY_ORDER.map((p) => {
          const M = PRIVACY[p];
          const I = M.icon;
          return (
            <button key={p} className={`privacy-opt ${album.privacy === p ? 'on' : ''}`} onClick={() => pick(p)} aria-pressed={album.privacy === p} disabled={!!busy}>
              <span className={`privacy-icon tone-${M.tone}`}><I size={18} /></span>
              <span className="grow"><strong>{M.label}</strong><small>{M.who}</small></span>
            </button>
          );
        })}
      </div>
      <p className="xsmall muted mt-12">Linking a collectible never makes photos public on its own. Changing away from NFT Owner Access immediately ends all unlocked sessions.</p>
    </Sheet>
  );
}

export function LinkSheet({ albumId, open, onClose }: { albumId: string; open: boolean; onClose: () => void }) {
  const db = useDB((d) => d);
  const album = db.albums.find((a) => a.id === albumId);
  const nfts = useMemo(() => myCollectibles(db), [db]);
  const [sel, setSel] = useState<string>();
  const [busy, setBusy] = useState(false);
  const { toast, confirm } = useUI();
  const nav = useNavigate();
  if (!album) return null;
  const linked = db.nfts.find((n) => n.id === album.nftId);
  const usedBy = (nid: string) => db.albums.find((a) => a.nftId === nid && a.id !== albumId && a.ownerId === db.sessionUserId);

  return (
    <Sheet open={open} onClose={onClose} title={linked ? 'Linked collectible' : 'Link Collectible'}>
      {linked ? (
        <div className="stack gap-12">
          <div className="gate-req">
            <img src={linked.image} alt="" />
            <div><strong>{linked.name}</strong><small>{linked.collection} · Token #{linked.tokenId}</small></div>
          </div>
          <p className="small muted">Unlinking removes the badge{album.privacy === 'nft' ? ' and switches the album back to Private' : ''}. The NFT itself is not affected.</p>
          <Button variant="danger" block loading={busy} onClick={async () => {
            if (!(await confirm({ title: 'Unlink collectible?', body: `${linked.name} will no longer be associated with “${album.title}”.`, confirmLabel: 'Unlink', danger: true }))) return;
            setBusy(true);
            try { await unlinkNft(albumId); toast('Collectible unlinked'); onClose(); } catch (e) { toast(errMsg(e), 'error'); } finally { setBusy(false); }
          }}>Unlink</Button>
        </div>
      ) : nfts.length === 0 ? (
        <Empty icon={<Gem size={26} />} title="No collectibles yet" body="Connect a wallet (or the Demo Wallet) to see collectibles you own." action={<Button onClick={() => { onClose(); nav('/wallet'); }}>Connect wallet</Button>} />
      ) : (
        <div className="stack gap-12">
          <div className="nft-choose">
            {nfts.map((n) => (
              <button key={n.id} className={`nft-choose-opt ${sel === n.id ? 'on' : ''}`} onClick={() => setSel(n.id)} aria-pressed={sel === n.id}>
                <img src={n.image} alt="" />
                <span className="grow min0">
                  <strong>{n.name}</strong>
                  <small>{n.collection}{usedBy(n.id) ? ` · also on ${usedBy(n.id)!.title}` : ''}</small>
                </span>
              </button>
            ))}
          </div>
          <p className="xsmall muted">Associating an album doesn’t transfer, mint or alter the NFT, and doesn’t make your photos public. No blockchain transaction is needed.</p>
          <Button block disabled={!sel} loading={busy} onClick={async () => {
            setBusy(true);
            try { await linkNft(albumId, sel!); toast('Collectible Linked ✦'); onClose(); setSel(undefined); } catch (e) { toast(errMsg(e), 'error'); } finally { setBusy(false); }
          }}>Confirm link</Button>
        </div>
      )}
    </Sheet>
  );
}
