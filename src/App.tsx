import { motion } from 'framer-motion';
import { Compass, FolderOpen, Home as HomeIcon, ImagePlus, Plus, RotateCcw, User as UserIcon, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { resetDB } from './backend/store';
import { useDB, useOnline, useReducedMotion } from './lib/hooks';
import { Sheet, UIProvider } from './ui/kit';
import { AlbumDetail } from './screens/AlbumDetail';
import { Albums } from './screens/Albums';
import { AlbumForm } from './screens/AlbumForm';
import { SignIn, SignUp } from './screens/Auth';
import { Collectibles } from './screens/Collectibles';
import { Discover } from './screens/Discover';
import { Home } from './screens/Home';
import { Favorites, Notifications, SharedWithMe } from './screens/Misc';
import { Onboarding } from './screens/Onboarding';
import { Organize } from './screens/Organize';
import { PrivacyCenter } from './screens/Privacy';
import { EditProfile, Profile } from './screens/Profile';
import { Settings } from './screens/Settings';
import { SharedLink } from './screens/SharedLink';
import { Upload } from './screens/Upload';
import { Viewer } from './screens/Viewer';
import { Wallet } from './screens/Wallet';

const TABS = ['/', '/albums', '/discover', '/profile'];

function useAppearance() {
  const appearance = useDB((db) => db.settings.appearance);
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const dark = appearance === 'dark' || (appearance === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
      root.dataset.theme = dark ? 'dark' : 'light';
    };
    apply();
    const m = matchMedia('(prefers-color-scheme: dark)');
    m.addEventListener('change', apply);
    return () => m.removeEventListener('change', apply);
  }, [appearance]);
}

function Guard({ children }: { children: JSX.Element }) {
  const session = useDB((db) => db.sessionUserId);
  const loc = useLocation();
  if (!session) return <Navigate to="/welcome" replace state={{ from: loc.pathname }} />;
  return children;
}

function TabBar() {
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const albums = useDB((db) => db.albums.filter((a) => a.ownerId === db.sessionUserId));
  const [pick, setPick] = useState(false);
  const item = (to: string, label: string, Icon: typeof HomeIcon) => (
    <NavLink to={to} end className={({ isActive }) => `tab ${isActive ? 'on' : ''}`}>
      <Icon size={22} aria-hidden />
      <span>{label}</span>
    </NavLink>
  );
  return (
    <>
      <nav className="tabbar" aria-label="Main">
        {item('/', 'Home', HomeIcon)}
        {item('/albums', 'Albums', FolderOpen)}
        <button className="tab tab-create" onClick={() => setOpen(true)} aria-label="Create">
          <span className="tab-create-btn">
            <Plus size={26} />
          </span>
          <span>Create</span>
        </button>
        {item('/discover', 'Discover', Compass)}
        {item('/profile', 'Profile', UserIcon)}
      </nav>
      <Sheet open={open} onClose={() => { setOpen(false); setPick(false); }} title={pick ? 'Upload to which album?' : 'Create'}>
        {!pick ? (
          <div className="stack gap-10">
            <button className="create-option" onClick={() => { setOpen(false); nav('/create'); }}>
              <span className="create-option-icon lav"><FolderOpen size={22} /></span>
              <span><strong>New Album</strong><small>Title, theme, privacy and an optional collectible</small></span>
            </button>
            <button className="create-option" onClick={() => setPick(true)}>
              <span className="create-option-icon peach"><ImagePlus size={22} /></span>
              <span><strong>Upload Photos</strong><small>From your gallery or camera</small></span>
            </button>
          </div>
        ) : (
          <div className="stack gap-6">
            {albums.map((a) => (
              <button key={a.id} className="list-btn" onClick={() => { setOpen(false); setPick(false); nav(`/album/${a.id}/upload`); }}>
                <span>{a.title}</span>
                <small>{a.photoIds.length} photos</small>
              </button>
            ))}
          </div>
        )}
      </Sheet>
    </>
  );
}

function Shell() {
  const loc = useLocation();
  const reduced = useReducedMotion();
  const online = useOnline();
  const session = useDB((db) => db.sessionUserId);
  const onboarded = useDB((db) => db.onboarded);
  const showTabs = session && TABS.includes(loc.pathname);
  useAppearance();
  useEffect(() => {
    document.getElementById('scroller')?.scrollTo({ top: 0 });
  }, [loc.pathname]);

  return (
    <div className="frame" id="frame">
      {!online && (
        <div className="offline-bar" role="status">
          <WifiOff size={14} /> You’re offline — changes will fail until you reconnect.
        </div>
      )}
      <main className={`scroller ${showTabs ? 'has-tabs' : ''}`} id="scroller">
        <motion.div
          key={loc.pathname}
          className="page"
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <Routes location={loc}>
            <Route path="/welcome" element={session ? <Navigate to="/" replace /> : <Onboarding startAtEnd={onboarded} />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/s/:token" element={<SharedLink />} />
            <Route path="/" element={<Guard><Home /></Guard>} />
            <Route path="/albums" element={<Guard><Albums /></Guard>} />
            <Route path="/create" element={<Guard><AlbumForm /></Guard>} />
            <Route path="/discover" element={<Guard><Discover /></Guard>} />
            <Route path="/profile" element={<Guard><Profile /></Guard>} />
            <Route path="/profile/edit" element={<Guard><EditProfile /></Guard>} />
            <Route path="/album/:id" element={<Guard><AlbumDetail /></Guard>} />
            <Route path="/album/:id/edit" element={<Guard><AlbumForm /></Guard>} />
            <Route path="/album/:id/upload" element={<Guard><Upload /></Guard>} />
            <Route path="/album/:id/organize" element={<Guard><Organize /></Guard>} />
            <Route path="/album/:id/photo/:photoId" element={<Guard><Viewer /></Guard>} />
            <Route path="/collectibles" element={<Guard><Collectibles /></Guard>} />
            <Route path="/wallet" element={<Guard><Wallet /></Guard>} />
            <Route path="/privacy" element={<Guard><PrivacyCenter /></Guard>} />
            <Route path="/settings" element={<Guard><Settings /></Guard>} />
            <Route path="/notifications" element={<Guard><Notifications /></Guard>} />
            <Route path="/favorites" element={<Guard><Favorites /></Guard>} />
            <Route path="/shared" element={<Guard><SharedWithMe /></Guard>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </motion.div>
      </main>
      {showTabs && <TabBar />}
    </div>
  );
}

const TOUR = [
  ['Explore Demo', '/welcome'],
  ['Open Summer in Italy', '/album/a-italy'],
  ['Create an album with a theme', '/create'],
  ['Upload a real photo', '/album/a-weekend/upload'],
  ['Share a link, preview, revoke', '/album/a-golden'],
  ['My Collectibles → link to album', '/collectibles'],
  ['Unlock an NFT-gated album', '/album/a-members'],
  ['Privacy Control Center', '/privacy'],
  ['Discover public albums', '/discover'],
  ['Settings · dark mode', '/settings'],
] as const;

function Showcase() {
  return (
    <aside className="showcase" aria-label="About this demo">
      <div className="brand">
        <span className="brand-mark" aria-hidden />
        LUMEN
      </div>
      <h2>Your Memories.<br />Your Collection.</h2>
      <p>A privacy-first photo album with NFT-linked albums. This is an interactive product demo — everything you tap works and is saved in this browser.</p>
      <ol className="tour">
        {TOUR.map(([label, to], i) => (
          <li key={to}>
            <Link to={to}>
              <span>{i + 1}</span>
              {label}
            </Link>
          </li>
        ))}
      </ol>
      <button
        className="reset-link"
        onClick={() => {
          if (confirm('Reset all demo data to the original seed?')) {
            resetDB();
            location.href = '/welcome';
          }
        }}
      >
        <RotateCcw size={14} /> Reset demo data
      </button>
      <p className="fineprint">Collectibles and wallet verification are simulated (Demo Mode). No real blockchain assets, transactions or fees.</p>
    </aside>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <UIProvider>
        <div className="stage">
          <Showcase />
          <div className="device">
            <Shell />
          </div>
        </div>
      </UIProvider>
    </BrowserRouter>
  );
}
