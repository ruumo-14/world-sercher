# World Sercher V2 — Rebuild Plan

## Goal

Rebuild the prototype into a cohesive, playable online fantasy RPG. This is a staged rebuild, not a cosmetic reskin. Existing accounts and saves must remain usable throughout the migration.

## Non-negotiable design direction

- Original 16-bit JRPG pixel art, quarter/isometric view for the field (not top-down), readable silhouettes, detailed tile-based environments, crisp pixel edges.
- A large, connected fantasy world: a central continent and unlockable islands/continents. The first town is リーフェル in the south of the central continent.
- Eight-direction field movement. The field and side-scrolling action battles are separate gameplay modes.
- Combat should have readable movement, attack timing, enemy telegraphs, meaningful player choices, and a clear win/escape result. Avoid reducing combat to instant damage buttons.
- Exploration, NPCs, gathering, crafting, jobs, housing, quests, equipment, and social play must be real playable systems, not menu descriptions.
- Keep the established 12 jobs, one active job at a time, once-per-day job change, separate job progress, job/common skill records, equipment enhancement, item rarity, player market, titles, achievements, and progression gates.
- Keep the audience/friend-scale scope manageable. Build a small polished vertical slice before expanding the map and content.

## Preserve during the rebuild

- Existing login and registration endpoints.
- Existing password hashing and signed HttpOnly session cookie.
- Existing Supabase-backed account/save data.
- Existing server-only `SUPABASE_SECRET_KEY` and `SESSION_SECRET` handling.
- Existing restrictive RLS posture. Never add public table read/write policies or expose server secrets in browser assets.
- Existing player identity and saved character data. New save fields must be introduced through versioned, additive migrations.

## Current technical risks found in the main branch

- The field renderer, world state, combat, input, persistence, and networking are concentrated in `public/game.js`.
- The main canvas is configured as a low-resolution virtual canvas, but the renderer mixes multiple drawing styles and asset paths; this needs one consistent rendering pipeline.
- The current battle prototype directly subtracts fixed damage from the first living enemy and does not yet provide a complete action-combat loop.
- `public/game-system.js` and `public/world-sercher-systems.js` expose many systems in menus, while the setup notes explicitly list major systems as not implemented.
- The interface advertises a watercolor/storybook direction, which conflicts with the approved 16-bit JRPG pixel-art direction.
- The data model has overlapping level defaults/caps across modules. Reconcile these against the approved game specification before changing saved data.

## Rebuild sequence

### Phase 0 — Safety and baseline
- Work on `rebuild/world-sercher-v2`; do not replace `main` while the new build is unverified.
- Add automated checks for JavaScript syntax, referenced local assets, and accidental exposure of server-only environment variable names in browser files.
- Record current save fields and keep migrations backward-compatible.

### Phase 1 — Core foundation
- Separate game state, input, world simulation, rendering, combat, UI, and persistence into modules with explicit interfaces.
- Introduce a versioned save schema and a single migration path.
- Add a fixed-step update loop and deterministic collision/query helpers.
- Make loading, authentication, save restoration, and disconnect/reconnect states explicit.

### Phase 2 — Polished vertical slice
- Rebuild リーフェル and its nearby field with a consistent isometric pixel-art tileset, collision, paths, water edges, building entrances, and readable landmarks.
- Make eight-direction movement responsive and consistent on keyboard and supported touch controls.
- Add a small set of NPCs with schedules, interaction prompts, dialogue state, and one complete optional relationship story.
- Add a complete side-scrolling battle against a small enemy roster, including movement, attack windows, enemy tells, damage feedback, rewards, defeat handling, and escape rules.

### Phase 3 — Progression and activities
- Implement quests, gathering, crafting, all 12 jobs, skills, equipment, inventory, home, and NPC stories as playable systems.
- Add world gates and unlock progression.
- Ensure rewards and costs are balanced and saved server-side where they affect shared progression/economy.

### Phase 4 — Online and community
- Verify player presence and movement synchronization across separate devices.
- Harden chat, friends, market, rankings, reports, and moderation flows.
- Add transaction-safe server validation for currency and item transfers; never trust browser-submitted balances or inventory ownership.

### Phase 5 — Content expansion and release checks
- Expand regions, dungeons, enemies, items, and events only after the vertical slice is stable.
- Test fresh registration, login, save restore, multiple devices, reconnects, and deployment on Vercel.
- Do not label a feature complete until it has been exercised in-game.

## Acceptance checks

- A fresh player can register, create a character, enter the world, move, interact, fight, receive a reward, save, log out, and restore the same character.
- Existing players can log in without losing their current saved data.
- Two devices can see each other online without corrupting save state.
- The browser bundle contains no server-only secret.
- The core loop works without opening the systems-description panel.
- A feature marked complete is playable and tested, not merely described in a menu.
