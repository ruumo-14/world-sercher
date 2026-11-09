# World Sercher — Vercel + Supabase

Render is not used. The deployment target is Vercel, with Supabase for the database and Realtime.

## 1. Supabase database

1. Open the Supabase project used by World Sercher.
2. Open **SQL Editor**.
3. Open `SUPABASE_SETUP.sql` from this repository, copy the complete contents, and run it.
4. Confirm the tables `game_users`, `game_saves`, `global_chat_messages`, `player_blocks`, `player_reports`, `friend_requests`, `player_friends`, `player_private_messages`, `chat_groups`, `chat_group_members`, `group_chat_messages`, `market_listings`, and `market_payouts` exist. If you ran an older version of this SQL before, run the full updated file again; its table and function setup is designed to be repeatable.

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
- Friend requests (name search, approval, 50-person cap, 7-day expiry), 1:1 messages, and group chat (up to 20 people) now have API and basic UI. Group stamp selection, online-first friend ordering, and login/acceptance notifications still need UI integration.
- Bug reports and improvement suggestions support text fields, optional private image upload (PNG/JPEG/WebP, max 2MB), a personal report history, and an operator-reply field. The SQL creates the private `bug-reports` Storage bucket.\n- The global chat UI shows the latest 20 messages while the API keeps a 100-message history.\n- The game now has an interactive daily job-change control, skill-level controls gated by interacting with the training building, inventory/home/quest/achievement/ranking overview tabs, and walking-based random encounters.\n- Live top-50 rankings for character level and GOLD, plus the player's own rank, are implemented. The minigame category reads a best-score field if one exists, but the minigame itself is not built. Weekly snapshots and weekly reward distribution are not implemented.
- The repository is still a prototype. Actual battle XP/GOLD rewards, complete quest content and rewards, gathering/crafting/farming, home expansion and furniture placement, pets/mounts, dungeon maps, gacha draws and exchange shop, weekly ranking snapshots/rewards, arena matchmaking, full NPC daily routines and stories, stamp pickers, online-first friend ordering, and operator moderation tools still need implementation and testing.
