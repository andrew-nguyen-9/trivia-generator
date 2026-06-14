# Graph Report - .  (2026-06-13)

## Corpus Check
- Corpus is ~37,710 words - fits in a single context window. You may not need a graph.

## Summary
- 437 nodes · 1028 edges · 23 communities (16 shown, 7 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 71 edges (avg confidence: 0.83)
- Token cost: 12,500 input · 5,200 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Game Room Components|Game Room Components]]
- [[_COMMUNITY_Architecture Concepts|Architecture Concepts]]
- [[_COMMUNITY_Room Server Pages|Room Server Pages]]
- [[_COMMUNITY_Data Pipeline & dbt Transforms|Data Pipeline & dbt Transforms]]
- [[_COMMUNITY_Lobby, Home & Leaderboard|Lobby, Home & Leaderboard]]
- [[_COMMUNITY_ETL Ingest Scripts|ETL Ingest Scripts]]
- [[_COMMUNITY_Frontend Dependencies|Frontend Dependencies]]
- [[_COMMUNITY_Daily & Map Game Logic|Daily & Map Game Logic]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_Databricks & DB Migrations|Databricks & DB Migrations]]
- [[_COMMUNITY_Room Filters & Card Decks|Room Filters & Card Decks]]
- [[_COMMUNITY_Player Profile & XP|Player Profile & XP]]
- [[_COMMUNITY_Score Edge Function|Score Edge Function]]
- [[_COMMUNITY_Root Layout|Root Layout]]
- [[_COMMUNITY_Next.js Config|Next.js Config]]
- [[_COMMUNITY_Tailwind Config|Tailwind Config]]
- [[_COMMUNITY_Score Write Proxy|Score Write Proxy]]
- [[_COMMUNITY_Profile Page|Profile Page]]
- [[_COMMUNITY_Package Root|Package Root]]
- [[_COMMUNITY_Pipeline Requirements|Pipeline Requirements]]

## God Nodes (most connected - your core abstractions)
1. `getQuestionsByType()` - 27 edges
2. `Question` - 23 edges
3. `useProfile()` - 21 edges
4. `CATEGORY_HEX` - 19 edges
5. `mulberry32()` - 17 edges
6. `shuffled()` - 17 edges
7. `Category` - 17 edges
8. `GAME_MODES — Room Design Doc` - 17 edges
9. `daySeed()` - 16 edges
10. `compilerOptions` - 16 edges

## Surprising Connections (you probably didn't know these)
- `content_hash Idempotent Deduplication` --semantically_similar_to--> `Medallion Architecture (bronze/silver/gold)`  [INFERRED] [semantically similar]
  db/schema.sql → databricks/notebooks/medallion_mirror.py
- `get_supabase()` --semantically_similar_to--> `getSupabase()`  [INFERRED] [semantically similar]
  pipeline/common.py → frontend/lib/supabase.ts
- `build_daily_board()` --semantically_similar_to--> `Deterministic Daily Board Rationale`  [INFERRED] [semantically similar]
  pipeline/question_forge.py → frontend/lib/rng.ts
- `mart_question_bank (dbt gold model)` --semantically_similar_to--> `assign_difficulty()`  [INFERRED] [semantically similar]
  transform/models/marts/mart_question_bank.sql → pipeline/question_forge.py
- `Data-Quality Gates (Databricks)` --semantically_similar_to--> `RLS Public-Read Service-Role-Write Pattern`  [INFERRED] [semantically similar]
  databricks/notebooks/medallion_mirror.py → db/schema.sql

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Date-Seeded Rooms Pattern (board, clock, map, daily use daySeed+mulberry32 for SSR/client consistency)** — app_board_page, app_clock_page, app_map_page, app_daily_page, lib_rng_dayseed, lib_rng_mulberry32, concept_dayseed_prng [EXTRACTED 1.00]
- **Game Room Juice Stack (sfx + haptics + confetti + achievement toasts on win/lose)** — components_blitzgame, components_boardgame, components_clockgame, lib_sound_sfx, lib_haptics_haptic, components_confetti, components_achievementtoast [EXTRACTED 0.95]
- **Medallion Pipeline Flow (raw JSONL → bronze → silver → gold → DQ gates)** — notebooks_medallion_mirror_bronze_facts, notebooks_medallion_mirror_silver_facts, notebooks_medallion_mirror_gold_question_bank, notebooks_medallion_mirror_dq_gates, concept_medallion_architecture [EXTRACTED 1.00]
- **Game Room → Profile Record → Achievement Toast → Sound/Haptic Feedback Loop** — lib_profile, lib_haptics, components_leaderboardpanel, components_connectionsgame, components_gallerygame, components_jukeboxgame, components_streakgame, components_wedgesgame [EXTRACTED 0.95]
- **Map Rendering Pipeline: geo lib → WorldMap/GoogleMap → MapGame/DailyGame** — lib_geo, components_worldmap, components_googlemap, components_mapgame, components_dailygame [EXTRACTED 0.95]
- **Practice Mode: PracticeBar + StreakGame/WedgesGame/MapGame + usePractice hook** — components_practicebar, components_streakgame, components_wedgesgame, components_mapgame, concept_practice_mode [EXTRACTED 0.90]
- **Offline-First Triad: seed bank + null Supabase client + seed fallback in queries** — public_seed_questions_seed_bank, lib_supabase_getsupabase, lib_queries_getquestionsbytype [EXTRACTED 0.95]
- **ETL Ingest Pipeline: five ingests all call make_fact → dump_raw → upsert_facts** — pipeline_common_make_fact, pipeline_common_dump_raw, pipeline_common_upsert_facts, pipeline_geo_ingest_main, pipeline_music_ingest_main, pipeline_screen_ingest_main, pipeline_sports_ingest_main, pipeline_wikipedia_ingest_main [EXTRACTED 1.00]
- **Difficulty computed twice — once in Python forge and once in dbt SQL, both using popularity percentile** — pipeline_question_forge_assign_difficulty, marts_mart_question_bank, concept_popularity_to_difficulty [INFERRED 0.85]
- **Full ETL Pipeline: Extract → Transform (dbt) → Publish** — workflows_etl_daily, staging_stg_facts, transform_dbt_project, concept_medallion_architecture, concept_dbt_tests_as_gate, concept_repo_as_database [EXTRACTED 1.00]
- **Data Sources → Fact Forge → Typed Questions → Room Renderers** — source_wikipedia, source_deezer, source_sleeper_espn, source_tmdb, source_restcountries, concept_fact_question_forge, concept_one_bank_many_rooms [EXTRACTED 1.00]
- **Offline-First Architecture: Bronze JSONL + Seed Bank + World Atlas** — concept_repo_as_database, concept_offline_first_design, concept_content_hash_idempotency, concept_date_seeded_prng [INFERRED 0.85]

## Communities (23 total, 7 thin omitted)

### Community 0 - "Game Room Components"
Cohesion: 0.09
Nodes (51): AchievementToast(), BlitzGame(), Phase, BoardGame(), CellState, GameMode, ClockGame(), MAX_YEAR (+43 more)

### Community 1 - "Architecture Concepts"
Cohesion: 0.08
Nodes (51): Category Neon Color System, Content-Hash Idempotent Upserts, DAG-Shaped CI Workflow (extract→transform→publish), Databricks Free Edition Mirror as Phase-2 Lab, Date-Seeded PRNG for SSR/Client Consistency, dbt+DuckDB for Transferable Resume Skills, dbt Schema Tests as Publish Gate, Difficulty Score from Popularity Percentile (+43 more)

### Community 2 - "Room Server Pages"
Cohesion: 0.11
Nodes (33): BlitzPage (Server Component), BoardPage (Server Component), ClockPage (Server Component), ConnectionsPage (Server Component), DailyPage (Server Component), GalleryPage (Server Component), JukeboxPage (Server Component), MapPage (Server Component) (+25 more)

### Community 3 - "Data Pipeline & dbt Transforms"
Cohesion: 0.08
Nodes (44): Fact-to-Question Pipeline Pattern, Popularity Percentile → Difficulty Mapping, date, Deterministic Daily Board Rationale, mart_category_stats (dbt gold model), mart_question_bank (dbt gold model), Path, compact_jsonl() (+36 more)

### Community 4 - "Lobby, Home & Leaderboard"
Cohesion: 0.09
Nodes (31): LobbyPage (Server Component), Home(), ROOMS, TICKER, LeaderboardPanel(), Marquee(), RoomCard(), Leaderboard Global→Local Fallback (+23 more)

### Community 5 - "ETL Ingest Scripts"
Cohesion: 0.11
Nodes (33): Next.js Config (image domains), dump_raw(), get_json(), get_supabase(), make_fact(), common.py — shared helpers for all pipeline scripts.  Conventions (inherited fro, Append rows to the bronze layer (data/raw/{name}.jsonl), then compact., Service-role client for pipeline writes. Returns None when unconfigured     (off (+25 more)

### Community 6 - "Frontend Dependencies"
Cohesion: 0.07
Nodes (26): dependencies, framer-motion, @googlemaps/js-api-loader, next, react, react-dom, @supabase/supabase-js, topojson-client (+18 more)

### Community 7 - "Daily & Map Game Logic"
Cohesion: 0.13
Nodes (18): DailyGame(), emoji(), MAX_YEAR, SavedResult, AnyMap, DARK_STYLES, GoogleMap(), MapGame() (+10 more)

### Community 8 - "TypeScript Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 9 - "Databricks & DB Migrations"
Cohesion: 0.16
Nodes (17): content_hash Idempotent Deduplication, parlor-daily-mirror Databricks Job, Phase 2 Migration: Map+Daily qtypes, leaderboard View (top-200 per room), Phase 3 Migration: Rooms+Leaderboard, scores Table, bronze_facts Delta Table, Data-Quality Gates (Databricks) (+9 more)

### Community 10 - "Room Filters & Card Decks"
Cohesion: 0.19
Nodes (8): DIFFS, Deck, DECKS, filterByDeck(), filterByDifficulty(), GameResult, Profile, Category

### Community 11 - "Player Profile & XP"
Cohesion: 0.24
Nodes (8): ProfileDashboard(), ROOM_LABEL, ACHIEVEMENTS, dayStreak(), levelFromXp(), ROOMS, xpIntoLevel(), xpPerLevel

### Community 12 - "Score Edge Function"
Cohesion: 0.33
Nodes (4): CORS, lastHit, MAX_SCORE, ROOMS

## Knowledge Gaps
- **86 isolated node(s):** `metadata`, `TICKER`, `ROOMS`, `Phase`, `CellState` (+81 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getSupabase()` connect `Lobby, Home & Leaderboard` to `Architecture Concepts`, `Room Server Pages`, `ETL Ingest Scripts`?**
  _High betweenness centrality (0.325) - this node is a cross-community bridge._
- **Why does `Null Client Graceful Degradation Pattern` connect `Architecture Concepts` to `Lobby, Home & Leaderboard`?**
  _High betweenness centrality (0.214) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `mulberry32()` (e.g. with `Date-Seeded PRNG for Shared Daily Board` and `daySeed()`) actually correct?**
  _`mulberry32()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `metadata`, `TICKER`, `ROOMS` to the rest of the system?**
  _115 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Game Room Components` be split into smaller, more focused modules?**
  _Cohesion score 0.09117117117117117 - nodes in this community are weakly interconnected._
- **Should `Architecture Concepts` be split into smaller, more focused modules?**
  _Cohesion score 0.08313725490196078 - nodes in this community are weakly interconnected._
- **Should `Room Server Pages` be split into smaller, more focused modules?**
  _Cohesion score 0.1130952380952381 - nodes in this community are weakly interconnected._