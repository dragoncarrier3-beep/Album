import { Gem, LayoutGrid, List, Search, SlidersHorizontal, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Privacy } from '../backend/types';
import { useDB } from '../lib/hooks';
import { AlbumCard, AlbumRow } from '../ui/albums';
import { Button, Empty, IconButton, PhotoImg, Sheet } from '../ui/kit';
import { PRIVACY, PRIVACY_ORDER } from '../ui/meta';

type Sort = 'updated' | 'created' | 'title';

export function Albums() {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [view, setView] = useState<'grid' | 'list'>(() => (localStorage.getItem('lumen.view') as 'grid' | 'list') || 'grid');
  const [sort, setSort] = useState<Sort>('updated');
  const [privacy, setPrivacy] = useState<Privacy | 'all'>('all');
  const [nftOnly, setNftOnly] = useState(false);
  const [filters, setFilters] = useState(false);
  const db = useDB((d) => d);

  const mine = db.albums.filter((a) => a.ownerId === db.sessionUserId);
  const term = q.trim().toLowerCase();

  const albums = useMemo(() => {
    let list = mine.filter((a) => (privacy === 'all' || a.privacy === privacy) && (!nftOnly || a.nftId));
    if (term) list = list.filter((a) => a.title.toLowerCase().includes(term) || a.description.toLowerCase().includes(term));
    return list.slice().sort((a, b) =>
      sort === 'title' ? a.title.localeCompare(b.title) : sort === 'created' ? b.createdAt.localeCompare(a.createdAt) : b.updatedAt.localeCompare(a.updatedAt),
    );
  }, [mine, term, sort, privacy, nftOnly]);

  const captionHits = term ? db.photos.filter((p) => p.ownerId === db.sessionUserId && p.caption.toLowerCase().includes(term)).slice(0, 12) : [];
  const setV = (v: 'grid' | 'list') => {
    setView(v);
    try { localStorage.setItem('lumen.view', v); } catch { /* ignore */ }
  };
  const activeFilters = (privacy !== 'all' ? 1 : 0) + (nftOnly ? 1 : 0);

  return (
    <div className="screen">
      <div className="pad">
        <h1 className="display">Albums</h1>
        <div className="search">
          <Search size={18} aria-hidden />
          <input type="search" placeholder="Search albums and captions" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search albums and photo captions" />
          {q && <IconButton label="Clear search" onClick={() => setQ('')}><X size={16} /></IconButton>}
        </div>
        <div className="toolbar">
          <div className="chips scroll-x" role="group" aria-label="Quick filters">
            <button className={`chip ${privacy === 'all' && !nftOnly ? 'on' : ''}`} onClick={() => { setPrivacy('all'); setNftOnly(false); }}>All</button>
            <button className={`chip ${nftOnly ? 'on' : ''}`} onClick={() => setNftOnly(!nftOnly)}><Gem size={13} /> NFT-linked</button>
            <button className={`chip ${privacy === 'private' ? 'on' : ''}`} onClick={() => setPrivacy(privacy === 'private' ? 'all' : 'private')}>Private</button>
          </div>
          <div className="row gap-4">
            <IconButton label={`Sort and filter${activeFilters ? ` (${activeFilters} active)` : ''}`} onClick={() => setFilters(true)} className={activeFilters ? 'has-dot' : ''}>
              <SlidersHorizontal size={19} />
            </IconButton>
            <IconButton label="Grid view" aria-pressed={view === 'grid'} className={view === 'grid' ? 'on' : ''} onClick={() => setV('grid')}><LayoutGrid size={19} /></IconButton>
            <IconButton label="List view" aria-pressed={view === 'list'} className={view === 'list' ? 'on' : ''} onClick={() => setV('list')}><List size={19} /></IconButton>
          </div>
        </div>

        {albums.length === 0 ? (
          <Empty icon={<Search size={26} />} title={mine.length ? 'No albums match' : 'No albums yet'} body={mine.length ? 'Try a different search or clear your filters.' : 'Create your first album to get started.'}
            action={mine.length ? <Button variant="secondary" onClick={() => { setQ(''); setPrivacy('all'); setNftOnly(false); }}>Clear filters</Button> : <Button onClick={() => nav('/create')}>+ New Album</Button>} />
        ) : view === 'grid' ? (
          <div className="album-grid">{albums.map((a) => <AlbumCard key={a.id} album={a} />)}</div>
        ) : (
          <div className="stack gap-10">{albums.map((a) => <AlbumRow key={a.id} album={a} />)}</div>
        )}

        {captionHits.length > 0 && (
          <section className="mt-24">
            <div className="section-head"><h2>Photos matching “{q}”</h2></div>
            <div className="thumb-grid">
              {captionHits.map((p) => (
                <button key={p.id} className="thumb" onClick={() => nav(`/album/${p.albumId}/photo/${p.id}`)} aria-label={p.caption}>
                  <PhotoImg photo={p} />
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      <Sheet open={filters} onClose={() => setFilters(false)} title="Sort & filter">
        <h4 className="label">Sort by</h4>
        <div className="chips wrap mb-16">
          {([['updated', 'Recently updated'], ['created', 'Date created'], ['title', 'Title A–Z']] as const).map(([v, l]) => (
            <button key={v} className={`chip ${sort === v ? 'on' : ''}`} onClick={() => setSort(v)}>{l}</button>
          ))}
        </div>
        <h4 className="label">Privacy</h4>
        <div className="chips wrap mb-16">
          <button className={`chip ${privacy === 'all' ? 'on' : ''}`} onClick={() => setPrivacy('all')}>Any</button>
          {PRIVACY_ORDER.map((p) => (
            <button key={p} className={`chip ${privacy === p ? 'on' : ''}`} onClick={() => setPrivacy(p)}>{PRIVACY[p].label}</button>
          ))}
        </div>
        <h4 className="label">Collectibles</h4>
        <div className="chips mb-16">
          <button className={`chip ${nftOnly ? 'on' : ''}`} onClick={() => setNftOnly(!nftOnly)}><Gem size={13} /> Only NFT-linked albums</button>
        </div>
        <Button block onClick={() => setFilters(false)}>Show {albums.length} albums</Button>
      </Sheet>
    </div>
  );
}
