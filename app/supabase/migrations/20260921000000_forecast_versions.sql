-- forecast_versions — new table for sequence.md action #6 ("Save a Forecast Version").
-- Not in the original erd.md (that file marked this a gap: "no persistence table
-- exists"). Follows the same conventions as the tables erd.md already approved:
-- surrogate text id, FKs to territory/fiscal_years, enum for the closed set of
-- values (method), RLS on with no policies (deny by default, same as every
-- other table). full_year_ebitda and var_vs_budget are stored (not recomputed
-- later) because a saved version is a point-in-time record, same reasoning as
-- reports.frozen_figures — "move vs prior version" is derived at read time by
-- comparing consecutive rows, so it isn't stored redundantly.

begin;

create type forecast_method as enum ('budget', 'runrate');

create table forecast_versions (
  id               text primary key default gen_random_uuid()::text,
  territory_key    integer         not null references territory (territory_key),
  fiscal_year      integer         not null references fiscal_years (year),
  cutover_month    integer         not null check (cutover_month between 1 and 12),
  method           forecast_method not null,
  sales_driver     numeric         not null,
  cos_driver       numeric         not null,
  opex_driver      numeric         not null,
  full_year_ebitda numeric         not null,
  var_vs_budget    numeric         not null,
  created_at       timestamptz     not null default now()
);

alter table forecast_versions enable row level security;

commit;
