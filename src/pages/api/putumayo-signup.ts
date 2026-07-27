// POST /api/putumayo-signup
//
// Records a Putumayo Carrera registration from the signup banner on the home
// page into Turso (putumayo_loop_subscribers) — the same table the
// quinacare.org site writes to. Runners from this site join the local
// Putumayo hub by default (hub_id = "putumayo"), so they show up on the
// map as a Puerto el Carmen pin and count toward the Putumayo total.
//
// Like quinacare's signup route, this also fires best-effort notification
// mail (run manager + Putumayo hub captain) and a Spanish confirmation to
// the runner. We skip geocoding — lat/lng stay NULL and the repo falls
// back to the hub's coords for the map pin.

export const prerender = false;

import type { APIRoute } from "astro";
import {
  getTurso,
  ensureSignupColumns,
  EDITION_YEAR,
  HUB_ID,
} from "../../lib/turso";
import { sendMail } from "../../lib/mailer";

// "1k" is the kids' fun run (up to 12 years old); the rest match the
// distances the quinacare.org signup uses.
const ALLOWED_DISTANCES = new Set(["1k", "10k", "half", "full"]);

// Human distance labels (Spanish) for the notification + confirmation mail.
const DISTANCE_LABELS: Record<string, string> = {
  "1k": "1 km (carrera infantil)",
  "10k": "10 km",
  half: "21 km",
  full: "42 km",
};

// Sexo — matches the values the source form used.
const ALLOWED_SEX = new Set(["Mujer", "Hombre"]);

// Edad por rango (value -> human label stored in the DB / mail). "ninos"
// is the children bracket the 1 km run is reserved for.
const NINOS_RANGE = "ninos";
const AGE_RANGE_LABELS: Record<string, string> = {
  ninos: "Hasta 12 años (niños)",
  "13-18": "13 a 18 años",
  "19-35": "19 a 35 años",
  "36+": "36 años en adelante",
};

// Putumayo Carrera 2026 contacts — mirrors src/data/putumayoLoop.ts on the
// quinacare.org side (runManager + the Putumayo hub captain).
const RUN_DATE_LABEL = "18 de octubre de 2026";
const RUN_MANAGER_EMAIL = "yvonne.vanderende@quinacare.org";
const HUB_CAPTAIN_EMAIL = "hospitalsanmiguel@quinacare.org";

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
  const sex = String(body.sex ?? "").trim();
  const ageRange = String(body.ageRange ?? "").trim();
  const address = String(body.address ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const distance = String(body.distance ?? "");

  // Every field is required.
  if (
    !fullName ||
    !email ||
    !ALLOWED_SEX.has(sex) ||
    !AGE_RANGE_LABELS[ageRange] ||
    !address ||
    !phone ||
    !ALLOWED_DISTANCES.has(distance)
  ) {
    return json({ error: "Missing or invalid fields" }, 400);
  }
  // The 1 km fun run is reserved for children up to 12 years old.
  if (distance === "1k" && ageRange !== NINOS_RANGE) {
    return json({ error: "1k is for children up to 12 years old" }, 400);
  }

  const ageRangeLabel = AGE_RANGE_LABELS[ageRange];

  // The subscribers table keeps first/last name separate. Re-use the
  // single name as the surname when the runner only enters one word.
  const [firstName, ...rest] = fullName.split(/\s+/);
  const lastName = rest.join(" ") || firstName;

  try {
    const db = getTurso();
    // Make sure the (nullable) extra columns exist before referencing them.
    await ensureSignupColumns(db);
    await db.execute({
      sql: `
        INSERT INTO putumayo_loop_subscribers
          (external_id, edition_year, first_name, last_name, email,
           hub_id, lat, lng, location, count, distance,
           sex, age_range, address, phone, signed_up_at)
        VALUES (NULL, ?, ?, ?, ?, ?, NULL, NULL, NULL, 1, ?,
                ?, ?, ?, ?, datetime('now'))
      `,
      args: [
        EDITION_YEAR,
        firstName,
        lastName,
        email,
        HUB_ID,
        distance,
        sex,
        ageRangeLabel,
        address,
        phone,
      ],
    });
  } catch (err) {
    console.error("[putumayo-signup] Turso insert failed", err);
    return json({ error: "Could not save your signup" }, 500);
  }

  const distanceLabel = DISTANCE_LABELS[distance] ?? distance;

  // Operational notice to the run manager and the Putumayo hub captain.
  // Best-effort: a mail failure must not fail the signup that's already
  // saved, so each send is wrapped on its own.
  const details = [
    `Corredor/a: ${firstName} ${lastName} <${email}>`,
    `Edición: Putumayo Carrera ${EDITION_YEAR}`,
    `Fecha: ${RUN_DATE_LABEL}`,
    `Distancia: ${distanceLabel}`,
    `Sexo: ${sex}`,
    `Edad: ${ageRangeLabel}`,
    `Dirección: ${address}`,
    `Teléfono/Celular: ${phone}`,
    `Hub: Putumayo (Puerto el Carmen)`,
  ].join("\n");

  try {
    await sendMail({
      to: `${RUN_MANAGER_EMAIL}, ${HUB_CAPTAIN_EMAIL}`,
      subject: `[Putumayo Carrera ${EDITION_YEAR}] Nueva inscripción — ${firstName} ${lastName}`,
      text: `${firstName} ${lastName} se acaba de inscribir a la Putumayo Carrera ${EDITION_YEAR}.\n\n${details}`,
      replyTo: `${firstName} ${lastName} <${email}>`,
    });
  } catch (err) {
    console.error("[putumayo-signup] notification mail failed", err);
  }

  // Confirmation to the runner, in Spanish (formal "usted").
  try {
    await sendMail({
      to: email,
      subject: `Confirmación de inscripción — Putumayo Carrera ${EDITION_YEAR}`,
      text:
        `Hola ${firstName},\n\n` +
        `¡Gracias por inscribirse a la Putumayo Carrera ${EDITION_YEAR}! ` +
        `Usted corre por la salud de la Amazonía ecuatoriana.\n\n` +
        `Estos son los datos de su inscripción:\n` +
        `• Fecha: ${RUN_DATE_LABEL}\n` +
        `• Distancia: ${distanceLabel}\n` +
        `• Hub: Putumayo (Puerto el Carmen)\n\n` +
        `Le enviaremos más detalles a medida que se acerque la fecha. ` +
        `Si tiene alguna pregunta, escríbanos a ${HUB_CAPTAIN_EMAIL}.\n\n` +
        `Un saludo,\nHospital San Miguel`,
      replyTo: HUB_CAPTAIN_EMAIL,
    });
  } catch (err) {
    console.error("[putumayo-signup] runner confirmation mail failed", err);
  }

  return json({ ok: true }, 200);
};
