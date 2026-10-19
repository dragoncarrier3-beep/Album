import { motion } from 'framer-motion';
import { Compass, Gem } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Category } from '../backend/types';
import { useDB } from '../lib/hooks';
import { AlbumCard, useCover } from '../ui/albums';
import { Avatar, Empty, NftBadge, PhotoImg } from '../ui/kit';
import type { Album } from '../backend/types';

const CATS: Category[] = ['Travel', 'Lifestyle', 'Nature', 'Art', 'Family', 'Digital Collectibles'];

export function Discover() {
  const [cat, setCat] = useState<Category | 'All'>('All');
  // Server-side equivalent: `select * from albums where privacy = 'public'` — nothing else is ever returned.
  const pub = useDB((db) => db.albums.filter((a) => a.privacy === 'public'));
  const list = cat === 'All' ? pub : pub.filter((a) => a.category === cat);
  const featured = pub.find((a) => a.id === 'a-nordic') ?? pub[0];
  const nftLinked = pub.filter((a) => a.nftId);

  return (
    <div className="screen">
      <div className="pad">
        <h1 className="display">Discover</h1>
        <p className="lede">Public albums from the LUMEN community.</p>
      </div>
      <div className="chips scroll-x pad-x" role="tablist" aria-label="Categories">
        {(['All', ...CATS] as const).map((c) => (
          <button key={c} role="tab" aria-selected={cat === c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>
            {c === 'Digital Collectibles' && <Gem size={13} />} {c}
          </button>
        ))}
      </div>

      {cat === 'All' && featured && (
        <section className="pad">
          <div className="section-head"><h2>Featured</h2></div>
          <FeaturedPublic album={featured} />
        </section>
      )}

      {cat === 'All' && nftLinked.length > 0 && (
        <section>
          <div className="section-head pad"><h2>Collectible-linked albums</h2></div>
          <div className="carousel wide">
            {nftLinked.map((a) => (
              <div key={a.id} className="carousel-card"><AlbumCard album={a} showOwner /></div>
            ))}
          </div>
        </section>
      )}

      <section className="pad">
        <div className="section-head"><h2>{cat === 'All' ? 'Community inspiration' : cat}</h2></div>
        {list.length === 0 ? (
          <Empty icon={<Compass size={26} />} title="Nothing here yet" body="No public albums in this category." />
        ) : (
          <div className="album-grid">{list.map((a) => <AlbumCard key={a.id} album={a} showOwner />)}</div>
        )}
        <p className="xsmall muted center mt-16">Only albums explicitly set to Public appear here. Private, invite-only, link-shared and NFT-gated albums never do.</p>
      </section>
    </div>
  );
}

function FeaturedPublic({ album }: { album: Album }) {
  const cover = useCover(album);
  const owner = useDB((db) => db.users.find((u) => u.id === album.ownerId));
  return (
    <Link to={`/album/${album.id}`} className="featured">
      <motion.div layoutId={`cover-${album.id}`} className="featured-img"><PhotoImg photo={cover} variant="full" /></motion.div>
      <div className="featured-shade" />
      <div className="featured-meta">
        {album.nftId && <NftBadge solid />}
        <h3>{album.title}</h3>
        <p className="row gap-6"><Avatar user={owner} size={20} /> {owner?.name} · {album.photoIds.length} photos</p>
      </div>
    </Link>
  );
}
