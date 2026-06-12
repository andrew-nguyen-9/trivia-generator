-- Silver: typed, deduped facts from the bronze JSONL dumps.
-- DuckDB reads the raw files directly — no loader step needed.

with raw as (

    select *
    from read_json_auto('{{ var("raw_glob") }}', union_by_name => true)

),

typed as (

    select
        content_hash,
        lower(source)                     as source,
        lower(category)                   as category,
        subject,
        fact_text,
        try_cast(year as integer)         as year,
        try_cast(numeric_value as double) as numeric_value,
        numeric_unit,
        image_url,
        source_url,
        try_cast(popularity as double)    as popularity,
        try_cast(_ingested_at as timestamp) as ingested_at
    from raw
    where content_hash is not null
      and fact_text is not null

),

deduped as (

    select *
    from typed
    qualify row_number() over (
        partition by content_hash
        order by ingested_at desc
    ) = 1

)

select * from deduped
