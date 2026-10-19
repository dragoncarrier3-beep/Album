import { motion } from 'framer-motion';
import { ArrowLeftRight, Gem, Link2, Unlink, Wallet as WalletIcon } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { demoTransferNft, linkNft, myCollectibles, unlinkNft, walletFor } from '../backend/api';
import { shortAddress } from '../backend/nft';
import type { NFTAsset } from '../backend/types';
import { useDB } from '../lib/hooks';
import { Button, DemoTag, Empty, NftBadge, Sheet, TopBar, errMsg, useUI } from '../ui/kit';

export function Collectibles() {
  const db = useDB((d) => d);
  const wallet = walletFor(db);
  const nfts = myCollectibles(db);
  const transferred = db.nfts.filter((n) => n.simulated && n.ownerWallet.startsWith('0x7ra115fe'));
  const [sel, setSel] = useState<NFTAsset | null>(null);
  const nav = useNavigate();

  return (
    <div className="screen">
      <TopBar />
      <div className="pad">
        <h1 className="display">My Collectibles</h1>
        <p className="lede">Connect your digital collectibles to the memories that matter.</p>

        <Link to="/wallet" className="wallet-card">
          <span className="wallet-logo demo"><WalletIcon size={18} /></span>
          <span className="grow">
            {wallet ? (<><strong>{shortAddress(wallet.address)}</strong><small>{wallet.mode === 'demo' ? 'Demo Wallet Mode' : wallet.network} · Connected</small></>) : (<><strong>No wallet connected</strong><small>Connect to see collectibles you own</small></>)}
          </span>
          {wallet?.mode === 'demo' && <DemoTag />}
        </Link>

        {!wallet ? (
          <Empty icon={<Gem size={28} />} title="Connect a wallet" body="LUMEN only reads which collectibles you own. It never asks for your seed phrase or for transaction approvals." action={<Button onClick={() => nav('/wallet')}>Connect wallet</Button>} />
        ) : nfts.length === 0 ? (
          <Empty icon={<Gem size={28} />} title="No collectibles found" body="This wallet doesn’t currently hold any supported collectibles." />
        ) : (
          <>
            <div className="sim-note"><Gem size={14} /> <span>These are <strong>simulated NFTs</strong> for the demo — not real blockchain assets.</span></div>
            <div className="nft-grid">
              {nfts.map((n) => {
                const album = db.albums.find((a) => a.nftId === n.id && a.ownerId === db.sessionUserId);
                return (
                  <motion.button key={n.id} className="nft-card" whileTap={{ scale: 0.97 }} onClick={() => setSel(n)} aria-label={`${n.name}, ${n.collection}`}>
                    <div className="nft-art"><img src={n.image} alt="" /><span className="nft-frame" /></div>
                    <div className="nft-meta">
                      <strong>{n.name}</strong>
                      <small>{n.collection}</small>
                      <div className="row gap-6 wrap mt-6">
                        <DemoTag>Demo Collectible</DemoTag>
                      </div>
                      <small className="nft-linked">{album ? <><Link2 size={12} /> {album.title}</> : 'Not linked'}</small>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </>
        )}
        {transferred.length > 0 && (
          <div className="mt-24">
            <h4 className="label">Transferred out (demo)</h4>
            {transferred.map((n) => (
              <div key={n.id} className="list-btn">
                <span>{n.name}</span>
                <Button size="sm" variant="secondary" onClick={() => demoTransferNft(n.id, false)}>Transfer back</Button>
              </div>
            ))}
          </div>
        )}
      </div>
      <NftSheet nft={sel} onClose={() => setSel(null)} />
    </div>
  );
}

function NftSheet({ nft, onClose }: { nft: NFTAsset | null; onClose: () => void }) {
  const db = useDB((d) => d);
  const { toast, confirm } = useUI();
  const [mode, setMode] = useState<'view' | 'link'>('view');
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const close = () => { onClose(); setTimeout(() => setMode('view'), 300); };
  if (!nft) return <Sheet open={false} onClose={close}>{null}</Sheet>;
  const linked = db.albums.find((a) => a.nftId === nft.id && a.ownerId === db.sessionUserId);
  const mine = db.albums.filter((a) => a.ownerId === db.sessionUserId);
  const wallet = walletFor(db);

  return (
    <Sheet open={!!nft} onClose={close} title={mode === 'link' ? 'Link to album' : nft.name} tall>
      {mode === 'view' ? (
        <div className="stack gap-14">
          <div className="nft-hero"><img src={nft.image} alt={nft.name} /><span className="nft-frame" /></div>
          <div className="row between">
            <div><strong>{nft.collection}</strong><div className="small muted">Token #{nft.tokenId}</div></div>
            {linked ? <NftBadge /> : <DemoTag>Demo Collectible</DemoTag>}
          </div>
          <dl className="meta-list">
            <div><dt>Network</dt><dd>{nft.network}{nft.simulated && ' (simulated)'}</dd></div>
            <div><dt>Standard</dt><dd>{nft.standard}</dd></div>
            <div><dt>Contract</dt><dd><code>{shortAddress(nft.contract)}</code></dd></div>
            <div><dt>Owner</dt><dd><code>{shortAddress(nft.ownerWallet)}</code> {wallet && nft.ownerWallet === wallet.address && '(you)'}</dd></div>
            <div><dt>Ownership</dt><dd>Demo Verification · not checked on-chain</dd></div>
            <div><dt>Linked album</dt><dd>{linked ? <Link to={`/album/${linked.id}`} onClick={close} className="link">{linked.title}</Link> : 'None'}</dd></div>
          </dl>
          {linked ? (
            <div className="row gap-10">
              <Button block variant="secondary" onClick={() => { close(); nav(`/album/${linked.id}`); }}>Open album</Button>
              <Button block variant="ghost" className="danger-text" icon={<Unlink size={16} />} loading={busy} onClick={async () => {
                if (!(await confirm({ title: 'Unlink collectible?', body: `“${linked.title}” will no longer be associated with ${nft.name}.${linked.privacy === 'nft' ? ' The album will switch to Private.' : ''}`, confirmLabel: 'Unlink', danger: true }))) return;
                setBusy(true);
                try { await unlinkNft(linked.id); toast('Collectible unlinked'); } catch (e) { toast(errMsg(e), 'error'); } finally { setBusy(false); }
              }}>Unlink</Button>
            </div>
          ) : (
            <Button block icon={<Link2 size={16} />} onClick={() => setMode('link')}>Link to Album</Button>
          )}
          <button className="list-btn" onClick={async () => {
            if (!(await confirm({ title: 'Simulate a transfer?', body: 'Pretend this collectible was sold or sent to another wallet. Any album gated by it will lock again for you until it’s transferred back.', confirmLabel: 'Simulate transfer' }))) return;
            await demoTransferNft(nft.id, true);
            toast('Collectible transferred (demo) — gated access revoked', 'info');
            close();
          }}>
            <span><ArrowLeftRight size={16} /> Simulate ownership transfer</span><DemoTag />
          </button>
        </div>
      ) : (
        <div className="stack gap-10">
          <p className="small muted">Choose an album for <strong>{nft.name}</strong>. This doesn’t transfer, mint or alter the NFT, and doesn’t change who can see the album.</p>
          {mine.map((a) => (
            <button key={a.id} className="list-btn" disabled={busy} onClick={async () => {
              setBusy(true);
              try {
                await linkNft(a.id, nft.id);
                toast(`Collectible Linked to ${a.title} ✦`);
                close();
                nav(`/album/${a.id}`);
              } catch (e) { toast(errMsg(e), 'error'); } finally { setBusy(false); }
            }}>
              <span>{a.title}</span>
              <small>{a.nftId ? `replaces ${db.nfts.find((n) => n.id === a.nftId)?.name}` : `${a.photoIds.length} photos`}</small>
            </button>
          ))}
          <Button variant="ghost" onClick={() => setMode('view')}>Back</Button>
        </div>
      )}
    </Sheet>
  );
}
