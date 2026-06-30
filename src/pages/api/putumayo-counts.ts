// GET /api/putumayo-counts
//
// Live registration tallies for the Putumayo Carrera badge on the home page:
//   - putumayo  → runners signed up to the Putumayo hub
//   - worldwide → all runners across every hub/location, this edition
//
// Both sum the `count` column so seed rows that aggregate several runners
// into one row are reflected correctly.

export const prerender = false;

import type { APIRoute } from "astro";
import { getTurso, EDITION_YEAR, HUB_ID } from "../../lib/turso";

export const GET: APIRoute = async () => {
  try {
    const db = getTurso();
    const res = await db.execute({
      sql: `
        SELECT
          COALESCE(SUM(count), 0) AS worldwide,
          COALESCE(SUM(CASE WHEN hub_id = ? THEN count ELSE 0 END), 0) AS putumayo
        FROM putumayo_loop_subscribers
        WHERE edition_year = ?
      `,
      args: [HUB_ID, EDITION_YEAR],
    });
    const row = res.rows[0] as unknown as {
      worldwide: number | bigint;
      putumayo: number | bigint;
    };
    return new Response(
      JSON.stringify({
        putumayo: Number(row.putumayo),
        worldwide: Number(row.worldwide),
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (err) {
    console.error("[putumayo-counts] query failed", err);
    return new Response(JSON.stringify({ error: "counts unavailable" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
