import { Check, Gem, ImagePlus, Wallet } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createAlbum, linkNft, myCollectibles, updateAlbum, validateFile } from '../backend/api';
import type { Privacy, ThemeId } from '../backend/types';
import { useDB } from '../lib/hooks';
import { Button, Field, PhotoImg, TopBar, errMsg, useUI } from '../ui/kit';
import { PRIVACY, PRIVACY_ORDER, THEMES, THEME_ORDER } from '../ui/meta';

const SAMPLE = ['/photos/thumb/110.jpg', '/photos/thumb/206.jpg', '/photos/thumb/112.jpg'];

export function AlbumForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const { toast } = useUI();
  const db = useDB((d) => d);
  const existing = id ? db.albums.find((a) => a.id === id && a.ownerId === db.sessionUserId) : undefined;
  const nfts = myCollectibles(db);
  const editing = Boolean(id);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [theme, setTheme] = useState<ThemeId>(existing?.theme ?? 'classic');
  const [privacy, setPrivacy] = useState<Privacy>(existing?.privacy ?? 'private');
  const [nftId, setNftId] = useState<string | undefined>(existing?.nftId);
  const [cover, setCover] = useState<File>();
  const [coverUrl, setCoverUrl] = useState<string>();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!cover) return setCoverUrl(undefined);
    const u = URL.createObjectURL(cover);
    setCoverUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [cover]);

  const albumPhotos = useMemo(() => (existing ? existing.photoIds.slice(0, 3).map((pid) => db.photos.find((p) => p.id === pid)!).filter(Boolean) : []), [existing, db.photos]);

  if (id && !existing) return <div className="screen"><TopBar title="Edit album" /><p className="pad muted">Album not found or you don’t own it.</p></div>;

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Album title is required.';
    if (title.trim().length > 60) e.title = 'Keep it under 60 characters.';
    if (privacy === 'nft' && !nftId) e.nft = 'Choose a collectible to use NFT Owner Access.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      if (existing) {
        if (nftId && nftId !== existing.nftId) await linkNft(existing.id, nftId);
        await updateAlbum(existing.id, { title, description, theme, privacy });
        toast('Album updated');
        nav(`/album/${existing.id}`, { replace: true });
      } else {
        const a = await createAlbum({ title, description, theme, privacy, nftId, coverFile: cover });
        toast('Album created');
        nav(`/album/${a.id}`, { replace: true });
      }
    } catch (x) {
      toast(errMsg(x), 'error');
    } finally {
      setBusy(false);
    }
  };

  const previewImgs = coverUrl ? [coverUrl, ...SAMPLE.slice(1)] : SAMPLE;

  return (
    <div className="screen">
      <TopBar title={editing ? 'Edit Album' : 'New Album'} />
      <div className="pad stack gap-18">
        <Field label="Album title" error={errors.title}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Spring in Kyoto" maxLength={70} aria-required />
        </Field>
        <Field label="Description" hint="Optional">
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What makes these memories special?" />
        </Field>

        {!editing ? (
          <div className="field">
            <span className="field-label">Cover image</span>
            <label className="cover-pick">
              {coverUrl ? <img src={coverUrl} alt="Selected cover" /> : (<><ImagePlus size={24} /><span>Choose a cover photo</span><small>Optional · you can change it later</small></>)}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try { validateFile(f); setCover(f); } catch (x) { toast(errMsg(x), 'error'); }
                }}
              />
            </label>
          </div>
        ) : (
          <div className="field">
            <span className="field-label">Cover image</span>
            <Link to={`/album/${existing!.id}/organize`} className="list-btn">
              <span>Change cover & reorder photos</span>
              <small>{existing!.photoIds.length} photos</small>
            </Link>
          </div>
        )}

        <div className="field">
          <span className="field-label">Album theme</span>
          <div className="theme-picker" role="radiogroup" aria-label="Album theme">
            {THEME_ORDER.map((t) => (
              <button key={t} role="radio" aria-checked={theme === t} className={`theme-opt ${theme === t ? 'on' : ''}`} onClick={() => setTheme(t)}>
                <span className="theme-swatch" style={{ background: THEMES[t].swatch[0] }}>
                  <span style={{ background: THEMES[t].swatch[1] }} />
                </span>
                <span>{THEMES[t].label}</span>
              </button>
            ))}
          </div>
          <div className={`theme-preview album-theme-${theme}`} aria-label={`Preview: ${THEMES[theme].label}`}>
            <div className="tp-title">{title || 'Your album'}</div>
            <div className="tp-sub">{THEMES[theme].note}</div>
            <div className="tp-grid">
              {albumPhotos.length
                ? albumPhotos.map((p) => <div key={p.id} className="tp-cell"><PhotoImg photo={p} /></div>)
                : previewImgs.map((src) => <div key={src} className="tp-cell"><img src={src} alt="" /></div>)}
            </div>
          </div>
        </div>

        <div className="field">
          <span className="field-label">Who can see it</span>
          <div className="privacy-list" role="radiogroup" aria-label="Privacy">
            {PRIVACY_ORDER.map((p) => {
              const M = PRIVACY[p];
              const I = M.icon;
              return (
                <button key={p} role="radio" aria-checked={privacy === p} className={`privacy-opt ${privacy === p ? 'on' : ''}`} onClick={() => setPrivacy(p)}>
                  <span className={`privacy-icon tone-${M.tone}`}><I size={18} /></span>
                  <span className="grow">
                    <strong>{M.label}{p === 'private' && ' (default)'}</strong>
                    <small>{M.who}</small>
                  </span>
                  {privacy === p && <Check size={18} className="accent" />}
                </button>
              );
            })}
          </div>
        </div>

        {(!editing || !existing?.nftId) && (
          <div className="field">
            <span className="field-label"><Gem size={14} /> Link a collectible {privacy !== 'nft' && <em className="muted">· optional</em>}</span>
            {nfts.length === 0 ? (
              <Link to="/wallet" className="list-btn"><span><Wallet size={16} /> Connect a wallet to link a collectible</span></Link>
            ) : (
              <div className="nft-pick">
                {privacy !== 'nft' && (
                  <button className={`nft-pick-opt ${!nftId ? 'on' : ''}`} onClick={() => setNftId(undefined)}><span className="none">None</span></button>
                )}
                {nfts.map((n) => (
                  <button key={n.id} className={`nft-pick-opt ${nftId === n.id ? 'on' : ''}`} onClick={() => setNftId(n.id)} aria-pressed={nftId === n.id}>
                    <img src={n.image} alt="" />
                    <span>{n.name}</span>
                  </button>
                ))}
              </div>
            )}
            {errors.nft && <span className="field-error" role="alert">{errors.nft}</span>}
            <span className="field-hint">Linking doesn’t transfer, mint or change the NFT. Photos stay in private storage.</span>
          </div>
        )}

        <div className="row gap-10 sticky-actions">
          <Button variant="secondary" block onClick={() => nav(-1)}>Cancel</Button>
          <Button block onClick={submit} loading={busy}>{editing ? 'Save Changes' : 'Create Album'}</Button>
        </div>
      </div>
    </div>
  );
}
