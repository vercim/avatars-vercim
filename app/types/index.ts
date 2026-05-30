export interface RobloxUser {
  id: number;
  name: string;
  displayName: string;
  description: string;
  created: string;
  isBanned: boolean;
  externalAppDisplayName: string | null;
  hasVerifiedBadge: boolean;
}

export interface AssetInfo {
  assetId: number;
  name: string;
  price: number | null;
  /** Friendly item category, e.g. "Hair", "Hat" (null when unknown). */
  assetType: string | null;
  description: string;
  thumbnailUrl: string;
  catalogUrl: string;
  worn?: boolean;
}

export interface UserData {
  user: RobloxUser;
  avatarThumbnail: string;
  avatarHeadshot: string;
  wornItems: AssetInfo[];
}

export interface InventoryPage {
  items: AssetInfo[];
  hasMore: boolean;
  total: number;
  available: boolean;
}
