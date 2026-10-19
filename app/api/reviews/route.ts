import { getDatabase } from '@/lib/database';
import { ensureDatabase } from '@/lib/persistence';

export const runtime = 'nodejs';

type ReviewRow = {
  id: number;
  programId: string;
  displayName: string;
  rating: number;
  speedRating: number;
  message: string;
  staffReply: string | null;
  staffReplyAt: number | null;
  createdAt: number;
};

export async function GET() {
  await ensureDatabase();
  const result = await getDatabase().prepare(`SELECT
      id,
      program_id AS programId,
      display_name AS displayName,
      rating,
      speed_rating AS speedRating,
      message,
      staff_reply AS staffReply,
      staff_reply_at AS staffReplyAt,
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

    await ensureDatabase();
    const db = getDatabase();
    const application = await db.prepare("SELECT program_id AS programId FROM applications WHERE application_id = ? AND status = 'accepted'")
      .bind(applicationId)
      .first<{ programId: string }>();
    if (!application) return Response.json({ error: 'Accepted application ID not found.' }, { status: 404 });

    const existing = await db.prepare('SELECT id FROM reviews WHERE application_id = ?').bind(applicationId).first();
    if (existing) return Response.json({ error: 'A review has already been published for this application ID.' }, { status: 409 });

    const createdAt = Date.now();
    const insertResult = await db.prepare(`INSERT IGNORE INTO reviews (
      application_id, program_id, display_name, rating, speed_rating, message, published, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 1, ?)`)
      .bind(applicationId, application.programId, displayName, rating, speedRating, message, createdAt)
      .run();

    if (insertResult.meta.changes !== 1) {
      return Response.json({ error: 'A review has already been published for this application ID.' }, { status: 409 });
    }

    return Response.json({
      review: {
        programId: application.programId,
        displayName,
        rating,
        speedRating,
        message,
        staffReply: null,
        staffReplyAt: null,
        createdAt,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Review submission failed', error);
    return Response.json({ error: 'Check your application ID and complete every review field.' }, { status: 400 });
  }
}
