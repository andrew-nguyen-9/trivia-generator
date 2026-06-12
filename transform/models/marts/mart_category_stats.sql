-- Gold: per-category health metrics. Surfaced in CI logs so a starving
-- category (e.g. an API broke and music stopped flowing) is visible in the
-- workflow run before it becomes a bad player experience.

select
    category,
    count(*)                                  as fact_count,
    count(*) filter (where fuels_year_guess)  as year_guess_fuel,
    count(*) filter (where fuels_higher_lower) as higher_lower_fuel,
    count(distinct difficulty)                as difficulty_spread,
    max(popularity)                           as max_popularity
from {{ ref('mart_question_bank') }}
group by category
order by fact_count desc
