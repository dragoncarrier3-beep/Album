import { Reorder, useDragControls } from 'framer-motion';
import { ArrowDown, ArrowUp, GripVertical, Star } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { reorderPhotos, updateAlbum } from '../backend/api';
import type { Photo } from '../backend/types';
import { useDB } from '../lib/hooks';
import { Button, IconButton, PhotoImg, TopBar, errMsg, useUI } from '../ui/kit';

export function Organize() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { toast } = useUI();
  const album = useDB((db) => db.albums.find((a) => a.id === id && a.ownerId === db.sessionUserId));
  const photos = useDB((db) => db.photos);
  const [order, setOrder] = useState<string[]>(album?.photoIds ?? []);
  const [cover, setCover] = useState(album?.coverPhotoId);
  const [busy, setBusy] = useState(false);
  if (!album) return <div className="screen"><TopBar title="Organize" /><p className="pad muted">Album not found.</p></div>;
  const byId = new Map(photos.map((p) => [p.id, p]));
  const dirty = order.join() !== album.photoIds.join() || cover !== album.coverPhotoId;

  const swap = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    const n = order.slice();
    [n[i], n[j]] = [n[j], n[i]];
    setOrder(n);
  };

  const save = async () => {
    setBusy(true);
    try {
      await reorderPhotos(album.id, order);
      if (cover && cover !== album.coverPhotoId) await updateAlbum(album.id, { coverPhotoId: cover });
      toast('Album organized');
      nav(`/album/${album.id}`, { replace: true });
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen">
      <TopBar title="Organize" right={<Button size="sm" disabled={!dirty} loading={busy} onClick={save}>Save</Button>} />
      <div className="pad">
        <p className="small muted mb-12">Drag to reorder, or use the arrows. Tap the star to choose the album cover.</p>
        <Reorder.Group axis="y" values={order} onReorder={setOrder} className="reorder">
          {order.map((pid, i) => (
            <Row key={pid} photo={byId.get(pid)!} index={i} total={order.length} isCover={cover === pid} onCover={() => setCover(pid)} onMove={(d) => swap(i, d)} />
          ))}
        </Reorder.Group>
      </div>
    </div>
  );
}

function Row({ photo, index, total, isCover, onCover, onMove }: { photo: Photo; index: number; total: number; isCover: boolean; onCover: () => void; onMove: (d: number) => void }) {
  const controls = useDragControls();
  if (!photo) return null;
  return (
    <Reorder.Item value={photo.id} dragListener={false} dragControls={controls} className="reorder-item">
      <span className="grip" onPointerDown={(e) => controls.start(e)} aria-hidden><GripVertical size={18} /></span>
      <div className="reorder-thumb"><PhotoImg photo={photo} /></div>
      <span className="grow min0 ellipsis small">{photo.caption || photo.name}</span>
      <IconButton label={isCover ? 'Album cover' : 'Set as cover'} aria-pressed={isCover} onClick={onCover} className={isCover ? 'cover-on' : ''}>
        <Star size={18} fill={isCover ? 'currentColor' : 'none'} />
      </IconButton>
      <IconButton label="Move up" disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp size={16} /></IconButton>
      <IconButton label="Move down" disabled={index === total - 1} onClick={() => onMove(1)}><ArrowDown size={16} /></IconButton>
    </Reorder.Item>
  );
}
