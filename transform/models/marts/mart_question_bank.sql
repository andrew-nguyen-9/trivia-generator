-- Gold: forge-ready facts with difficulty pre-scored.
-- Difficulty = popularity percentile within category (popular ⇒ easy),
-- the same rule question_forge.py applies — computed here so the SQL layer
-- is the source of truth and the forge can trust it.

with scored as (

    select
        *,
        percent_rank() over (
            partition by category
            order by coalesce(popularity, 0) desc
        ) as obscurity_pct
    from {{ ref('stg_facts') }}

)

select
    content_hash,
    source,
    category,
    subject,
    fact_text,
    year,
    numeric_value,
    numeric_unit,
    lat,
    lng,
    image_url,
    source_url,
    popularity,
    least(5, 1 + cast(floor(obscurity_pct * 5) as integer)) as difficulty,
    case
        when year is not null and year >= 1800        then true else false
    end as fuels_year_guess,
    case
        when numeric_value is not null and numeric_unit is not null then true else false
    end as fuels_higher_lower,
    case
        when lat is not null and lng is not null then true else false
    end as fuels_where
from scored
