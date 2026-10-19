import { KeyRound, Link2Off } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError, openShareLink } from '../backend/api';
import type { Album, Photo, User } from '../backend/types';
import { usePhotoUrl } from '../lib/hooks';
import { Masonry } from '../ui/albums';
import { Avatar, Button, Empty, Field, Sheet, Spinner, TopBar } from '../ui/kit';

/** What a recipient sees when opening a shared link. Access is resolved server-side from the token. */
export function SharedLink() {
  const { token = '' } = useParams();
  const nav = useNavigate();
  const [state, setState] = useState<{ album: Album; owner: User; photos: Photo[] } | null>(null);
  const [err, setErr] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [pass, setPass] = useState('');
  const [open, setOpen] = useState<Photo | null>(null);

  const load = async (code?: string) => {
    setLoading(true);
    try {
      setState(await openShareLink(token, code));
      setErr(null);
    } catch (e) {
      setErr(e as ApiError);
      setState(null);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const needsCode = err?.code === 'passcode_required' || err?.code === 'bad_passcode';

  return (
    <div className={`screen ${state ? `album-theme-${state.album.theme} album-screen` : ''}`}>
      <TopBar title="Shared album" />
      <div className="recipient-banner">Recipient view · view-only access via private link</div>
      {loading && !state ? (
        <Spinner />
      ) : needsCode ? (
        <div className="pad stack gap-14">
          <Empty icon={<KeyRound size={26} />} title="Passcode required" body="The owner protected this album with a passcode." />
          <Field label="Passcode" error={err?.code === 'bad_passcode' ? err.message : undefined}>
            <input value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Enter passcode" onKeyDown={(e) => e.key === 'Enter' && load(pass)} />
          </Field>
          <Button block loading={loading} onClick={() => load(pass)}>Open album</Button>
        </div>
      ) : err ? (
        <div className="pad">
          <Empty icon={<Link2Off size={26} />} title={err.code === 'revoked' ? 'Link revoked' : err.code === 'expired' ? 'Link expired' : 'Link unavailable'} body={err.message} action={<Button variant="secondary" onClick={() => nav('/')}>Back to LUMEN</Button>} />
        </div>
      ) : state ? (
        <div>
          <div className="pad">
            <h1 className="display">{state.album.title}</h1>
            <p className="lede">{state.album.description}</p>
            <div className="hero-by dark mt-8"><Avatar user={state.owner} size={26} /> Shared by {state.owner.name} · {state.photos.length} photos</div>
          </div>
          <div className="album-body">
            <Masonry photos={state.photos} onOpen={setOpen} />
          </div>
        </div>
      ) : null}
      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.caption || open?.name}>
        {open && <RecipientPhoto photo={open} />}
      </Sheet>
    </div>
  );
}

function RecipientPhoto({ photo }: { photo: Photo }) {
  const { url } = usePhotoUrl(photo, 'full');
  return (
    <div className="stack gap-12">
      <img src={url} alt={photo.caption || photo.name} className="recipient-photo" />
      <p className="xsmall muted center">View-only link · downloads are disabled for recipients</p>
    </div>
  );
}
