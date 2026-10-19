import { Globe, Link2, Lock, Gem, Users, type LucideIcon } from 'lucide-react';
import type { Privacy, ThemeId } from '../backend/types';

export const PRIVACY: Record<Privacy, { label: string; short: string; icon: LucideIcon; who: string; tone: string }> = {
  private: { label: 'Private', short: 'Private', icon: Lock, who: 'Only you can see this album.', tone: 'neutral' },
  invite: { label: 'Invite Only', short: 'Invite Only', icon: Users, who: 'Only people you invite by email can open it.', tone: 'peach' },
  link: { label: 'Shared by Link', short: 'Shared', icon: Link2, who: 'Anyone with an active link (and passcode, if set) can view it.', tone: 'mint' },
  public: { label: 'Public', short: 'Public', icon: Globe, who: 'Anyone can find it in Discover and view it.', tone: 'mint' },
  nft: { label: 'NFT Owner Access', short: 'NFT Access', icon: Gem, who: 'Only a wallet that currently owns the selected collectible can unlock it.', tone: 'lavender' },
};

export const PRIVACY_ORDER: Privacy[] = ['private', 'invite', 'link', 'public', 'nft'];

export const THEMES: Record<ThemeId, { label: string; swatch: string[]; note: string }> = {
  classic: { label: 'Classic White', swatch: ['#FFFFFF', '#202124'], note: 'Clean and timeless' },
  lavender: { label: 'Soft Lavender', swatch: ['#F1EEFF', '#8875E8'], note: 'Calm, dreamy tones' },
  editorial: { label: 'Warm Editorial', swatch: ['#FFF4EC', '#9A5B3C'], note: 'Serif type, magazine feel' },
  gallery: { label: 'Minimal Gallery', swatch: ['#F4F4F1', '#111111'], note: 'Framed, airy spacing' },
  midnight: { label: 'Midnight Collection', swatch: ['#14141B', '#C9BFFF'], note: 'Dark, cinematic' },
};

export const THEME_ORDER: ThemeId[] = ['classic', 'lavender', 'editorial', 'gallery', 'midnight'];
