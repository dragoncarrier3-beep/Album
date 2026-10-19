import { CheckCircle2, Copy, Gem, ShieldCheck, Unplug, Wallet as WalletIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { disconnectWallet, myCollectibles, walletFor } from '../backend/api';
import { useDB } from '../lib/hooks';
import { Button, DemoTag, TopBar, useUI } from '../ui/kit';
import { SignMessageCard } from './Gate';
import { copyText } from './Share';

export function Wallet() {
  const db = useDB((d) => d);
  const wallet = walletFor(db);
  const { toast, confirm } = useUI();

  return (
    <div className="screen">
      <TopBar />
      <div className="pad stack gap-16">
        <div>
          <h1 className="display">{wallet ? 'Your wallet' : 'Connect your wallet'}</h1>
          <p className="lede">Connect a supported wallet to view and verify collectibles you own.</p>
        </div>

        {wallet ? (
          <>
            <div className="wallet-connected">
              <div className="row between">
                <span className="status-pill"><CheckCircle2 size={14} /> Connected</span>
                {wallet.mode === 'demo' && <DemoTag>Demo Wallet Mode</DemoTag>}
              </div>
              <div className="wallet-addr">
                <code>{wallet.address}</code>
                <button className="icon-btn" aria-label="Copy address" onClick={async () => (await copyText(wallet.address)) && toast('Address copied')}><Copy size={16} /></button>
              </div>
              <dl className="meta-list compact">
                <div><dt>Network</dt><dd>{wallet.network}{wallet.mode === 'demo' && ' (simulated)'}</dd></div>
                <div><dt>Verified</dt><dd>{wallet.verifiedAt ? new Date(wallet.verifiedAt).toLocaleString() : '—'} · signed challenge</dd></div>
                <div><dt>Collectibles</dt><dd>{myCollectibles(db).length}</dd></div>
              </dl>
            </div>
            {wallet.mode === 'demo' && <p className="small muted">Demo Wallet Mode simulates a wallet so you can explore without crypto. Nothing here is verified on a blockchain.</p>}
            <Link to="/collectibles" className="list-btn"><span><Gem size={16} /> View My Collectibles</span></Link>
            <Button variant="secondary" icon={<Unplug size={16} />} onClick={async () => {
              if (await confirm({ title: 'Disconnect wallet?', body: 'Albums unlocked with your collectibles will lock again until you reconnect.', confirmLabel: 'Disconnect', danger: true })) {
                disconnectWallet();
                toast('Wallet disconnected');
              }
            }}>Disconnect</Button>
          </>
        ) : (
          <>
            <SignMessageCard onDone={() => toast('Wallet connected · Demo Wallet Mode')} />
          </>
        )}

        <div className="assure">
          <ShieldCheck size={18} />
          <div>
            <strong>What LUMEN will never ask for</strong>
            <ul>
              <li>Your seed phrase or private keys</li>
              <li>Transaction approvals or token spending</li>
              <li>Gas fees or purchases</li>
            </ul>
          </div>
        </div>
        <p className="xsmall muted center"><WalletIcon size={12} /> Real wallets (WalletConnect / Reown AppKit, EVM) plug into the same adapter in the next phase.</p>
      </div>
    </div>
  );
}
