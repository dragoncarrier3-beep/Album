import { ChevronRight, HardDrive, HelpCircle, Info, Moon, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { updateSettings, walletFor } from '../backend/api';
import { shortAddress } from '../backend/nft';
import { resetDB } from '../backend/store';
import { useDB, useMe } from '../lib/hooks';
import { DemoTag, Segmented, TopBar, Toggle, useUI } from '../ui/kit';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="settings-section">
      <h2 className="label">{title}</h2>
      <div className="card-list">{children}</div>
    </section>
  );
}

function Row({ label, sub, children, to }: { label: string; sub?: string; children?: React.ReactNode; to?: string }) {
  const body = (
    <>
      <span className="grow">
        <span className="row-label">{label}</span>
        {sub && <small>{sub}</small>}
      </span>
      {children}
      {to && <ChevronRight size={18} className="muted" />}
    </>
  );
  return to ? <Link to={to} className="set-row">{body}</Link> : <div className="set-row">{body}</div>;
}

export function Settings() {
  const s = useDB((db) => db.settings);
  const me = useMe()!;
  const wallet = useDB((db) => walletFor(db));
  const nav = useNavigate();
  const { confirm, toast } = useUI();
  const [usage, setUsage] = useState<string>('Calculating…');
  const myUploads = useDB((db) => db.photos.filter((p) => p.ownerId === db.sessionUserId && p.src.startsWith('idb:')));

  useEffect(() => {
    const bytes = myUploads.reduce((n, p) => n + (p.size ?? 0), 0);
    setUsage(`${(bytes / 1048576).toFixed(1)} MB in ${myUploads.length} uploaded photo${myUploads.length === 1 ? '' : 's'}`);
  }, [myUploads.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="screen">
      <TopBar title="Settings" />
      <div className="pad">
        <Section title="Account">
          <Row label={me.name} sub={me.email} to="/profile/edit" />
        </Section>

        <Section title="Appearance">
          <div className="set-row col">
            <span className="row-label"><Moon size={16} /> Theme</span>
            <Segmented label="Theme" value={s.appearance} onChange={(v) => updateSettings({ appearance: v })} options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'system', label: 'System' }]} />
          </div>
          <div className="set-row col">
            <span className="row-label">Reduce motion</span>
            <Segmented label="Reduce motion" value={s.reducedMotion} onChange={(v) => updateSettings({ reducedMotion: v })} options={[{ value: 'system', label: 'System' }, { value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]} />
          </div>
        </Section>

        <Section title="Privacy">
          <Row label="Privacy Control Center" sub="Album visibility, links, invitations, data export" to="/privacy" />
        </Section>

        <Section title="Notifications">
          <Row label="Shares & invitations"><Toggle label="Shares & invitations" checked={s.notifyShares} onChange={(v) => updateSettings({ notifyShares: v })} /></Row>
          <Row label="Comments & reactions"><Toggle label="Comments & reactions" checked={s.notifyComments} onChange={(v) => updateSettings({ notifyComments: v })} /></Row>
          <Row label="Collectible activity"><Toggle label="Collectible activity" checked={s.notifyCollectibles} onChange={(v) => updateSettings({ notifyCollectibles: v })} /></Row>
        </Section>

        <Section title="Storage">
          <Row label="Usage" sub={usage}><HardDrive size={18} className="muted" /></Row>
          <div className="set-row col">
            <span className="row-label">Upload quality</span>
            <Segmented label="Upload quality" value={s.uploadPolicy} onChange={(v) => updateSettings({ uploadPolicy: v })} options={[{ value: 'original', label: 'Original' }, { value: 'optimized', label: 'Optimized (2048px)' }]} />
          </div>
        </Section>

        <Section title="Connected Wallet">
          <Row label={wallet ? shortAddress(wallet.address) : 'Not connected'} sub={wallet ? `${wallet.mode === 'demo' ? 'Demo Wallet Mode' : wallet.network}` : 'Connect to link collectibles'} to="/wallet" />
        </Section>

        <Section title="Demo tools">
          <Row label="Simulate network failure" sub="The next upload fails part-way so you can try Retry">
            <Toggle label="Simulate network failure" checked={s.simulateNetworkFailure} onChange={(v) => updateSettings({ simulateNetworkFailure: v })} />
          </Row>
          <Row label="Ownership verification" sub={`Scenario: ${s.demoScenario.replace('-', ' ')}`}><DemoTag /></Row>
          <button className="set-row danger-text" onClick={async () => {
            if (await confirm({ title: 'Reset demo data?', body: 'Restores the original albums, photos and collectibles. Uploaded photos will be removed.', confirmLabel: 'Reset', danger: true })) {
              resetDB(true);
              toast('Demo data reset');
              nav('/');
            }
          }}><RotateCcw size={16} /> <span className="grow left">Reset demo data</span></button>
        </Section>

        <Section title="Help">
          <Row label="How sharing works" sub="Links are view-only, can expire, use a passcode, and can be revoked at any time."><HelpCircle size={18} className="muted" /></Row>
          <Row label="What is an NFT-linked album?" sub="An album associated with a collectible you own. Linking never transfers or changes the NFT."><HelpCircle size={18} className="muted" /></Row>
          <Row label="Contact support" sub="support@lumen.demo" />
        </Section>

        <Section title="About">
          <Row label="LUMEN" sub="Version 0.1 · Interactive MVP demo"><Info size={18} className="muted" /></Row>
          <Row label="Sample photography" sub="Unsplash (via Lorem Picsum), free to use" />
        </Section>
      </div>
    </div>
  );
}
