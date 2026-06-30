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
  const url = import.meta.env.TURSO_DATABASE_URL;
  const authToken = import.meta.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    throw new Error(
      "Turso not configured: set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env",
    );
  }
  cached = createClient({ url, authToken });
  return cached;
}

// The Putumayo Carrera edition + hub these signups attach to. Runners who
// sign up from the hospital site join the local Putumayo hub by default.
export const EDITION_YEAR = 2026;
export const HUB_ID = "putumayo";
