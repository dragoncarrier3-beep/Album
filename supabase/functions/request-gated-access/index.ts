// Supabase Edge Function (Deno): re-verifies NFT ownership server-side and issues a short-lived grant.
// Never trust a client-side ownership check. Deploy: `supabase functions deploy request-gated-access`.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const RPC_URL = Deno.env.get('NFT_RPC_URL')!; // e.g. Sepolia JSON-RPC
const CHAIN_ID = Number(Deno.env.get('NFT_CHAIN_ID') ?? '11155111');

async function ethCall(to: string, data: string): Promise<string> {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] }),
  });
  if (!res.ok) throw new Error('rpc_unavailable');
  const j = await res.json();
  if (j.error) throw new Error('rpc_error');
  return j.result;
}

async function owns(standard: string, contract: string, tokenId: string, wallet: string): Promise<boolean> {
  const id = BigInt(tokenId).toString(16).padStart(64, '0');
  if (standard === 'ERC-721') {
    const out = await ethCall(contract, '0x6352211e' + id); // ownerOf(uint256)
    return ('0x' + out.slice(-40)).toLowerCase() === wallet.toLowerCase();
  }
  const addr = wallet.toLowerCase().replace('0x', '').padStart(64, '0');
  return BigInt(await ethCall(contract, '0x00fdd58e' + addr + id)) > 0n; // balanceOf(address,uint256)
}

Deno.serve(async (req) => {
  const auth = req.headers.get('Authorization') ?? '';
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: { user } } = await admin.auth.getUser(auth.replace('Bearer ', ''));
  if (!user) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  const { albumId } = await req.json();
  const { data: policy } = await admin
    .from('nft_access_policies')
    .select('grant_ttl_seconds, nft:nft_assets(chain_id, contract, token_id, standard)')
    .eq('album_id', albumId)
    .single();
  if (!policy) return Response.json({ error: 'not_gated' }, { status: 400 });

  const nft = policy.nft as unknown as { chain_id: number; contract: string; token_id: string; standard: string };
  if (nft.chain_id !== CHAIN_ID) return Response.json({ error: 'unsupported_chain' }, { status: 400 });

  const { data: wallets } = await admin.from('wallet_connections').select('address, chain_id').eq('user_id', user.id);
  const wallet = wallets?.find((w) => w.chain_id === nft.chain_id);
  if (!wallet) return Response.json({ error: wallets?.length ? 'wrong_network' : 'wallet_disconnected' }, { status: 403 });

  let ok = false;
  try {
    ok = await owns(nft.standard, nft.contract, String(nft.token_id), wallet.address);
  } catch {
    return Response.json({ error: 'verification_unavailable' }, { status: 503 });
  }

  await admin.from('nft_access_grants').delete().match({ album_id: albumId, user_id: user.id });
  await admin.from('audit_events').insert({ actor_id: user.id, action: ok ? 'nft_access.granted' : 'nft_access.denied', target_id: albumId });
  if (!ok) return Response.json({ error: 'not_owned' }, { status: 403 });

  const expires = new Date(Date.now() + policy.grant_ttl_seconds * 1000).toISOString();
  await admin.from('nft_access_grants').insert({ album_id: albumId, user_id: user.id, wallet: wallet.address, expires_at: expires });
  return Response.json({ granted: true, expiresAt: expires });
});
