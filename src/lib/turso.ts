// Turso (libSQL) client. Reads credentials from `TURSO_DATABASE_URL`
// and `TURSO_AUTH_TOKEN` in the environment (.env at the repo root).
// Points at the same database the quinacare.org project uses, so the
// Putumayo Carrera signups recorded here land in `putumayo_loop_subscribers`
// alongside the ones from the main site.
//
// Throws at call time if either credential is missing so the API route
// can return a 500 with a useful message instead of bricking at import.

import { createClient, type Client } from "@libsql/client";

let cached: Client | undefined;

export function getTurso(): Client {
  if (cached) return cached;
  // Read at runtime from the function's environment first — Netlify injects
  // the production env vars into process.env at request time — falling back
  // to import.meta.env for `astro dev` (which loads .env). Using process.env
  // avoids Vite inlining the credentials into the build artifact, so setting
  // the vars for production runtime (not build) is enough.
  const url =
    process.env.TURSO_DATABASE_URL ?? import.meta.env.TURSO_DATABASE_URL;
  const authToken =
    process.env.TURSO_AUTH_TOKEN ?? import.meta.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    throw new Error(
      "Turso not configured: set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env",
    );
  }
  cached = createClient({ url, authToken });
  return cached;
}

// The base putumayo_loop_subscribers schema (created by quinacare's
// migration) doesn't have the extra fields the hospital-site registration
// collects (sexo, edad por rango, dirección, teléfono). Rather than require
// a manual migration on every database this connects to, add the nullable
// columns on demand — idempotently and only once per process. Column names
// here are fixed constants, so interpolating them into DDL is safe.
const SIGNUP_COLUMNS: Record<string, string> = {
  sex: "TEXT",
  age_range: "TEXT",
  address: "TEXT",
  phone: "TEXT",
};

let signupColumnsEnsured = false;
export async function ensureSignupColumns(db: Client): Promise<void> {
  if (signupColumnsEnsured) return;
  const info = await db.execute(
    "PRAGMA table_info(putumayo_loop_subscribers)",
  );
  const existing = new Set(
    (info.rows as unknown as Array<{ name: string }>).map((r) => r.name),
  );
  for (const [col, type] of Object.entries(SIGNUP_COLUMNS)) {
    if (existing.has(col)) continue;
    try {
      await db.execute(
        `ALTER TABLE putumayo_loop_subscribers ADD COLUMN ${col} ${type}`,
      );
    } catch {
      // A concurrent request may have added it first — that's fine.
    }
  }
  signupColumnsEnsured = true;
}

// The Putumayo Carrera edition + hub these signups attach to. Runners who
// sign up from the hospital site join the local Putumayo hub by default.
export const EDITION_YEAR = 2026;
export const HUB_ID = "putumayo";
