import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Album, Photo } from '../backend/types';
import { timeAgo, useDB } from '../lib/hooks';
import { NftBadge, PhotoImg, PrivacyBadge } from './kit';

export function useCover(album: Album) {
  return useDB((db) => db.photos.find((p) => p.id === (album.coverPhotoId ?? album.photoIds[0])));
}

export function AlbumCard({ album, to, showOwner }: { album: Album; to?: string; showOwner?: boolean }) {
  const cover = useCover(album);
  const owner = useDB((db) => (showOwner ? db.users.find((u) => u.id === album.ownerId) : undefined));
  const locked = album.privacy === 'nft' && showOwner;
  return (
    <Link to={to ?? `/album/${album.id}`} className="album-card" aria-label={`${album.title}, ${album.photoIds.length} photos`}>
      <motion.div className="album-card-img" layoutId={`cover-${album.id}`}>
        <PhotoImg photo={locked ? undefined : cover} alt={`${album.title} cover`} />
        <div className="album-card-badges">{album.nftId && <NftBadge label="NFT" solid />}</div>
      </motion.div>
      <div className="album-card-meta">
        <h3>{album.title}</h3>
        <div className="album-card-sub">
          <span>{owner ? `by ${owner.name}` : `${album.photoIds.length} photos`}</span>
          {!showOwner && <PrivacyBadge privacy={album.privacy} />}
        </div>
      </div>
    </Link>
  );
}

export function AlbumRow({ album }: { album: Album }) {
  const cover = useCover(album);
  return (
    <Link to={`/album/${album.id}`} className="album-row">
      <div className="album-row-img">
        <PhotoImg photo={cover} alt={`${album.title} cover`} />
      </div>
      <div className="album-row-meta">
        <h3>{album.title}</h3>
        <p>
          {album.photoIds.length} photos · Updated {timeAgo(album.updatedAt)}
        </p>
        <div className="row gap-6">
          <PrivacyBadge privacy={album.privacy} />
          {album.nftId && <NftBadge label="NFT" />}
        </div>
      </div>
    </Link>
  );
}

export function Masonry({ photos, onOpen, favorites, cols = 2 }: { photos: Photo[]; onOpen: (p: Photo) => void; favorites?: Set<string>; cols?: number }) {
  const columns: Photo[][] = Array.from({ length: cols }, () => []);
  const heights = new Array(cols).fill(0);
  photos.forEach((p) => {
    const i = heights.indexOf(Math.min(...heights));
    columns[i].push(p);
    heights[i] += p.h / p.w;
  });
  return (
    <div className="masonry" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {columns.map((col, ci) => (
        <div key={ci} className="masonry-col">
          {col.map((p) => (
            <motion.button
              key={p.id}
              className="masonry-item"
              onClick={() => onOpen(p)}
              aria-label={`Open photo: ${p.caption || p.name}`}
              layout="position"
              whileTap={{ scale: 0.97 }}
            >
              <motion.div layoutId={`photo-${p.id}`} style={{ aspectRatio: `${p.w} / ${p.h}` }} className="masonry-img">
                <PhotoImg photo={p} />
              </motion.div>
              {favorites?.has(p.id) && (
                <span className="fav-dot" aria-label="Favorite">
                  <Heart size={12} fill="currentColor" />
                </span>
              )}
              {p.caption && <span className="masonry-caption">{p.caption}</span>}
            </motion.button>
          ))}
        </div>
      ))}
    </div>
  );
}
