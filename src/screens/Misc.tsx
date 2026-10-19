import { Bell, Gem, Heart, Lock, Users } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { markNotificationsRead } from '../backend/api';
import { timeAgo, useDB } from '../lib/hooks';
import { useCover } from '../ui/albums';
import { Avatar, Empty, NftBadge, PhotoImg, PrivacyBadge, TopBar } from '../ui/kit';
import type { Album } from '../backend/types';

export function Notifications() {
  const list = useDB((db) => db.notifications);
  useEffect(() => {
    const t = setTimeout(markNotificationsRead, 1200);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="screen">
      <TopBar title="Notifications" />
      <div className="pad">
        {list.length === 0 ? <Empty icon={<Bell size={26} />} title="You’re all caught up" /> : (
          <div className="card-list">
            {list.map((n) => (
              <Link key={n.id} to={n.link ?? '/'} className={`notif ${n.read ? '' : 'unread'}`}>
                <span className="notif-dot" aria-hidden />
                <span className="grow">
                  <strong>{n.title}</strong>
                  <small>{n.body}</small>
                  <small className="muted">{timeAgo(n.createdAt)}</small>
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function Favorites() {
  const nav = useNavigate();
  const photos = useDB((db) => {
    const ids = new Set(db.favorites.filter((f) => f.userId === db.sessionUserId).map((f) => f.photoId));
    return db.photos.filter((p) => ids.has(p.id));
  });
  return (
    <div className="screen">
      <TopBar title="Favorites" />
      <div className="pad">
        {photos.length === 0 ? <Empty icon={<Heart size={26} />} title="No favorites yet" body="Tap the heart on any photo to keep it here." /> : (
          <div className="thumb-grid">
            {photos.map((p) => (
              <button key={p.id} className="thumb" onClick={() => nav(`/album/${p.albumId}/photo/${p.id}`)} aria-label={p.caption || p.name}>
                <PhotoImg photo={p} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function SharedWithMe() {
  const albums = useDB((db) => {
    const ids = new Set(db.invitations.filter((i) => i.userId === db.sessionUserId && i.status === 'accepted').map((i) => i.albumId));
    return db.albums.filter((a) => ids.has(a.id) && a.ownerId !== db.sessionUserId);
  });
  return (
    <div className="screen">
      <TopBar title="Shared With Me" />
      <div className="pad stack gap-10">
        {albums.length === 0 ? <Empty icon={<Users size={26} />} title="Nothing shared yet" body="Albums other people share with you will appear here." /> : albums.map((a) => <SharedRow key={a.id} album={a} />)}
      </div>
    </div>
  );
}

function SharedRow({ album }: { album: Album }) {
  const owner = useDB((db) => db.users.find((u) => u.id === album.ownerId));
  const nft = useDB((db) => db.nfts.find((n) => n.id === album.nftId));
  const cover = useCover(album);
  const gated = album.privacy === 'nft';
  return (
    <Link to={`/album/${album.id}`} className="album-row">
      <div className="album-row-img">
        {gated ? <div className="img-fallback locked-thumb"><img src={nft?.image} alt="" /><Lock size={20} /></div> : <PhotoImg photo={cover} />}
      </div>
      <div className="album-row-meta">
        <h3>{album.title}</h3>
        <p className="row gap-6"><Avatar user={owner} size={18} /> {owner?.name}</p>
        <div className="row gap-6">
          <PrivacyBadge privacy={album.privacy} />
          {nft && (gated ? <span className="badge badge-lavender"><Gem size={12} /> Needs {nft.name}</span> : <NftBadge label="NFT" />)}
        </div>
      </div>
    </Link>
  );
}
