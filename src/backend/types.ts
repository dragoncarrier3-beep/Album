export type Privacy = 'private' | 'invite' | 'link' | 'public' | 'nft';
export type ThemeId = 'classic' | 'lavender' | 'editorial' | 'gallery' | 'midnight';
export type Category = 'Travel' | 'Lifestyle' | 'Nature' | 'Art' | 'Family' | 'Digital Collectibles';
export type Role = 'viewer' | 'contributor';

export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  password?: string; // demo only — real build uses Supabase Auth
  avatar?: string;
  bio?: string;
  createdAt: string;
}

export interface Photo {
  id: string;
  albumId: string;
  ownerId: string;
  /** Static path for seeded content, or `blob:` key (`idb:<id>`) for user uploads. */
  src: string;
  thumb: string;
  w: number;
  h: number;
  name: string;
  caption: string;
  credit?: string;
  mime: string;
  size?: number;
  createdAt: string;
}

export interface Album {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  coverPhotoId?: string;
  theme: ThemeId;
  privacy: Privacy;
  photoIds: string[];
  category?: Category;
  nftId?: string; // linked collectible (AlbumNFTLink)
  createdAt: string;
  updatedAt: string;
}

export interface ShareLink {
  id: string;
  albumId: string;
  token: string;
  enabled: boolean;
  expiresAt?: string;
  passcode?: string;
  role: 'viewer';
  views: number;
  createdAt: string;
  revokedAt?: string;
}

export interface Invitation {
  id: string;
  albumId: string;
  email: string;
  role: Role;
  status: 'pending' | 'accepted';
  userId?: string;
  createdAt: string;
}

export interface NFTAsset {
  id: string;
  name: string;
  collection: string;
  tokenId: string;
  standard: 'ERC-721' | 'ERC-1155';
  network: string;
  contract: string;
  image: string;
  ownerWallet: string;
  simulated: boolean;
}

export interface WalletConnection {
  address: string;
  network: string;
  mode: 'demo' | 'evm';
  verifiedAt?: string;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  at: string;
  actor: string;
  action: string;
  target?: string;
}

export interface AccessGrant {
  albumId: string;
  userId: string;
  expiresAt: number;
}

export interface Settings {
  appearance: 'light' | 'dark' | 'system';
  reducedMotion: 'system' | 'on' | 'off';
  uploadPolicy: 'original' | 'optimized';
  notifyShares: boolean;
  notifyComments: boolean;
  notifyCollectibles: boolean;
  simulateNetworkFailure: boolean;
  demoScenario: 'owns' | 'not-owned' | 'wrong-network' | 'unavailable';
}

export interface DB {
  version: number;
  sessionUserId: string | null;
  onboarded: boolean;
  users: User[];
  albums: Album[];
  photos: Photo[];
  favorites: { userId: string; photoId: string }[];
  shareLinks: ShareLink[];
  invitations: Invitation[];
  nfts: NFTAsset[];
  wallets: Record<string, WalletConnection | undefined>;
  grants: AccessGrant[];
  notifications: Notification[];
  audit: AuditEvent[];
  settings: Settings;
}
