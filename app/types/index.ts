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
  inventoryItems: AssetInfo[];
}
