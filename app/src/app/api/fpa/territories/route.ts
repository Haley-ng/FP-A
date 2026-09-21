import { query } from "@/lib/db/client";

export async function GET() {
  const territories = await query<{ territory_key: number; country: string; region: string }>(
    "select territory_key, country, region from territory order by territory_key"
  );
  const rates = await query<{ territory_key: number; currency: string; rate: number }>(`
    select distinct on (territory_key) territory_key, currency, exchange_rate as rate
    from currency_rate
    order by territory_key, date desc
  `);
  const rateByTerritory = new Map(rates.map((r) => [r.territory_key, r]));

  return Response.json(
    territories.map((t) => ({
      key: t.territory_key,
      name: t.country,
      region: t.region,
      currency: rateByTerritory.get(t.territory_key)?.currency ?? "USD",
      rate: Number(rateByTerritory.get(t.territory_key)?.rate ?? 1),
    }))
  );
}
