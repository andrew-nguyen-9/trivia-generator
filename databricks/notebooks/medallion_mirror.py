# Databricks notebook source
# MAGIC %md
# MAGIC # PARLOR — medallion mirror (bronze → silver → gold)
# MAGIC
# MAGIC Mirrors `transform/` (dbt + DuckDB) onto Delta Lake. Same layers, same rules:
# MAGIC - **bronze**: raw JSONL fact dumps, append-only, with ingest lineage
# MAGIC - **silver**: typed + deduped on `content_hash` (latest ingest wins)
# MAGIC - **gold**: difficulty-scored question bank + category health stats
# MAGIC
# MAGIC Final cell enforces data-quality gates (job fails on violation), mirroring
# MAGIC how `dbt test` gates the publish step in `.github/workflows/etl_daily.yml`.

# COMMAND ----------

RAW_PATH = "/Volumes/workspace/parlor/raw/"  # upload data/raw/*.jsonl here
SCHEMA = "parlor"

spark.sql(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}")

# COMMAND ----------

# MAGIC %md ## Bronze — raw facts with lineage

# COMMAND ----------

from pyspark.sql import functions as F

bronze = (
    spark.read.json(f"{RAW_PATH}*.jsonl")
    .withColumn("_source_file", F.col("_metadata.file_path"))
    .withColumn("_loaded_at", F.current_timestamp())
)

bronze.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(f"{SCHEMA}.bronze_facts")
print(f"bronze_facts: {bronze.count()} rows")

# COMMAND ----------

# MAGIC %md ## Silver — typed, deduped (mirrors `stg_facts.sql`)

# COMMAND ----------

from pyspark.sql.window import Window

w = Window.partitionBy("content_hash").orderBy(F.col("_ingested_at").desc())

silver = (
    spark.table(f"{SCHEMA}.bronze_facts")
    .where(F.col("content_hash").isNotNull() & F.col("fact_text").isNotNull())
    .withColumn("source", F.lower("source"))
    .withColumn("category", F.lower("category"))
    .withColumn("year", F.col("year").cast("int"))
    .withColumn("numeric_value", F.col("numeric_value").cast("double"))
    .withColumn("lat", F.col("lat").cast("double"))
    .withColumn("lng", F.col("lng").cast("double"))
    .withColumn("popularity", F.col("popularity").cast("double"))
    .withColumn("ingested_at", F.to_timestamp("_ingested_at"))
    .withColumn("_rn", F.row_number().over(w))
    .where(F.col("_rn") == 1)
    .drop("_rn")
)

silver.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(f"{SCHEMA}.silver_facts")
print(f"silver_facts: {silver.count()} rows")

# COMMAND ----------

# MAGIC %md ## Gold — question bank (mirrors `mart_question_bank.sql`)

# COMMAND ----------

cat_w = Window.partitionBy("category").orderBy(F.coalesce(F.col("popularity"), F.lit(0)).desc())

gold = (
    spark.table(f"{SCHEMA}.silver_facts")
    .withColumn("obscurity_pct", F.percent_rank().over(cat_w))
    .withColumn("difficulty", F.least(F.lit(5), 1 + F.floor(F.col("obscurity_pct") * 5)).cast("int"))
    .withColumn("fuels_year_guess", F.col("year").isNotNull() & (F.col("year") >= 1800))
    .withColumn("fuels_higher_lower", F.col("numeric_value").isNotNull() & F.col("numeric_unit").isNotNull())
    .withColumn("fuels_where", F.col("lat").isNotNull() & F.col("lng").isNotNull())
    .drop("obscurity_pct", "meta", "_source_file", "_loaded_at", "_ingested_at")
)

gold.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(f"{SCHEMA}.gold_question_bank")
print(f"gold_question_bank: {gold.count()} rows")

# COMMAND ----------

# MAGIC %md ## Health report (mirrors `mart_category_stats.sql`)

# COMMAND ----------

stats = (
    spark.table(f"{SCHEMA}.gold_question_bank")
    .groupBy("category")
    .agg(
        F.count("*").alias("fact_count"),
        F.sum(F.col("fuels_year_guess").cast("int")).alias("year_guess_fuel"),
        F.sum(F.col("fuels_higher_lower").cast("int")).alias("higher_lower_fuel"),
        F.sum(F.col("fuels_where").cast("int")).alias("where_fuel"),
        F.countDistinct("difficulty").alias("difficulty_spread"),
    )
    .orderBy(F.col("fact_count").desc())
)
stats.show(truncate=False)

# COMMAND ----------

# MAGIC %md ## Data-quality gates (mirrors dbt schema tests — job FAILS on violation)

# COMMAND ----------

g = spark.table(f"{SCHEMA}.gold_question_bank")

dupes = g.groupBy("content_hash").count().where("count > 1").count()
assert dupes == 0, f"unique violation: {dupes} duplicated content_hash values"

null_keys = g.where("content_hash is null or category is null or fact_text is null").count()
assert null_keys == 0, f"not_null violation: {null_keys} rows"

valid_cats = {"history", "music", "sports", "screen", "geography", "wildcard"}
bad_cats = {r.category for r in g.select("category").distinct().collect()} - valid_cats
assert not bad_cats, f"accepted_values violation: {bad_cats}"

bad_diff = g.where("difficulty < 1 or difficulty > 5").count()
assert bad_diff == 0, f"difficulty out of range: {bad_diff} rows"

print("all gates passed ✓")
