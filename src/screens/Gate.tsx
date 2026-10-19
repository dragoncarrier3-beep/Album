import { motion } from 'framer-motion';
import { CheckCircle2, Gem, Loader2, Lock, ShieldAlert, Wallet as WalletIcon } from 'lucide-react';
import { useState } from 'react';
import { ApiError, completeWalletConnection, requestGatedAccess, requestWalletChallenge, updateSettings, walletFor } from '../backend/api';
import { shortAddress } from '../backend/nft';
import type { Album, NFTAsset, Settings } from '../backend/types';
import { useDB } from '../lib/hooks';
import { Button, DemoTag, Sheet, errMsg } from '../ui/kit';

type Step = 'intro' | 'sign' | 'verifying' | 'ok' | 'fail';

const SCENARIOS: { v: Settings['demoScenario']; l: string }[] = [
  { v: 'owns', l: 'Owns token' },
  { v: 'not-owned', l: 'Token not owned' },
  { v: 'wrong-network', l: 'Wrong network' },
  { v: 'unavailable', l: 'Service down' },
];

export function SignMessageCard({ onDone, onCancel }: { onDone: () => void; onCancel?: () => void }) {
  const [msg, setMsg] = useState<{ address: string; message: string }>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const start = async () => {
    setBusy(true);
    setErr('');
    try {
      setMsg(await requestWalletChallenge());
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  const sign = async () => {
    setBusy(true);
    try {
      await completeWalletConnection(msg!.address, 'demo-signature');
      onDone();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  if (!msg)
    return (
      <div className="stack gap-10">
        <button className="wallet-opt" onClick={start} disabled={busy}>
          <span className="wallet-logo demo"><WalletIcon size={20} /></span>
          <span className="grow"><strong>Demo Wallet</strong><small>Simulated — no extension or crypto needed</small></span>
          {busy ? <Loader2 className="spin" size={18} /> : <DemoTag />}
        </button>
        <button className="wallet-opt" disabled aria-disabled>
          <span className="wallet-logo wc">WC</span>
          <span className="grow"><strong>WalletConnect</strong><small>Available when a project ID is configured</small></span>
        </button>
        {err && <p className="err small">{err}</p>}
        {onCancel && <Button variant="ghost" onClick={onCancel}>Not now</Button>}
      </div>
    );
  return (
    <div className="stack gap-10">
      <p className="small">Your wallet asks you to sign this message. Signing proves you control the address — <strong>it is not a transaction and costs nothing.</strong></p>
      <pre className="sign-msg">{msg.message}</pre>
      <p className="xsmall muted">LUMEN will never ask for your seed phrase or private key.</p>
      {err && <p className="err small">{err}</p>}
      <Button block loading={busy} onClick={sign}>Sign message (Demo)</Button>
      <Button block variant="ghost" onClick={() => (onCancel ? onCancel() : setMsg(undefined))}>Cancel</Button>
    </div>
  );
}

export function UnlockSheet({ album, nft, open, onClose }: { album: Album; nft?: NFTAsset; open: boolean; onClose: () => void }) {
  const wallet = useDB((db) => walletFor(db));
  const scenario = useDB((db) => db.settings.demoScenario);
  const [step, setStep] = useState<Step>('intro');
  const [err, setErr] = useState<{ code: string; message: string }>();

  const verify = async () => {
    setStep('verifying');
    try {
      await requestGatedAccess(album.id);
      setStep('ok');
      setTimeout(onClose, 1100);
    } catch (e) {
      setErr({ code: e instanceof ApiError ? e.code : 'error', message: errMsg(e) });
      setStep('fail');
    }
  };

  const close = () => {
    onClose();
    setTimeout(() => setStep('intro'), 300);
  };

  return (
    <Sheet open={open} onClose={close} title="Unlock album">
      {step === 'intro' && (
        <div className="stack gap-14">
          <div className="gate-req">
            {nft && <img src={nft.image} alt="" />}
            <div>
              <small className="muted">Requires</small>
              <strong>{nft?.name ?? 'Linked collectible'}</strong>
              <small>{nft?.collection} · {nft?.network} network</small>
            </div>
          </div>
          <ol className="steps">
            <li className={wallet ? 'done' : 'current'}>{wallet ? <>Wallet connected · <code>{shortAddress(wallet.address)}</code></> : 'Connect your wallet'}</li>
            <li className={wallet ? 'current' : ''}>Verify you currently own the collectible</li>
            <li>Album unlocks for 10 minutes</li>
          </ol>
          <div className="demo-box">
            <div className="row between"><strong className="small">Demo scenario</strong><DemoTag>Demo Verification</DemoTag></div>
            <div className="chips wrap mt-8">
              {SCENARIOS.map((s) => (
                <button key={s.v} className={`chip sm ${scenario === s.v ? 'on' : ''}`} onClick={() => updateSettings({ demoScenario: s.v })}>{s.l}</button>
              ))}
            </div>
            <p className="xsmall muted mt-6">Ownership checks here are simulated. In production the server re-checks the token on-chain on every request.</p>
          </div>
          {wallet ? <Button block size="lg" icon={<Gem size={18} />} onClick={verify}>Verify ownership</Button> : <Button block size="lg" icon={<WalletIcon size={18} />} onClick={() => setStep('sign')}>Connect wallet</Button>}
        </div>
      )}
      {step === 'sign' && <SignMessageCard onDone={verify} onCancel={() => setStep('intro')} />}
      {step === 'verifying' && (
        <div className="gate-status" role="status" aria-live="polite">
          <motion.div className="gate-ring" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.6, ease: 'linear' }} />
          <Gem size={26} className="accent" />
          <h3>Checking ownership…</h3>
          <p className="small muted">Asking the LUMEN server to confirm {nft?.name} belongs to {wallet && shortAddress(wallet.address)}.</p>
        </div>
      )}
      {step === 'ok' && (
        <div className="gate-status" role="status">
          <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}><CheckCircle2 size={54} className="ok" /></motion.div>
          <h3>Ownership confirmed</h3>
          <p className="small muted">Album unlocked · Demo Verification</p>
        </div>
      )}
      {step === 'fail' && (
        <div className="stack gap-12">
          <div className="gate-status">
            <ShieldAlert size={46} className="err" />
            <h3>Access denied</h3>
            <p className="small muted">{err?.message}</p>
          </div>
          {err?.code === 'wrong_network' && <Button block onClick={() => { updateSettings({ demoScenario: 'owns' }); verify(); }}>Switch to Demo network & retry</Button>}
          {err?.code === 'verification_unavailable' && <Button block onClick={() => { updateSettings({ demoScenario: 'owns' }); verify(); }}>Retry</Button>}
          {err?.code === 'wallet_disconnected' && <Button block onClick={() => setStep('sign')}>Connect wallet</Button>}
          {err?.code === 'not_owned' && <p className="small center muted">The album stays locked. Photos are never sent to this device without a verified grant.</p>}
          <Button block variant="secondary" onClick={() => setStep('intro')}>Back</Button>
        </div>
      )}
    </Sheet>
  );
}

export function LockedAlbum({ album, nft, ownerName, onUnlock, preview }: { album: Album; nft?: NFTAsset; ownerName: string; onUnlock: () => void; preview?: boolean }) {
  return (
    <div className="locked">
      <div className="locked-art">
        {nft && <img src={nft.image} alt="" className="locked-blur" />}
        <motion.div className="locked-badge" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <Lock size={26} />
        </motion.div>
      </div>
      <h1 className="display center">{album.title}</h1>
      <p className="center muted small">by {ownerName} · {album.photoIds.length} photos</p>
      <p className="center lede">Only a wallet that currently owns <strong>{nft?.name}</strong> can unlock this album.</p>
      {preview ? <p className="hint-card center">You’re previewing what visitors see. As the owner you always have access.</p> : <Button size="lg" block icon={<Gem size={18} />} onClick={onUnlock}>Unlock Album</Button>}
      <p className="xsmall muted center">{nft?.simulated && 'Demo collectible · simulated verification'}</p>
    </div>
  );
}
