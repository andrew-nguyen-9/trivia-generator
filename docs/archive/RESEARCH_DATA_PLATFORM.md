# Research: Data Hosting & Platform Strategy (with a job-market lens)

> Deliverable 2 of the project brief: *"Research into different ways of data hosting
> (Databricks, DBT, etc.) with a focus on skill building for finding new jobs."*
> The job-finder profile targets technical/data roles, so every option below is scored
> on two axes: **does it serve this app well** and **does it put in-demand keywords on
> the resume with real, demonstrable work behind them**.

---

## TL;DR — the chosen stack

**Supabase (serving) + dbt Core on DuckDB (transform, in this repo) + GitHub Actions
(orchestration), with an optional Databricks Free Edition mirror as a Phase-2 lab.**

This keeps the proven house pattern (both `fantasy-football-tool` and
`music-festival-analyzer` are Python-ETL → Supabase → Next.js) while adding the single
highest-leverage resume skill — **dbt** — as a working layer in this repo, not a toy.

```
APIs ──► pipeline/*.py (extract+load, "EL")          ← Python, requests, tenacity
              │
              ▼
        data/raw/*.jsonl  (bronze: raw fact dumps, committed artifacts in CI)
              │
              ▼
        transform/  dbt Core + DuckDB  (silver/gold: staging → marts + tests)
              │
              ├──► seed bank JSON ──► frontend offline mode
              ▼
        Supabase Postgres (gold serving layer, RLS, anon reads)
              │
              ▼
        Next.js frontend (read-only)
```

---

## 1. The options, honestly compared

### 1.1 Supabase (Postgres) — the incumbent

- **For the app:** already proven twice in this GitHub account; free tier covers this
  workload forever; RLS + anon-key pattern is established muscle memory; auto-REST means
  zero backend code.
- **For the resume:** says "Postgres, RLS, REST" — solid but table-stakes.
- **Verdict:** keep as the **serving layer**. Don't relearn what already works.

### 1.2 dbt (Core) — the highest-ROI skill add ⭐

- **What it is:** SQL transformation framework — models, `ref()` lineage, tests,
  docs, environments. The de-facto standard of the "analytics engineering" job family.
- **Job-market signal:** dbt appears in a huge share of analytics-engineer and
  mid-level data-engineer postings, usually alongside one warehouse (Snowflake,
  BigQuery, Databricks, Redshift). Crucially, **dbt skills transfer across all of
  them** — learn it once on DuckDB, interview against any warehouse.
- **Cost:** dbt Core is free. Paired with **DuckDB** (`dbt-duckdb` adapter) it runs
  in-process — no warehouse account, runs in GitHub Actions in seconds.
- **What we build (in `transform/`):** staging models over raw fact dumps, a
  `mart_question_bank` gold model, schema tests (`not_null`, `unique`,
  `accepted_values`), and generated docs. A real medallion (bronze→silver→gold) you
  can demo in an interview from a public repo.
- **Verdict:** **adopt now.** This is the deliberate skill-building move.

### 1.3 Databricks — the heavyweight keyword

- **What it is:** Spark + Delta Lake lakehouse; the platform most often named in
  senior data-engineering postings (alongside "medallion architecture", which it coined).
- **Free path:** **Databricks Free Edition** (serverless, non-expiring, for learning)
  — enough to: ingest the same `data/raw/*.jsonl` to Delta tables, rebuild the marts
  as PySpark/Delta notebooks, schedule a Workflows job. That mirrors *this exact
  project* onto the interview-dominant platform.
- **Why not primary hosting:** overkill for a few thousand rows; free tier isn't
  meant for production serving; the frontend would still need a serving DB anyway.
- **Verdict:** **Phase-2 lab mirror.** `docs/` will gain a runbook when we do it.
  Resume line: *"Mirrored production ETL into Databricks Delta tables with a
  medallion architecture and scheduled Workflows."*

### 1.4 Snowflake — the other big keyword

- 30-day/$400 trial, then paid; no useful perpetual free tier for a hobby project.
- dbt experience transfers ~90% of the way; SQL dialect differences are learnable
  in a weekend. **Skip hosting here; rely on dbt transfer + trial sandbox before
  interviews that demand it.**

### 1.5 BigQuery — the free-tier sleeper option

- Genuinely free under 10 GB storage / 1 TB query/month — this project would never
  pay a cent. `dbt-bigquery` swap is a config change.
- **Verdict:** strongest *alternative* serving warehouse if we outgrow Supabase or
  want a second cloud keyword cheaply. Documented as the designated escape hatch.

### 1.6 MotherDuck / DuckDB — the modern indie pick

- DuckDB locally (already in our dbt layer); MotherDuck free tier (10 GB) if we ever
  want the warehouse hosted. Rising fast in startup postings; pairs perfectly with
  the `dbt-duckdb` choice. No migration needed later — same dialect.

### 1.7 Orchestration: GitHub Actions now, Airflow/Dagster vocabulary later

Both reference repos cron via Actions — keep it. But job postings say
"Airflow" constantly. Mitigation: our Actions workflow is written as **explicit
DAG-shaped jobs** (extract → transform → test → publish, with `needs:` edges), and
`docs/` notes the 1:1 mapping to Airflow DAGs/Dagster assets. Phase 2 option: a
Dagster-in-Docker version of the same pipeline (Dagster's free OSS tier and asset
model demo extremely well).

---

## 2. Skill-building roadmap (mapped to the job hunt)

| Phase | Ship | Resume line it earns |
|---|---|---|
| **1 (now)** | EL scripts + dbt-DuckDB medallion + tests + Actions DAG + Supabase serving | "Built ELT pipeline with dbt (staging/marts, schema tests, docs) orchestrated via CI, serving a production app" |
| **2 (shipped — see `databricks/`)** | Databricks Free Edition mirror: Delta tables + PySpark notebook + scheduled Workflow | "Implemented medallion architecture on Databricks Delta Lake" |
| **3** | Swap one mart to incremental materialization; add dbt snapshots (SCD2) on `facts` | "Incremental models & slowly-changing dimensions in dbt" |
| **4** | Dagster (or Airflow) containerized version of the DAG | "Migrated CI cron to Dagster asset-based orchestration" |

Each phase is a self-contained PR in a public repo — verifiable proof, not bullet-point
claims, which is exactly the gap most career-switch resumes have.

---

## 3. Decision record

1. **Serving is the committed seed bank (repo-as-database) by default** — the
   Supabase free-project quota ran out, and at this scale (a few thousand
   read-only rows, refreshed nightly) a committed, compacted JSONL bronze layer
   plus a committed seed JSON is the *right* architecture, not a fallback. The
   pipeline auto-upgrades to Supabase upserts the moment secrets appear (a free
   slot opens by pausing an off-season project, e.g. the fantasy tool), which
   Phase-3 multiplayer/leaderboards will require.
2. **dbt Core + DuckDB added in `transform/`** — the deliberate skill investment;
   runs free in CI; transferable to Snowflake/Databricks/BigQuery interviews.
3. **Bronze layer is files** (`data/raw/*.jsonl` as CI artifacts) — makes the
   medallion story real and makes Databricks/BigQuery mirrors trivial later.
4. **Databricks Free Edition is the Phase-2 lab**, not the host — the mirror
   notebook, runbook, and job spec live in `databricks/`.
5. **BigQuery is the documented escape hatch** if Supabase limits ever bind.
