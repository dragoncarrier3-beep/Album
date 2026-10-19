import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Download, Heart, Info, MoreHorizontal, Share2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { downloadPhoto, movePhoto, removePhoto, toggleFavorite, updateAlbum, updateCaption, viewAlbum } from '../backend/api';
import type { Photo } from '../backend/types';
import { saveBlob, useDB, usePhotoUrl, useReducedMotion } from '../lib/hooks';
import { Button, Field, IconButton, Sheet, errMsg, useUI } from '../ui/kit';
import { copyText } from './Share';

export function Viewer() {
  const { id = '', photoId = '' } = useParams();
  const nav = useNavigate();
  const { toast, confirm } = useUI();
  const db = useDB((d) => d);
  const reduced = useReducedMotion();
  const [controls, setControls] = useState(true);
  const [sheet, setSheet] = useState<null | 'info' | 'more' | 'caption' | 'move'>(null);
  const [dir, setDir] = useState(0);

  let photos: Photo[] = [];
  let isOwner = false;
  let albumTitle = '';
  let ownerName = '';
  try {
    const v = viewAlbum(id);
    photos = v.photos;
    isOwner = v.access === 'owner';
    albumTitle = v.album.title;
    ownerName = v.owner.name;
  } catch {
    /* handled below */
  }
  const idx = photos.findIndex((p) => p.id === photoId);
  const photo = photos[idx];
  const fav = db.favorites.some((f) => f.userId === db.sessionUserId && f.photoId === photoId);

  const go = (d: number) => {
    const n = photos[idx + d];
    if (!n) return;
    setDir(d);
    nav(`/album/${id}/photo/${n.id}`, { replace: true });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (sheet) return;
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'Escape') nav(`/album/${id}`);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  if (!photo)
    return (
      <div className="viewer">
        <div className="viewer-empty">
          <p>This photo isn’t available.</p>
          <Button variant="glass" onClick={() => nav(`/album/${id}`)}>Back to album</Button>
        </div>
      </div>
    );

  const download = async () => {
    try {
      const { blob, filename } = await downloadPhoto(photo.id);
      saveBlob(blob, filename);
      toast('Original downloaded');
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  const share = async () => {
    const url = `${location.origin}/album/${id}/photo/${photo.id}`;
    try {
      const { blob, filename } = await downloadPhoto(photo.id);
      const file = new File([blob], filename, { type: blob.type });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: photo.caption || filename });
        return;
      }
    } catch { /* fall back */ }
    (await copyText(url)) ? toast('Link copied — only people with access to this album can open it') : toast('Sharing isn’t available here', 'error');
  };

  return (
    <div className="viewer" role="dialog" aria-label={`Photo ${idx + 1} of ${photos.length}`}>
      <AnimatePresence initial={false} custom={dir} mode="popLayout">
        <ZoomStage key={photo.id} photo={photo} dir={dir} reduced={reduced} onSwipe={go} onTap={() => setControls((c) => !c)} />
      </AnimatePresence>

      <AnimatePresence>
        {controls && (
          <>
            <motion.div className="viewer-top" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <IconButton label="Close" onClick={() => nav(`/album/${id}`)}><X size={22} /></IconButton>
              <span className="viewer-count">{idx + 1} / {photos.length}</span>
              <IconButton label={fav ? 'Remove from favorites' : 'Add to favorites'} aria-pressed={fav} onClick={() => { toggleFavorite(photo.id); toast(fav ? 'Removed from favorites' : 'Added to favorites'); }}>
                <motion.span key={String(fav)} initial={{ scale: 0.6 }} animate={{ scale: 1 }} style={{ display: 'flex' }}>
                  <Heart size={22} fill={fav ? '#FF6B8B' : 'none'} color={fav ? '#FF6B8B' : 'currentColor'} />
                </motion.span>
              </IconButton>
            </motion.div>
            {idx > 0 && <button className="viewer-nav left" aria-label="Previous photo" onClick={() => go(-1)}><ChevronLeft size={26} /></button>}
            {idx < photos.length - 1 && <button className="viewer-nav right" aria-label="Next photo" onClick={() => go(1)}><ChevronRight size={26} /></button>}
            <motion.div className="viewer-bottom" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
              {photo.caption && <p className="viewer-caption">{photo.caption}</p>}
              <div className="viewer-actions">
                <IconButton label="Photo details" onClick={() => setSheet('info')}><Info size={21} /></IconButton>
                <IconButton label="Download original" onClick={download}><Download size={21} /></IconButton>
                <IconButton label="Share photo" onClick={share}><Share2 size={21} /></IconButton>
                {isOwner && <IconButton label="More options" onClick={() => setSheet('more')}><MoreHorizontal size={21} /></IconButton>}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <Sheet open={sheet === 'info'} onClose={() => setSheet(null)} title="Details">
        <dl className="meta-list">
          <div><dt>Photo name</dt><dd>{photo.name}</dd></div>
          <div><dt>Uploaded</dt><dd>{new Date(photo.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</dd></div>
          <div><dt>Caption</dt><dd>{photo.caption || <span className="muted">No caption</span>}</dd></div>
          <div><dt>Album</dt><dd>{albumTitle}</dd></div>
          <div><dt>Owner</dt><dd>{ownerName}</dd></div>
          <div><dt>Dimensions</dt><dd>{photo.w} × {photo.h}</dd></div>
          {photo.credit && <div><dt>Photography</dt><dd>{photo.credit} (Unsplash licence)</dd></div>}
        </dl>
        <p className="xsmall muted mt-12">Location and camera EXIF data are hidden by default to protect your privacy.</p>
      </Sheet>

      <Sheet open={sheet === 'more'} onClose={() => setSheet(null)} title="Photo options">
        <div className="menu">
          <button onClick={() => setSheet('caption')}>{photo.caption ? 'Edit caption' : 'Add caption'}</button>
          <button onClick={async () => { try { await updateAlbum(id, { coverPhotoId: photo.id }); toast('Album cover updated'); setSheet(null); } catch (e) { toast(errMsg(e), 'error'); } }}>Set as album cover</button>
          <button onClick={() => setSheet('move')}>Move to another album</button>
          <button className="danger-text" onClick={async () => {
            setSheet(null);
            if (await confirm({ title: 'Remove this photo?', body: 'It will be permanently deleted from the album and your storage.', confirmLabel: 'Remove', danger: true })) {
              const next = photos[idx + 1] ?? photos[idx - 1];
              try {
                await removePhoto(photo.id);
                toast('Photo removed');
                nav(next ? `/album/${id}/photo/${next.id}` : `/album/${id}`, { replace: true });
              } catch (e) { toast(errMsg(e), 'error'); }
            }
          }}>Remove from album</button>
        </div>
      </Sheet>

      <CaptionSheet open={sheet === 'caption'} photo={photo} onClose={() => setSheet(null)} />

      <Sheet open={sheet === 'move'} onClose={() => setSheet(null)} title="Move to album">
        <div className="stack gap-6">
          {db.albums.filter((a) => a.ownerId === db.sessionUserId && a.id !== id).map((a) => (
            <button key={a.id} className="list-btn" onClick={async () => {
              const next = photos[idx + 1] ?? photos[idx - 1];
              try {
                await movePhoto(photo.id, a.id);
                toast(`Moved to ${a.title}`);
                setSheet(null);
                nav(next ? `/album/${id}/photo/${next.id}` : `/album/${id}`, { replace: true });
              } catch (e) { toast(errMsg(e), 'error'); }
            }}><span>{a.title}</span><small>{a.photoIds.length} photos</small></button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

function CaptionSheet({ open, photo, onClose }: { open: boolean; photo: Photo; onClose: () => void }) {
  const [text, setText] = useState(photo.caption);
  const [busy, setBusy] = useState(false);
  const { toast } = useUI();
  useEffect(() => setText(photo.caption), [photo.id, open]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Sheet open={open} onClose={onClose} title="Caption">
      <Field label="Caption" hint={`${text.length}/280`}>
        <textarea rows={3} maxLength={280} value={text} onChange={(e) => setText(e.target.value)} placeholder="Say something about this moment" />
      </Field>
      <Button block className="mt-12" loading={busy} onClick={async () => {
        setBusy(true);
        try { await updateCaption(photo.id, text); toast('Caption saved'); onClose(); } catch (e) { toast(errMsg(e), 'error'); } finally { setBusy(false); }
      }}>Save caption</Button>
    </Sheet>
  );
}

function ZoomStage({ photo, dir, reduced, onSwipe, onTap }: { photo: Photo; dir: number; reduced: boolean; onSwipe: (d: number) => void; onTap: () => void }) {
  const { url: thumb } = usePhotoUrl(photo, 'thumb');
  const { url: full } = usePhotoUrl(photo, 'full');
  const [t, setT] = useState({ s: 1, x: 0, y: 0 });
  const [dx, setDx] = useState(0);
  const [animating, setAnimating] = useState(false);
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const start = useRef<{ d: number; s: number; x: number; y: number; px: number; py: number; tx: number; ty: number } | null>(null);
  const lastTap = useRef(0);
  const tapTimer = useRef<number>();
  const moved = useRef(false);

  const clamp = (v: { s: number; x: number; y: number }) => {
    const s = Math.min(4, Math.max(1, v.s));
    const lim = (s - 1) * 180;
    return { s, x: s === 1 ? 0 : Math.max(-lim, Math.min(lim, v.x)), y: s === 1 ? 0 : Math.max(-lim * 1.4, Math.min(lim * 1.4, v.y)) };
  };

  const down = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;
    setAnimating(false);
    const arr = [...pts.current.values()];
    if (arr.length === 2) {
      start.current = { d: Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y), s: t.s, x: t.x, y: t.y, px: 0, py: 0, tx: t.x, ty: t.y };
    } else {
      start.current = { d: 0, s: t.s, x: t.x, y: t.y, px: e.clientX, py: e.clientY, tx: t.x, ty: t.y };
    }
  };
  const move = (e: React.PointerEvent) => {
    if (!pts.current.has(e.pointerId) || !start.current) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const arr = [...pts.current.values()];
    if (arr.length === 2 && start.current.d) {
      const d = Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y);
      setT(clamp({ ...t, s: (start.current.s * d) / start.current.d }));
      moved.current = true;
    } else if (arr.length === 1) {
      const ddx = e.clientX - start.current.px;
      const ddy = e.clientY - start.current.py;
      if (Math.abs(ddx) + Math.abs(ddy) > 6) moved.current = true;
      if (t.s > 1) setT(clamp({ s: t.s, x: start.current.tx + ddx, y: start.current.ty + ddy }));
      else setDx(ddx);
    }
  };
  const up = (e: React.PointerEvent) => {
    pts.current.delete(e.pointerId);
    if (pts.current.size > 0) return;
    setAnimating(true);
    if (t.s === 1 && Math.abs(dx) > 70) onSwipe(dx < 0 ? 1 : -1);
    setDx(0);
    if (!moved.current) {
      const now = Date.now();
      if (now - lastTap.current < 280) {
        clearTimeout(tapTimer.current);
        lastTap.current = 0;
        setT(t.s > 1 ? { s: 1, x: 0, y: 0 } : { s: 2.5, x: 0, y: 0 });
      } else {
        lastTap.current = now;
        tapTimer.current = window.setTimeout(onTap, 280);
      }
    }
    start.current = null;
  };
  const wheel = (e: React.WheelEvent) => {
    setAnimating(false);
    setT((p) => clamp({ ...p, s: p.s * (e.deltaY < 0 ? 1.12 : 0.89) }));
  };

  return (
    <motion.div
      className="zoom-stage"
      custom={dir}
      initial={reduced ? { opacity: 0 } : { opacity: 0, x: dir * 80 }}
      animate={{ opacity: 1, x: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, x: dir * -80 }}
      transition={{ duration: reduced ? 0.1 : 0.32, ease: [0.2, 0.8, 0.2, 1] }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onWheel={wheel}
    >
      <motion.div layoutId={reduced ? undefined : `photo-${photo.id}`} className="zoom-img-wrap" style={{ aspectRatio: `${photo.w} / ${photo.h}` }}>
        <img
          src={full ?? thumb}
          alt={photo.caption || photo.name}
          draggable={false}
          className="zoom-img"
          style={{
            backgroundImage: thumb ? `url(${thumb})` : undefined,
            transform: `translate(${t.x + dx}px, ${t.y}px) scale(${t.s})`,
            transition: animating && !reduced ? 'transform .28s cubic-bezier(.2,.8,.2,1)' : 'none',
          }}
        />
      </motion.div>
    </motion.div>
  );
}
