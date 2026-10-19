import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Camera, CheckCircle2, Images, RotateCw, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError, uploadPhoto, validateFile } from '../backend/api';
import { useDB } from '../lib/hooks';
import { Button, Empty, IconButton, TopBar, errMsg, useUI } from '../ui/kit';

type Status = 'ready' | 'uploading' | 'done' | 'error' | 'cancelled';
interface Item {
  key: string;
  file: File;
  url?: string;
  caption: string;
  status: Status;
  progress: number;
  error?: string;
  ctrl?: AbortController;
}

const fmt = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);

export function Upload() {
  const { id } = useParams();
  const nav = useNavigate();
  const { toast } = useUI();
  const album = useDB((db) => db.albums.find((a) => a.id === id && a.ownerId === db.sessionUserId));
  const [items, setItems] = useState<Item[]>([]);
  const [running, setRunning] = useState(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => () => itemsRef.current.forEach((i) => { i.ctrl?.abort(); if (i.url) URL.revokeObjectURL(i.url); }), []);

  if (!album) return <div className="screen"><TopBar title="Upload" /><Empty icon={<AlertCircle />} title="Album not available" body="You can only upload to albums you own." /></div>;

  const patch = (key: string, p: Partial<Item>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...p } : i)));

  const add = (files: FileList | null) => {
    if (!files?.length) return;
    const next: Item[] = [];
    for (const f of Array.from(files)) {
      const base: Item = { key: `${f.name}-${f.size}-${Math.random()}`, file: f, caption: '', status: 'ready', progress: 0 };
      try {
        validateFile(f);
        next.push({ ...base, url: URL.createObjectURL(f) });
      } catch (e) {
        next.push({ ...base, status: 'error', error: errMsg(e) });
      }
    }
    setItems((l) => [...l, ...next]);
  };

  const runOne = async (it: Item) => {
    const ctrl = new AbortController();
    patch(it.key, { status: 'uploading', progress: 0, error: undefined, ctrl });
    try {
      await uploadPhoto(album.id, it.file, it.caption, { signal: ctrl.signal, onProgress: (p) => patch(it.key, { progress: p }) });
      patch(it.key, { status: 'done', progress: 100, ctrl: undefined });
      return true;
    } catch (e) {
      const cancelled = e instanceof ApiError && e.code === 'cancelled';
      patch(it.key, { status: cancelled ? 'cancelled' : 'error', error: cancelled ? 'Cancelled' : errMsg(e), ctrl: undefined });
      return false;
    }
  };

  const uploadAll = async () => {
    const queue = itemsRef.current.filter((i) => i.status === 'ready' || i.status === 'cancelled' || (i.status === 'error' && i.url));
    if (!queue.length) return;
    setRunning(true);
    let ok = 0;
    for (const it of queue) {
      const fresh = itemsRef.current.find((x) => x.key === it.key);
      if (!fresh) continue;
      if (await runOne(fresh)) ok++;
    }
    setRunning(false);
    if (ok) toast(`${ok} photo${ok > 1 ? 's' : ''} saved to ${album.title}`);
    if (ok < queue.length) toast(`${queue.length - ok} upload${queue.length - ok > 1 ? 's' : ''} didn’t finish — you can retry`, 'error');
  };

  const remove = (it: Item) => {
    it.ctrl?.abort();
    if (it.url) URL.revokeObjectURL(it.url);
    setItems((l) => l.filter((x) => x.key !== it.key));
  };

  const pending = items.filter((i) => i.status !== 'done' && i.url).length;
  const done = items.filter((i) => i.status === 'done').length;
  const total = items.filter((i) => i.url).length;
  const overall = total ? Math.round(items.filter((i) => i.url).reduce((s, i) => s + i.progress, 0) / total) : 0;

  return (
    <div className="screen">
      <TopBar title="Add Photos" />
      <div className="pad">
        <p className="lede">Uploading to <strong>{album.title}</strong>. Originals are stored privately; thumbnails are generated for fast browsing.</p>

        <div className="row gap-10 mt-16">
          <label className="pick-card">
            <Images size={24} />
            <span>Photo library</span>
            <small>Select one or many</small>
            <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic" multiple className="sr-only" onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
          </label>
          <label className="pick-card">
            <Camera size={24} />
            <span>Take a photo</span>
            <small>Uses your camera</small>
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
          </label>
        </div>

        {items.length === 0 ? (
          <p className="muted center mt-24 small">JPEG, PNG, WebP and HEIC (where your device supports it) · up to 25 MB each</p>
        ) : (
          <>
            {running || done ? (
              <div className="overall" aria-live="polite">
                <div className="row between small"><span>{running ? 'Uploading…' : `${done} of ${total} uploaded`}</span><span>{overall}%</span></div>
                <div className="progress"><motion.span animate={{ width: `${overall}%` }} /></div>
              </div>
            ) : null}
            <ul className="upload-list">
              <AnimatePresence initial={false}>
                {items.map((it) => (
                  <motion.li key={it.key} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className={`upload-item s-${it.status}`}>
                    <div className="upload-thumb">
                      {it.url ? <img src={it.url} alt={it.file.name} onError={(e) => ((e.target as HTMLImageElement).style.opacity = '0')} /> : <AlertCircle size={20} />}
                      {it.status === 'done' && <span className="upload-ok"><CheckCircle2 size={22} /></span>}
                    </div>
                    <div className="grow min0">
                      <div className="row between">
                        <span className="ellipsis small strong">{it.file.name}</span>
                        <span className="muted xsmall">{fmt(it.file.size)}</span>
                      </div>
                      {it.status === 'ready' || it.status === 'cancelled' ? (
                        <input className="caption-input" placeholder="Add a caption (optional)" value={it.caption} onChange={(e) => patch(it.key, { caption: e.target.value })} aria-label={`Caption for ${it.file.name}`} />
                      ) : it.status === 'uploading' ? (
                        <div className="progress sm" role="progressbar" aria-valuenow={it.progress} aria-valuemin={0} aria-valuemax={100}><motion.span animate={{ width: `${it.progress}%` }} /></div>
                      ) : it.status === 'done' ? (
                        <span className="ok small">Saved{it.caption && ` · “${it.caption}”`}</span>
                      ) : (
                        <span className="err small">{it.error}</span>
                      )}
                      {it.status === 'cancelled' && <span className="muted xsmall">Cancelled — tap Upload to try again</span>}
                    </div>
                    <div className="upload-actions">
                      {it.status === 'uploading' && <IconButton label="Cancel upload" onClick={() => it.ctrl?.abort()}><X size={18} /></IconButton>}
                      {it.status === 'error' && it.url && <IconButton label="Retry upload" onClick={() => runOne(it)}><RotateCw size={18} /></IconButton>}
                      {it.status !== 'uploading' && it.status !== 'done' && <IconButton label="Remove" onClick={() => remove(it)}><Trash2 size={18} /></IconButton>}
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </>
        )}

        <div className="sticky-actions stack gap-10">
          {pending > 0 && <Button size="lg" block loading={running} onClick={uploadAll}>Upload {pending} photo{pending > 1 ? 's' : ''}</Button>}
          {done > 0 && !running && <Button size="lg" block variant={pending ? 'secondary' : 'primary'} onClick={() => nav(`/album/${album.id}`, { replace: true })}>View album</Button>}
        </div>
      </div>
    </div>
  );
}
