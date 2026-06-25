# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev       # start dev server (Next.js)
pnpm build     # production build
pnpm lint      # run ESLint
```

Environment variable required: `ROBLOX_API_KEY` — the Roblox Open Cloud API key. Without it, the server throws at startup.

## Architecture

Next.js 16 app (App Router) deployed on Vercel. Single-page application: `app/page.tsx` is the only route; all data fetching flows through Next.js Route Handlers under `app/api/`.

### API routes

| Route | Purpose |
|---|---|
| `GET /api/user/[userId]` | Fetches user profile, worn avatar items with prices, thumbnail URLs — all in parallel |
| `GET /api/user/[userId]/inventory` | Paginated inventory (24 items/page); tries Cloud API first, falls back to public API |
| `GET /api/avatar-3d/[userId]` | Resolves Roblox CDN URLs for the `.obj`/`.mtl` 3D avatar model |
| `POST /api/resolve-username` | Converts a Roblox username string → numeric user ID |
| `GET /api/search-users` | (exists, not detailed above) user search |

All Roblox API calls go through `app/lib/roblox.ts` which provides: `fetchJson` (with retry + rate-limit backoff), `getThumbnailUrls` (batched in chunks of 50), `fetchItemDetailsPage` (5 concurrent workers), and constants/helpers for asset type classification.

### Key data types (`app/types/index.ts`)

- `RobloxUser` — profile fields
- `AssetInfo` — a single inventory/worn item with thumbnail and catalog URL
- `UserData` — combined response from `/api/user/[userId]`
- `InventoryPage` — paginated inventory response

### Frontend components

- `Avatar3D` — Three.js canvas (`@react-three/fiber`) that loads `.obj`+`.mtl` from Roblox CDN, converts Phong → PBR materials via `toStudioMaterial`, and animates the camera with a custom `CameraRig` using `useFrame`
- `SearchBar` — handles both username strings (resolves via `/api/resolve-username`) and numeric IDs; enforces client-side rate limits from `searchRateLimit.ts`
- `AccessoriesGrid` — renders worn items grid with tooltip cards
- `InventoryList` — infinite-scroll list with a "Load more" trigger
- `app/components/ui/` — shadcn/ui primitives (button, card, input, badge, etc.)

### Client-side rate limiting

`app/lib/searchRateLimit.ts` enforces a 15-second cooldown and 25 searches/hour cap using `localStorage`. This is UX-only, not a security control.

### CDN URL derivation

`app/api/avatar-3d/[userId]/route.ts` uses a custom hash function (`getHashUrl`) to map Roblox asset hashes to CDN hosts (`t0–t7.rbxcdn.com`). This mirrors Roblox's internal hash-routing logic and must not be changed without testing against live avatars.

### Path aliases

`@/` maps to `app/` (configured in `tsconfig.json`).
