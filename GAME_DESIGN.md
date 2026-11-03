# WORLD SERCHER — Game Design

This document records the agreed direction for the game. It is a design specification, not a claim that every system is already playable.

## Visual direction
- Original, warm, classic 16-bit-era fantasy RPG pixel art.
- Broad mood reference: the nostalgic, colorful presentation of classic console RPGs such as Dragon Quest V.
- Do not copy Dragon Quest characters, monsters, sprites, maps, UI, music, names, or other protected assets.
- All characters, monsters, buildings, items, and maps are original.
- Use lightweight pixel assets, reusable sprite parts, 8-direction character views, and a small number of animation frames.
- Support desktop, tablets, and mobile devices.

## Core game
- A large cooperative online fantasy world for exploring with friends.
- No open-world PvP. Players may compete in separate minigames and rankings.
- Movement in eight directions; diagonal movement is normalized; facing follows movement direction.
- The world should feel seamless. Internally, regions/chunks may load as needed.
- No seasonal or time/weather event system in the initial scope.
- Core activities: exploration, combat, gathering, crafting, farming, fishing, trading, home life, quests, and minigames.
- Shared currency throughout the world.
- Trading through player shops and a market/auction system.
- Rankings are asynchronous and global: daily, weekly, and monthly; categories include combat, gathering, crafting, business, exploration, and minigames.

## World and travel
- Provisional world name: Asteria World (アステリア世界).
- Large central continent plus islands and smaller continents; expandable later.
- First starting town: provisional name Riefel (リーフェル), in the southern part of the central continent.
- Starting town setting: grassland and river, winding river around the town, central plaza and fountain.
- Four bridges connect north to forest, west to hills/mines/cave, east to riverside/fishing, and south to grasslands.
- Main roads are cobblestone; residential/farm lanes are dirt paths.
- Main regions:
  1. Central Asteria — grasslands, forests, towns, villages.
  2. Northern Frost — snow mountains and ice caves.
  3. Southern Desert — desert, oasis, ancient ruins.
  4. Eastern Eldia — giant trees, magical forest, fairy settlements.
  5. Western Volga — volcanoes, mines, forges.
  6. Southeast Aqua Archipelago — coastal towns, coral, underwater caves.
  7. Northeast Sky Region — mountains, ancient civilization, sky ruins.
  8. Far-west Forgotten Island — unknown creatures and lost civilization.
- Walk between connected field regions; use ships between islands/continents. Special mounts or transport may help in snow/desert regions.
- Future expansion may add new continents, underground worlds, floating islands, underwater civilizations, and ancient regions.

## Starting town facilities
- Central plaza and fountain.
- Adventurers Guild: quests and rankings.
- Weapon shop and blacksmith.
- Item shop.
- Inn and tavern.
- Market/player shops and bank.
- Player home district and farm plots.
- NPC residential district.
- Shops may have opening hours and restocks. Town reputation may unlock stock or facilities.

## Playable species
Seven selectable species: Human, Elf, Dwarf, Beastfolk, Aquatic Folk, Dragonkin, and Fairy Folk.
- All species can live in all regions and use every job, weapon, armor, and trade system.
- Regional populations differ naturally; no region is exclusive to one species.
- Species have small, balanced starting-stat or specialty differences (target around five percent, subject to balancing).
- No mandatory species-only quests.
- Species changes after character creation require a distant, later-unlocked Species Rebirth Shrine, a special material, and in-game currency. This can be repeated.
- Rebirth preserves player level/XP, job levels, skills, gear, inventory, home/furniture, and NPC affinity. Appearance adapts to the new species.

## Character appearance
- Creation options: species, hairstyle/hair color, skin color, eye color, face, outfit/color, and accessories.
- Species traits such as ears, horns, tails, or wings are supported.
- After starting, hair/face/eyes are changed at a barber; clothing/colors/accessories at a tailor; other species-appearance details at dedicated appearance services.
- Ordinary appearance changes cost in-game currency and do not change stats.
- Equipment stats do not change the chosen outfit appearance.

## Progression caps
All caps are initial values and may be adjusted by future updates; stored progress must be retained if a cap changes.
- Player level: 100.
- Each job level: 50.
- Each skill level: 10.
- Each equipment enhancement: +10.
- Limit breaks are deferred.
- Player XP comes mainly from combat and quests, with smaller amounts from exploration, gathering, and crafting. Anti-farming balance is required.
- Job XP is awarded only for actions relevant to the currently active job. Amounts should reflect time, effort, and difficulty; short/simple actions give less than longer/harder actions.

## Jobs
Only one active job at a time. A player may change jobs once per day, only at a job guild in a town. Each job's level and XP are saved independently and never lost when switching.
Initial 12 jobs:
- Combat: Warrior (戦士), Mage (魔法使い), Archer (弓使い).
- Gathering: Miner (採掘師), Lumberjack (木こり), Forager (採集師).
- Production: Blacksmith (鍛冶師), Cook (調理師), Clothing Artisan (服飾職人).
- Life: Farmer (農家), Fisher (釣り師), Merchant (商人).

## Skills
- Two separate groups: active-job-specific skills and shared skills usable across all jobs.
- Skill records persist independently for each job; shared skills have their own records.
- Skill upgrades happen only at a training hall/skill research facility.
- Skill books are fixed to a specific skill and are not consumed when used.
- A job-specific skill book can only be used while the matching job is active. Shared-skill books can be used regardless of job.
- Learning is retained when changing jobs; the learned job skill can be used again after returning to that job.
- Skill-book acquisition sources and drop placements are intentionally deferred.

## Equipment and rarity
- Every equipment item instance is tracked separately; duplicate copies can have different enhancement levels.
- Enhancements occur at a dedicated facility such as a blacksmith and consume item-specific materials.
- Example material themes (not final recipes): iron ore/wood for an iron sword; volcanic ore/flame crystal for a flame sword; hide/thread for leather armor; magic crystal/cloth for a magic robe.
- Seven rarity tiers: Common, Uncommon, Rare, Epic, Legendary, Mythic, Artifact.

## Home, NPCs, and stories
- Each player owns a home in a designated town, initially Riefel. Homes support furniture, storage, crafting stations, and friend invitations.
- First town target population: about 36 NPCs, including six story NPCs and many ordinary residents, workers, guards, and travelers.
- Six core NPCs: Emilia (guild receptionist), Gald (blacksmith), Mina (item shop owner), Noah (farmer), Lloyd (innkeeper), Alberto (mayor).
- Each core NPC has an independent medium-length story of roughly 8–12 events. Stories may begin in any order and progress independently, with a few gentle cross-references.
- NPC affinity ranges from 0 to 100 and grows through conversations, quests, preferred gifts, and story events. Thresholds at 20/40/60/80/100 unlock content. Repeating the same conversation should not be an affinity-farming exploit.
- Gifts are tied to affinity/story moments rather than unlimited daily free gifts.
- NPCs follow daily schedules and can interact with one another; distant NPC behavior is simplified for performance.
- Completing all six personal stories unlocks an optional shared story, “The Seven Lost Relics” (失われた七つの遺産), planned for about 20 events.
- The shared story is optional, pausable, and never blocks ordinary exploration or progression. Its rewards are bonus titles, cosmetics, furniture, recipes, and collectibles, not mandatory progression gear.
- Completing the shared story does not end the game; free exploration continues.

## Prototype implementation status (2026-11-03)
- Implemented: account registration/login, session persistence, PostgreSQL-backed character position/name save, Socket.IO player presence and position sync, basic movement, collision, a small starting-area prototype, and a saved JSON game-data field.
- Implemented as a read-only prototype: an adventurer panel showing some agreed species/job/skill/equipment/world rules.
- Not yet implemented as playable systems: job-guild location checks and daily job changes, real XP awards from actions, skill-book learning and training, equipment/material inventory and enhancement, appearance services, species rebirth, full NPC schedules/stories/affinity, home interactions, trading/auction, rankings, complete world/region streaming, combat, quests, and minigames.
- The current town map and building placements are only a prototype and are not the final agreed world map.
