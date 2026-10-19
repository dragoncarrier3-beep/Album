import { motion } from 'framer-motion';
import { Bell, FolderPlus, ImagePlus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { greeting, timeAgo, useDB, useMe } from '../lib/hooks';
import { AlbumCard, useCover } from '../ui/albums';
import { Avatar, Button, Empty, IconButton, NftBadge, PhotoImg, PrivacyBadge } from '../ui/kit';

export function Home() {
  const me = useMe()!;
  const nav = useNavigate();
  const albums = useDB((db) => db.albums.filter((a) => a.ownerId === db.sessionUserId));
  const unread = useDB((db) => db.notifications.filter((n) => !n.read).length);
  const recent = useDB((db) => db.photos.filter((p) => p.ownerId === db.sessionUserId)).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10);
  const featured = albums.slice().sort((a, b) => b.photoIds.length - a.photoIds.length)[0];
  const first = me.name.split(' ')[0];

  return (
    <div className="screen">
      <header className="home-head pad">
        <div>
          <h1 className="display">{greeting()}, {first}</h1>
          <p className="lede">Your memories, beautifully kept.</p>
        </div>
        <div className="row gap-8">
          <IconButton label={`Notifications${unread ? `, ${unread} unread` : ''}`} onClick={() => nav('/notifications')} className="bell">
            <Bell size={21} />
            {unread > 0 && <span className="bell-dot">{unread}</span>}
          </IconButton>
          <Link to="/profile" aria-label="Profile">
            <Avatar user={me} size={40} />
          </Link>
        </div>
      </header>

      {!featured ? (
        <div className="pad">
          <Empty
            icon={<FolderPlus size={28} />}
            title="Start your first album"
            body="Albums are private by default. Add photos, pick a theme and share only when you want to."
            action={<Button onClick={() => nav('/create')}>+ New Album</Button>}
          />
        </div>
      ) : (
        <>
          <section className="pad">
            <div className="section-head">
              <h2>Your Story</h2>
            </div>
            <Featured albumId={featured.id} />
          </section>

          {recent.length > 0 && (
            <section>
              <div className="section-head pad">
                <h2>Recent Memories</h2>
                <Link to="/favorites" className="link-sm">Favorites</Link>
              </div>
              <div className="carousel" role="list">
                {recent.map((p) => (
                  <motion.button role="listitem" key={p.id} className="carousel-item" whileTap={{ scale: 0.96 }} onClick={() => nav(`/album/${p.albumId}/photo/${p.id}`)} aria-label={p.caption || p.name}>
                    <PhotoImg photo={p} />
                  </motion.button>
                ))}
              </div>
            </section>
          )}

          <section className="pad">
            <div className="section-head">
              <h2>Your Albums</h2>
              <Link to="/albums" className="link-sm">See all</Link>
            </div>
            <div className="album-grid">
              {albums.map((a) => (
                <AlbumCard key={a.id} album={a} />
              ))}
            </div>
            <div className="row gap-10 mt-16">
              <Button block variant="soft" icon={<FolderPlus size={18} />} onClick={() => nav('/create')}>New Album</Button>
              <Button block variant="secondary" icon={<ImagePlus size={18} />} onClick={() => nav(`/album/${albums[0].id}/upload`)}>Upload</Button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Featured({ albumId }: { albumId: string }) {
  const album = useDB((db) => db.albums.find((a) => a.id === albumId))!;
  const cover = useCover(album);
  return (
    <Link to={`/album/${album.id}`} className="featured" aria-label={`${album.title}, featured album`}>
      <motion.div layoutId={`cover-${album.id}`} className="featured-img">
        <PhotoImg photo={cover} variant="full" eager alt={`${album.title} cover`} />
      </motion.div>
      <div className="featured-shade" />
      <div className="featured-meta">
        <div className="row gap-6">
          <PrivacyBadge privacy={album.privacy} solid />
          {album.nftId && <NftBadge solid />}
        </div>
        <h3>{album.title}</h3>
        <p>
          {album.photoIds.length} Photos · Updated {timeAgo(album.updatedAt)}
        </p>
      </div>
    </Link>
  );
}
