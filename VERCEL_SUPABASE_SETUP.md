# World Sercher — Vercel + Supabase

Render is not used. The deployment target is Vercel, with Supabase for the database and Realtime.

## 1. Supabase database

1. Open the Supabase project used by World Sercher.
2. Open **SQL Editor**.
3. Open `SUPABASE_SETUP.sql` from this repository, copy the complete contents, and run it.
4. Confirm the tables `game_users`, `game_saves`, `global_chat_messages`, `player_blocks`, `player_reports`, `market_listings`, and `market_payouts` exist.

The SQL uses server-only access for account, save, chat, report, and marketplace tables. Do not add public read/write policies to these tables.

## 2. Vercel environment variables

In Vercel → Project → Settings → Environment Variables, add:

- `SUPABASE_URL`: Project URL from Supabase.
- `SUPABASE_SECRET_KEY`: Supabase server-side secret key. A legacy service-role key can be used if that is what the existing project has.
- `SUPABASE_PUBLISHABLE_KEY`: Supabase publishable key used by the browser Realtime client.
- `SESSION_SECRET`: a newly generated random secret with at least 32 characters.

Marketplace configuration is intentionally required before listing is enabled:

- `MARKET_LISTING_FEE_GOLD`: listing fee in GOLD.
- `MARKET_MIN_N`, `MARKET_MIN_R`, `MARKET_MIN_SR`, `MARKET_MIN_SSR`, `MARKET_MIN_UR`: minimum listing prices by rarity.

The exact listing fee and minimum prices were not finalized as numeric values, so do not guess them. Until configured, the marketplace listing API returns a setup message.

Never put `SUPABASE_SECRET_KEY` or `SESSION_SECRET` in browser code, HTML, or a public repository file.

## 3. Deploy with Vercel

1. In Vercel, import the GitHub repository `ruumo-14/world-sercher`.
2. Use the default Vercel deployment settings. Do not set a Render start command.
3. Add the environment variables above to the required environments.
4. Deploy. Later commits to the connected branch will trigger Vercel deployments automatically.

The `api/` directory contains Vercel serverless functions. Static files are served from `public/`. There is no Express server or `server.js`.

## 4. Current implementation notes

- Account registration/login uses the existing server-side password hashing and signed session cookie.
- Character save data is stored in Supabase.
- Global chat has a 50-character limit, 1.5-second send cooldown, report and block controls, and basic contact-detail filtering.
- Chat phrase filtering reads active entries from `chat_blocked_terms`. The operator must maintain this list; automatic detection is not a substitute for human moderation.
- Marketplace database functions support owned-item listing, purchases up to 99 per transaction, 10% sale fee, cancellation, seven-day expiry return, and payout claims that expire after 30 days.
- Marketplace functions require item records in `game_data.inventory` with stable `id` and `quantity` fields. Existing prototype items may need migration before they can be listed.
- This repository is still a prototype. The complete design is not yet fully playable: friend requests and private/group chats, full quests and rewards, complete battle progression, home furniture placement, pets/mounts, dungeon content, achievements, ranking snapshots/rewards, arena matchmaking, and operator moderation tools still need implementation and testing.
