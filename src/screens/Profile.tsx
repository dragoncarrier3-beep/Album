import { ChevronRight, FolderOpen, Gem, Heart, LogOut, Settings as SettingsIcon, ShieldCheck, Trash2, Users, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { deleteAccount, signOut, updateProfile, walletFor } from '../backend/api';
import { shortAddress } from '../backend/nft';
import { useDB, useMe } from '../lib/hooks';
import { Avatar, Button, Field, TopBar, errMsg, useUI } from '../ui/kit';

export function Profile() {
  const me = useMe()!;
  const nav = useNavigate();
  const { confirm, toast } = useUI();
  const db = useDB((d) => d);
  const albums = db.albums.filter((a) => a.ownerId === me.id);
  const photos = db.photos.filter((p) => p.ownerId === me.id).length;
  const linked = albums.filter((a) => a.nftId).length;
  const wallet = walletFor(db);
  const shared = db.invitations.filter((i) => i.userId === me.id && i.status === 'accepted').length;
  const favs = db.favorites.filter((f) => f.userId === me.id).length;

  const rows: [React.ReactNode, string, string, string?][] = [
    [<FolderOpen size={19} />, 'My Albums', '/albums', String(albums.length)],
    [<Gem size={19} />, 'My Collectibles', '/collectibles'],
    [<Users size={19} />, 'Shared With Me', '/shared', shared ? String(shared) : undefined],
    [<Heart size={19} />, 'Favorites', '/favorites', favs ? String(favs) : undefined],
    [<ShieldCheck size={19} />, 'Privacy Settings', '/privacy'],
    [<Wallet size={19} />, 'Connected Wallet', '/wallet', wallet ? shortAddress(wallet.address) : 'Not connected'],
    [<SettingsIcon size={19} />, 'Account Settings', '/settings'],
  ];

  return (
    <div className="screen">
      <div className="pad profile-head">
        <Avatar user={me} size={92} />
        <h1 className="display mt-12">{me.name}</h1>
        <p className="muted">@{me.username}</p>
        {me.bio && <p className="profile-bio">{me.bio}</p>}
        <Button size="sm" variant="secondary" onClick={() => nav('/profile/edit')}>Edit profile</Button>
      </div>
      <div className="stats pad">
        <div><strong>{albums.length}</strong><span>Albums</span></div>
        <div><strong>{photos}</strong><span>Photos</span></div>
        <div><strong>{linked}</strong><span>Linked Collectibles</span></div>
      </div>
      <nav className="pad menu-list" aria-label="Profile">
        {rows.map(([icon, label, to, extra]) => (
          <Link key={label} to={to} className="menu-row">
            <span className="menu-icon">{icon}</span>
            <span className="grow">{label}</span>
            {extra && <span className="muted small">{extra}</span>}
            <ChevronRight size={18} className="muted" />
          </Link>
        ))}
      </nav>
      <div className="pad stack gap-10 mt-8">
        <Button variant="secondary" icon={<LogOut size={17} />} onClick={async () => {
          if (await confirm({ title: 'Sign out?', confirmLabel: 'Sign out' })) { signOut(); nav('/welcome', { replace: true }); }
        }}>Sign Out</Button>
        <Button variant="ghost" className="danger-text" icon={<Trash2 size={17} />} onClick={async () => {
          if (!(await confirm({ title: 'Delete your account?', body: 'All your albums, photos, sharing links and wallet connections will be permanently deleted. (For the demo account this resets the demo.)', confirmLabel: 'Delete account', danger: true }))) return;
          try { await deleteAccount(); toast('Account deleted'); nav('/welcome', { replace: true }); } catch (e) { toast(errMsg(e), 'error'); }
        }}>Delete Account</Button>
      </div>
    </div>
  );
}

export function EditProfile() {
  const me = useMe()!;
  const nav = useNavigate();
  const { toast } = useUI();
  const [name, setName] = useState(me.name);
  const [bio, setBio] = useState(me.bio ?? '');
  const [avatar, setAvatar] = useState(me.avatar);
  const [busy, setBusy] = useState(false);

  const pickAvatar = (f?: File) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) return toast('Please choose an image', 'error');
    const img = new Image();
    const url = URL.createObjectURL(f);
    img.onload = () => {
      const c = document.createElement('canvas');
      const s = 240;
      c.width = c.height = s;
      const m = Math.min(img.width, img.height);
      c.getContext('2d')!.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, s, s);
      setAvatar(c.toDataURL('image/jpeg', 0.85));
      URL.revokeObjectURL(url);
    };
    img.onerror = () => toast('That image format isn’t supported in this browser', 'error');
    img.src = url;
  };

  return (
    <div className="screen">
      <TopBar title="Edit profile" />
      <div className="pad stack gap-16">
        <label className="avatar-edit">
          <Avatar user={{ ...me, avatar }} size={96} />
          <span className="link-sm">Change photo</span>
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => pickAvatar(e.target.files?.[0])} />
        </label>
        <Field label="Display name"><input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Bio" hint={`${bio.length}/160`}><textarea rows={3} maxLength={160} value={bio} onChange={(e) => setBio(e.target.value)} /></Field>
        <Button size="lg" block loading={busy} onClick={async () => {
          setBusy(true);
          try { await updateProfile({ name: name.trim(), bio, avatar }); toast('Profile updated'); nav(-1); } catch (e) { toast(errMsg(e), 'error'); } finally { setBusy(false); }
        }}>Save</Button>
      </div>
    </div>
  );
}
