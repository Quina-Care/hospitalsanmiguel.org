// POST /api/putumayo-signup
//
// Records a Putumayo Run registration from the signup banner on the home
// page into Turso (putumayo_loop_subscribers) — the same table the
// quinacare.org site writes to. Runners from this site join the local
// Putumayo hub by default (hub_id = "putumayo"), so they show up on the
// map as a Puerto el Carmen pin and count toward the Putumayo total.
//
// We deliberately keep this lean compared to quinacare's signup route:
// no geocoding and no notification mail, just the durable insert. Lat/lng
// stay NULL and the repo falls back to the hub's coords for the map pin.

export const prerender = false;

import type { APIRoute } from "astro";
import { getTurso, EDITION_YEAR, HUB_ID } from "../../lib/turso";

// "1k" is the kids' fun run (up to 12 years old); the rest match the
// distances the quinacare.org signup uses.
const ALLOWED_DISTANCES = new Set(["1k", "10k", "half", "full"]);

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const fullName = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const distance = String(body.distance ?? "");
  // Age is optional; keep it only when it's a sensible whole number.
  const ageNum = Number(body.age);
  const age =
    Number.isInteger(ageNum) && ageNum > 0 && ageNum < 120 ? ageNum : null;

  if (!fullName || !email || !ALLOWED_DISTANCES.has(distance)) {
    return json({ error: "Missing or invalid fields" }, 400);
  }
  // The 1 km fun run is reserved for children up to 12 years old.
  if (distance === "1k" && (age === null || age > 12)) {
    return json({ error: "1k is for children up to 12 years old" }, 400);
  }

  // The subscribers table keeps first/last name separate. Re-use the
  // single name as the surname when the runner only enters one word.
  const [firstName, ...rest] = fullName.split(/\s+/);
  const lastName = rest.join(" ") || firstName;

  try {
    const db = getTurso();
    await db.execute({
      sql: `
        INSERT INTO putumayo_loop_subscribers
          (external_id, edition_year, first_name, last_name, email,
           hub_id, lat, lng, location, count, distance, age, signed_up_at)
        VALUES (NULL, ?, ?, ?, ?, ?, NULL, NULL, NULL, 1, ?, ?, datetime('now'))
      `,
      args: [EDITION_YEAR, firstName, lastName, email, HUB_ID, distance, age],
    });
  } catch (err) {
    console.error("[putumayo-signup] Turso insert failed", err);
    return json({ error: "Could not save your signup" }, 500);
  }

  return json({ ok: true }, 200);
};
