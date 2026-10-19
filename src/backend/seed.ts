import meta from '../data/photoMeta.json';
import type { Album, Category, DB, NFTAsset, Photo, Privacy, ThemeId, User } from './types';

const M = meta as Record<string, { w: number; h: number; author: string }>;

export const DEMO_USER_ID = 'u-olivia';
export const DEMO_WALLET = '0xD3m0a1F5c0bE7b2C4e9A8d61E0f3B5a7C9e2Lm3n';

const days = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

const users: User[] = [
  {
    id: DEMO_USER_ID,
    name: 'Olivia Parker',
    username: 'oliviaparker',
    email: 'olivia@lumen.demo',
    password: 'demo1234',
    avatar: '/photos/avatar.jpg',
    bio: 'Collecting light, one summer at a time. Based in London.',
    createdAt: days(400),
  },
  { id: 'u-emma', name: 'Emma Parker', username: 'emmap', email: 'emma@lumen.demo', createdAt: days(300) },
  { id: 'u-erik', name: 'Erik Lund', username: 'eriklund', email: 'erik@lumen.demo', bio: 'Coastlines & quiet places.', createdAt: days(500) },
  { id: 'u-maya', name: 'Maya Chen', username: 'mayachen', email: 'maya@lumen.demo', bio: 'Slow living, warm light.', createdAt: days(260) },
  { id: 'u-noah', name: 'Noah Bennett', username: 'noahb', email: 'noah@lumen.demo', bio: 'Mountains first.', createdAt: days(200) },
  { id: 'u-ines', name: 'Inès Moreau', username: 'inesm', email: 'ines@lumen.demo', bio: 'Shapes, shadows, lines.', createdAt: days(320) },
  { id: 'u-nocturne', name: 'Studio Nocturne', username: 'studionocturne', email: 'hello@nocturne.demo', bio: 'A collective photographing the city at night.', createdAt: days(150) },
];

type Spec = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  theme: ThemeId;
  privacy: Privacy;
  category?: Category;
  nftId?: string;
  updated: number;
  photos: [number, string][];
};

const specs: Spec[] = [
  {
    id: 'a-italy', ownerId: DEMO_USER_ID, title: 'Summer in Italy', theme: 'editorial', privacy: 'private', category: 'Travel', updated: 2,
    description: 'Three weeks between Tuscany, Milan and the coast — long lunches, warm stone and golden evenings.',
    photos: [
      [116, 'Cypress rows outside Montepulciano'], [257, 'Evening light on the Navigli, Milan'], [308, 'Laundry lines in a quiet alley'],
      [164, 'Boats along the canal'], [49, 'White houses above the sea'], [162, 'The coastline from the ridge road'],
      [78, 'An old wooden door we kept walking past'], [75, 'Grapes ripening in late August'], [163, 'Our favourite café terrace'],
      [288, 'Rooftops of the old town'], [63, 'First espresso of the day'], [292, 'Market haul for dinner'],
      [129, 'Sunset bench, last night in town'], [211, 'Harbour morning'], [128, 'Lake view from the villa'],
      [155, 'Train tracks along the coast'], [199, 'An empty beach before breakfast'], [215, 'Sand, sun, nothing else'],
    ],
  },
  {
    id: 'a-golden', ownerId: DEMO_USER_ID, title: 'Golden Moments', theme: 'lavender', privacy: 'link', category: 'Lifestyle', updated: 5,
    description: 'The hour before sunset, collected over a year.',
    photos: [
      [64, 'Wildflowers and sunglasses'], [110, 'Trees on the horizon'], [206, 'Farmhouse at golden hour'], [109, 'Sunlight through the grass'],
      [112, 'Wheat fields in July'], [173, 'Running into the light'], [103, 'Lazy Sunday afternoon'], [33, 'Backlit meadow'],
    ],
  },
  {
    id: 'a-city', ownerId: DEMO_USER_ID, title: 'City After Dark', theme: 'midnight', privacy: 'public', category: 'Art', nftId: 'nft-golden-frame', updated: 9,
    description: 'Night walks across bridges, markets and rainy streets.',
    photos: [
      [43, 'Brooklyn Bridge, long exposure'], [249, 'Skyline over the water'], [122, 'St Paul’s from the river'],
      [195, 'String lights over the market'], [223, 'Bokeh on a rainy evening'], [232, 'Street lamps in the snow'],
    ],
  },
  {
    id: 'a-weekend', ownerId: DEMO_USER_ID, title: 'Weekend Escapes', theme: 'gallery', privacy: 'private', category: 'Nature', updated: 14,
    description: 'Short trips, long walks.',
    photos: [
      [191, 'Mountain road, early morning'], [204, 'The old railway line'], [217, 'The jetty at the lake'], [287, 'Green ridge walk'], [235, 'Snow on the peaks'],
    ],
  },
  {
    id: 'a-family', ownerId: DEMO_USER_ID, title: 'Family Stories', theme: 'classic', privacy: 'invite', category: 'Family', updated: 21,
    description: 'Little moments at home, shared with the family.',
    photos: [[237, 'Biscuit waiting for dinner'], [146, 'The red tricycle'], [169, 'Garden afternoons']],
  },
  {
    id: 'a-digital', ownerId: DEMO_USER_ID, title: 'Digital Dreams', theme: 'midnight', privacy: 'nft', category: 'Digital Collectibles', nftId: 'nft-eternal', updated: 30,
    description: 'Light, colour and sound — reserved for collectors of Eternal Moments.',
    photos: [[56, 'Bokeh study no. 1'], [158, 'Stage lights, Berlin']],
  },
  // ---- Community content (Discover / shared with me) ----
  {
    id: 'a-nordic', ownerId: 'u-erik', title: 'Nordic Coastlines', theme: 'gallery', privacy: 'public', category: 'Travel', updated: 3,
    description: 'Cold water, smooth stones and endless horizons along the northern coast.',
    photos: [[12, 'Low tide'], [13, 'Pebble shore'], [14, 'Rocks at the edge'], [16, 'Island line'], [37, 'Cliffside blooms'], [147, 'Open water']],
  },
  {
    id: 'a-green', ownerId: 'u-noah', title: 'Into the Wild Green', theme: 'classic', privacy: 'public', category: 'Nature', updated: 6,
    description: 'Forest floors, waterfalls and the colour green.',
    photos: [[15, 'Hidden falls'], [28, 'River gorge'], [159, 'Morning dew'], [189, 'Leaf, after rain'], [216, 'Forest path'], [127, 'Moss bed']],
  },
  {
    id: 'a-mornings', ownerId: 'u-maya', title: 'Slow Mornings', theme: 'editorial', privacy: 'public', category: 'Lifestyle', updated: 2,
    description: 'Tea, honey and soft window light.',
    photos: [[30, 'The stamp mug'], [225, 'Tea with flowers'], [312, 'Honey'], [201, 'Desk at 8am'], [305, 'Window plant'], [42, 'The empty café']],
  },
  {
    id: 'a-mountain', ownerId: 'u-noah', title: 'Mountain Light', theme: 'lavender', privacy: 'public', category: 'Travel', updated: 11,
    description: 'Ridges and peaks across four seasons.',
    photos: [[29, 'Granite valley'], [256, 'First snow'], [260, 'Pines in winter'], [296, 'The range at dusk'], [231, 'Ridge line'], [66, 'Cloud ceiling']],
  },
  {
    id: 'a-desert', ownerId: 'u-ines', title: 'Desert Lines', theme: 'gallery', privacy: 'public', category: 'Art', updated: 8,
    description: 'Minimal compositions in sand and shadow.',
    photos: [[196, 'Footprints'], [261, 'The ridge'], [185, 'Flat horizon'], [184, 'Dune at dusk'], [247, 'Red rock'], [141, 'Soft hills']],
  },
  {
    id: 'a-mono', ownerId: 'u-ines', title: 'Monochrome City', theme: 'classic', privacy: 'public', category: 'Art', updated: 16,
    description: 'Black and white architecture studies.',
    photos: [[238, 'Midtown'], [214, 'Grid'], [290, 'Facade'], [240, 'Stairs'], [61, 'Old town from above'], [22, 'Crossing']],
  },
  {
    id: 'a-paws', ownerId: 'u-emma', title: 'Animal Friends', theme: 'lavender', privacy: 'public', category: 'Family', updated: 4,
    description: 'Every animal we met this year.',
    photos: [[40, 'Whiskers'], [200, 'Highland cow'], [219, 'Leopard walk'], [244, 'Pelican on the pier'], [258, 'Birds in flight']],
  },
  {
    id: 'a-neon', ownerId: 'u-nocturne', title: 'Neon Archive', theme: 'midnight', privacy: 'public', category: 'Digital Collectibles', nftId: 'nft-neon-ext', updated: 7,
    description: 'Public preview of the Nocturne collection, linked to the Neon Archive collectible.',
    photos: [[274, 'Times Square'], [242, 'Rail yard at night'], [220, 'Foggy lights']],
  },
  {
    id: 'a-members', ownerId: 'u-nocturne', title: 'Nocturne Members Room', theme: 'midnight', privacy: 'nft', category: 'Digital Collectibles', nftId: 'nft-bloom', updated: 1,
    description: 'Unreleased night photography — unlocked for holders of Digital Bloom #027.',
    photos: [[310, 'Smoke and light'], [117, 'The tunnel concert']],
  },
];

const nfts: NFTAsset[] = [
  {
    id: 'nft-golden-frame', name: 'Golden Frame #001', collection: 'LUMEN Origins', tokenId: '1', standard: 'ERC-721',
    network: 'Demo', contract: '0xDEM0000000000000000000000000000000000001', image: '/photos/thumb/173.jpg', ownerWallet: DEMO_WALLET, simulated: true,
  },
  {
    id: 'nft-eternal', name: 'Eternal Moments #014', collection: 'Memory Editions', tokenId: '14', standard: 'ERC-1155',
    network: 'Demo', contract: '0xDEM0000000000000000000000000000000000002', image: '/photos/thumb/175.jpg', ownerWallet: DEMO_WALLET, simulated: true,
  },
  {
    id: 'nft-bloom', name: 'Digital Bloom #027', collection: 'Digital Gardens', tokenId: '27', standard: 'ERC-721',
    network: 'Demo', contract: '0xDEM0000000000000000000000000000000000003', image: '/photos/thumb/82.jpg', ownerWallet: DEMO_WALLET, simulated: true,
  },
  {
    id: 'nft-neon-ext', name: 'Neon Archive #003', collection: 'Nocturne Editions', tokenId: '3', standard: 'ERC-721',
    network: 'Demo', contract: '0xDEM0000000000000000000000000000000000004', image: '/photos/thumb/274.jpg', ownerWallet: '0xN0ct0000000000000000000000000000000000rn', simulated: true,
  },
];

export function createSeed(): DB {
  const photos: Photo[] = [];
  const albums: Album[] = specs.map((s) => {
    const ids = s.photos.map(([pid, caption], i) => {
      const id = `p-${s.id.slice(2)}-${pid}`;
      const m = M[String(pid)];
      photos.push({
        id, albumId: s.id, ownerId: s.ownerId,
        src: `/photos/full/${pid}.jpg`, thumb: `/photos/thumb/${pid}.jpg`,
        w: m.w, h: m.h, name: `IMG_${2000 + pid}.jpg`, caption, credit: m.author, mime: 'image/jpeg',
        createdAt: days(s.updated + i * 0.3),
      });
      return id;
    });
    return {
      id: s.id, ownerId: s.ownerId, title: s.title, description: s.description, theme: s.theme, privacy: s.privacy,
      category: s.category, nftId: s.nftId, photoIds: ids, coverPhotoId: ids[0],
      createdAt: days(s.updated + 30), updatedAt: days(s.updated),
    };
  });

  return {
    version: 3,
    sessionUserId: null,
    onboarded: false,
    users,
    albums,
    photos,
    favorites: [
      { userId: DEMO_USER_ID, photoId: 'p-italy-116' },
      { userId: DEMO_USER_ID, photoId: 'p-italy-129' },
      { userId: DEMO_USER_ID, photoId: 'p-golden-173' },
    ],
    shareLinks: [
      { id: 'sl-golden', albumId: 'a-golden', token: 'gm7Kq2xPa9', enabled: true, role: 'viewer', views: 12, createdAt: days(5) },
    ],
    invitations: [
      { id: 'inv-emma', albumId: 'a-family', email: 'emma@lumen.demo', role: 'contributor', status: 'accepted', userId: 'u-emma', createdAt: days(20) },
      { id: 'inv-james', albumId: 'a-family', email: 'james.parker@example.com', role: 'viewer', status: 'pending', createdAt: days(3) },
      { id: 'inv-olivia-members', albumId: 'a-members', email: 'olivia@lumen.demo', role: 'viewer', status: 'accepted', userId: DEMO_USER_ID, createdAt: days(1) },
    ],
    nfts,
    wallets: {},
    grants: [],
    notifications: [
      { id: 'n1', title: 'Studio Nocturne shared an album with you', body: '“Nocturne Members Room” is unlocked with Digital Bloom #027.', link: '/album/a-members', read: false, createdAt: days(0.2) },
      { id: 'n2', title: 'Emma added to Family Stories', body: 'Emma Parker accepted your invitation as a contributor.', link: '/album/a-family', read: false, createdAt: days(1.5) },
      { id: 'n3', title: 'Your link was viewed 12 times', body: 'Golden Moments is being enjoyed by people you shared it with.', link: '/album/a-golden', read: true, createdAt: days(3) },
    ],
    audit: [],
    settings: {
      appearance: 'light', reducedMotion: 'system', uploadPolicy: 'original',
      notifyShares: true, notifyComments: true, notifyCollectibles: true,
      simulateNetworkFailure: false, demoScenario: 'owns',
    },
  };
}
