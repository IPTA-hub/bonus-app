import { neon } from "@neondatabase/serverless";

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL environment variable is not set");
  return neon(url);
}

export async function initDb() {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS submissions (
      id SERIAL PRIMARY KEY,
      therapist_slug VARCHAR(100) NOT NULL,
      week_start DATE NOT NULL,
      scheduled INTEGER NOT NULL,
      seen INTEGER NOT NULL,
      is_pto BOOLEAN NOT NULL DEFAULT FALSE,
      notes TEXT DEFAULT '',
      arrival_rate DECIMAL(6,4),
      bonus_amount DECIMAL(8,2),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(therapist_slug, week_start)
    )
  `;
}

export interface Submission {
  id: number;
  therapist_slug: string;
  week_start: string;
  scheduled: number;
  seen: number;
  is_pto: boolean;
  notes: string;
  arrival_rate: number | null;
  bonus_amount: number | null;
  created_at: string;
}

export async function upsertSubmission(data: {
  therapist_slug: string;
  week_start: string;
  scheduled: number;
  seen: number;
  is_pto: boolean;
  notes: string;
  arrival_rate: number | null;
  bonus_amount: number;
}) {
  const sql = getDb();
  await sql`
    INSERT INTO submissions (therapist_slug, week_start, scheduled, seen, is_pto, notes, arrival_rate, bonus_amount, updated_at)
    VALUES (${data.therapist_slug}, ${data.week_start}, ${data.scheduled}, ${data.seen}, ${data.is_pto}, ${data.notes}, ${data.arrival_rate}, ${data.bonus_amount}, CURRENT_TIMESTAMP)
    ON CONFLICT (therapist_slug, week_start)
    DO UPDATE SET
      scheduled = EXCLUDED.scheduled,
      seen = EXCLUDED.seen,
      is_pto = EXCLUDED.is_pto,
      notes = EXCLUDED.notes,
      arrival_rate = EXCLUDED.arrival_rate,
      bonus_amount = EXCLUDED.bonus_amount,
      updated_at = CURRENT_TIMESTAMP
  `;
}

export async function getSubmissions(therapistSlug: string): Promise<Submission[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM submissions
    WHERE therapist_slug = ${therapistSlug}
    ORDER BY week_start ASC
  `;
  return rows as unknown as Submission[];
}

export async function getAllSubmissions(): Promise<Submission[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM submissions
    ORDER BY week_start ASC, therapist_slug ASC
  `;
  return rows as unknown as Submission[];
}

export async function getSubmissionsByDateRange(
  start: string,
  end: string
): Promise<Submission[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM submissions
    WHERE week_start >= ${start} AND week_start <= ${end}
    ORDER BY week_start ASC, therapist_slug ASC
  `;
  return rows as unknown as Submission[];
}
