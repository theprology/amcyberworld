import { env } from 'cloudflare:workers';
import { ensureDatabase } from '@/lib/persistence';

export const runtime = 'edge';

type ReviewRow = {
  id: number;
  programId: string;
  displayName: string;
  rating: number;
  speedRating: number;
  message: string;
  createdAt: number;
};

export async function GET() {
  await ensureDatabase(env.DB);
  const result = await env.DB.prepare(`SELECT
      id,
      program_id AS programId,
      display_name AS displayName,
      rating,
      speed_rating AS speedRating,
      message,
      created_at AS createdAt
    FROM reviews
    WHERE published = 1
    ORDER BY created_at DESC
    LIMIT 50`).all<ReviewRow>();

  return Response.json({ reviews: result.results ?? [] }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const applicationId = String(body.applicationId ?? '').trim().toUpperCase();
    const displayName = String(body.displayName ?? '').trim();
    const message = String(body.message ?? '').trim();
    const rating = Number(body.rating);
    const speedRating = Number(body.speedRating);

    if (!/^CIB-\d{4}-[A-F0-9]{20}$/.test(applicationId)) throw new Error('Invalid application ID');
    if (displayName.length < 2 || displayName.length > 60) throw new Error('Invalid display name');
    if (message.length < 30 || message.length > 800) throw new Error('Invalid review');
    if (![rating, speedRating].every((value) => Number.isInteger(value) && value >= 1 && value <= 5)) throw new Error('Invalid rating');
    if (body.confirmed !== true) throw new Error('Confirmation required');

    await ensureDatabase(env.DB);
    const application = await env.DB.prepare('SELECT program_id AS programId FROM applications WHERE application_id = ?')
      .bind(applicationId)
      .first<{ programId: string }>();
    if (!application) return Response.json({ error: 'Application ID not found.' }, { status: 404 });

    const existing = await env.DB.prepare('SELECT id FROM reviews WHERE application_id = ?').bind(applicationId).first();
    if (existing) return Response.json({ error: 'A review has already been published for this application ID.' }, { status: 409 });

    const createdAt = Date.now();
    await env.DB.prepare(`INSERT INTO reviews (
      application_id, program_id, display_name, rating, speed_rating, message, published, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 1, ?)`)
      .bind(applicationId, application.programId, displayName, rating, speedRating, message, createdAt)
      .run();

    return Response.json({
      review: { programId: application.programId, displayName, rating, speedRating, message, createdAt },
    }, { status: 201 });
  } catch (error) {
    console.error('Review submission failed', error);
    return Response.json({ error: 'Check your application ID and complete every review field.' }, { status: 400 });
  }
}
