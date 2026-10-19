import { getDatabase } from '@/lib/database';
import { ensureDatabase, isAgentRequest } from '@/lib/persistence';

export const runtime = 'nodejs';

type AgentReview = {
  id: number;
  applicationId: string;
  programId: string;
  displayName: string;
  rating: number;
  speedRating: number;
  message: string;
  staffReply: string | null;
  staffReplyAt: number | null;
  createdAt: number;
};

function unauthorized() {
  return Response.json({ error: 'Agent access code is invalid.' }, { status: 401 });
}

function reviewIdFrom(body: Record<string, unknown>) {
  const reviewId = Number(body.reviewId);
  return Number.isInteger(reviewId) && reviewId > 0 ? reviewId : null;
}

export async function GET(request: Request) {
  if (!isAgentRequest(request, process.env.AGENT_ACCESS_CODE)) return unauthorized();
  await ensureDatabase();

  const result = await getDatabase().prepare(`SELECT
      id,
      application_id AS applicationId,
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
    LIMIT 100`).all<AgentReview>();

  return Response.json({ reviews: result.results ?? [] }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function PATCH(request: Request) {
  if (!isAgentRequest(request, process.env.AGENT_ACCESS_CODE)) return unauthorized();

  try {
    const body = await request.json() as Record<string, unknown>;
    const reviewId = reviewIdFrom(body);
    if (!reviewId) {
      return Response.json({ error: 'Review is invalid.' }, { status: 400 });
    }

    await ensureDatabase();
    const db = getDatabase();
    if (body.action === 'edit') {
      const displayName = String(body.displayName ?? '').trim();
      const message = String(body.message ?? '').trim();
      const rating = Number(body.rating);
      const speedRating = Number(body.speedRating);
      if (displayName.length < 2 || displayName.length > 60) {
        return Response.json({ error: 'Display name must be between 2 and 60 characters.' }, { status: 400 });
      }
      if (message.length < 30 || message.length > 800) {
        return Response.json({ error: 'Review must be between 30 and 800 characters.' }, { status: 400 });
      }
      if (![rating, speedRating].every((value) => Number.isInteger(value) && value >= 1 && value <= 5)) {
        return Response.json({ error: 'Ratings must be between 1 and 5.' }, { status: 400 });
      }

      const result = await db.prepare(`UPDATE reviews
        SET display_name = ?, rating = ?, speed_rating = ?, message = ?
        WHERE id = ? AND published = 1`)
        .bind(displayName, rating, speedRating, message, reviewId)
        .run();
      if (result.meta.changes !== 1) {
        return Response.json({ error: 'Review was not found.' }, { status: 404 });
      }
      return Response.json({ review: { id: reviewId, displayName, rating, speedRating, message } });
    }

    const reply = String(body.reply ?? '').trim();
    if (reply.length > 1000) {
      return Response.json({ error: 'Reply must be 1,000 characters or fewer.' }, { status: 400 });
    }

    const replyAt = reply ? Date.now() : null;
    const result = await db.prepare(`UPDATE reviews
      SET staff_reply = ?, staff_reply_at = ?
      WHERE id = ? AND published = 1`)
      .bind(reply || null, replyAt, reviewId)
      .run();
    if (result.meta.changes !== 1) {
      return Response.json({ error: 'Review was not found.' }, { status: 404 });
    }

    return Response.json({ reviewId, staffReply: reply || null, staffReplyAt: replyAt });
  } catch (error) {
    console.error('Agent review reply failed', error);
    return Response.json({ error: 'The reply could not be saved.' }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  if (!isAgentRequest(request, process.env.AGENT_ACCESS_CODE)) return unauthorized();

  try {
    const body = await request.json() as Record<string, unknown>;
    const reviewId = reviewIdFrom(body);
    if (!reviewId) return Response.json({ error: 'Review is invalid.' }, { status: 400 });

    await ensureDatabase();
    const result = await getDatabase().prepare(`UPDATE reviews
      SET published = 0, staff_reply = NULL, staff_reply_at = NULL
      WHERE id = ? AND published = 1`)
      .bind(reviewId)
      .run();
    if (result.meta.changes !== 1) {
      return Response.json({ error: 'Review was not found.' }, { status: 404 });
    }
    return Response.json({ deleted: true });
  } catch (error) {
    console.error('Agent review deletion failed', error);
    return Response.json({ error: 'The review could not be deleted.' }, { status: 400 });
  }
}
