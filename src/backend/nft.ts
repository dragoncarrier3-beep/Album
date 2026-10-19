import type { NFTAsset, WalletConnection } from './types';

/**
 * Ownership verification adapter. In production this runs inside the
 * `verify-nft-ownership` Edge Function (see /supabase/functions) — never only in the client.
 */
export interface VerificationResult {
  owned: boolean;
  reason?: 'not_owned' | 'wrong_network' | 'unavailable' | 'disconnected';
  checkedAt: string;
  simulated: boolean;
}

export interface OwnershipVerifier {
  verify(wallet: WalletConnection | undefined, nft: NFTAsset): Promise<VerificationResult>;
}

export type DemoScenario = 'owns' | 'not-owned' | 'wrong-network' | 'unavailable';

/** Simulated verifier — clearly labelled "Demo Verification" in the UI. */
export class DemoVerifier implements OwnershipVerifier {
  constructor(private scenario: () => DemoScenario) {}

  async verify(wallet: WalletConnection | undefined, nft: NFTAsset): Promise<VerificationResult> {
    const checkedAt = new Date().toISOString();
    const base = { checkedAt, simulated: true };
    if (!wallet) return { ...base, owned: false, reason: 'disconnected' };
    const s = this.scenario();
    if (s === 'unavailable') return { ...base, owned: false, reason: 'unavailable' };
    if (s === 'wrong-network' || wallet.network !== nft.network) return { ...base, owned: false, reason: 'wrong_network' };
    if (s === 'not-owned') return { ...base, owned: false, reason: 'not_owned' };
    const owned = nft.ownerWallet.toLowerCase() === wallet.address.toLowerCase();
    return { ...base, owned, reason: owned ? undefined : 'not_owned' };
  }
}

/**
 * Real EVM verifier (ERC-721 `ownerOf`, ERC-1155 `balanceOf`) over JSON-RPC.
 * Wired up by the Edge Function when NFT_RPC_URL is configured (e.g. Sepolia testnet).
 */
export class EvmVerifier implements OwnershipVerifier {
  constructor(private rpcUrl: string, private chainName: string) {}

  private async call(to: string, data: string): Promise<string> {
    const res = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] }),
    });
    if (!res.ok) throw new Error('rpc_unavailable');
    const json = await res.json();
    if (json.error) throw new Error(json.error.message);
    return json.result as string;
  }

  async verify(wallet: WalletConnection | undefined, nft: NFTAsset): Promise<VerificationResult> {
    const checkedAt = new Date().toISOString();
    const base = { checkedAt, simulated: false };
    if (!wallet) return { ...base, owned: false, reason: 'disconnected' };
    if (wallet.network !== this.chainName || nft.network !== this.chainName) return { ...base, owned: false, reason: 'wrong_network' };
    const id = BigInt(nft.tokenId).toString(16).padStart(64, '0');
    const addr = wallet.address.toLowerCase().replace('0x', '').padStart(64, '0');
    try {
      if (nft.standard === 'ERC-721') {
        const out = await this.call(nft.contract, '0x6352211e' + id); // ownerOf(uint256)
        const owner = '0x' + out.slice(-40);
        const owned = owner.toLowerCase() === wallet.address.toLowerCase();
        return { ...base, owned, reason: owned ? undefined : 'not_owned' };
      }
      const out = await this.call(nft.contract, '0x00fdd58e' + addr + id); // balanceOf(address,uint256)
      const owned = BigInt(out) > 0n;
      return { ...base, owned, reason: owned ? undefined : 'not_owned' };
    } catch {
      return { ...base, owned: false, reason: 'unavailable' };
    }
  }
}

export function shortAddress(a: string) {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}
