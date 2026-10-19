import { getDatabase } from '@/lib/database';
import { createApplicationId, ensureDatabase, isAgentRequest } from '@/lib/persistence';
import { deletePrivateFile } from '@/lib/storage';

export const runtime = 'nodejs';

type AgentApplication = {
  intakeReference: string;
  applicationId: string | null;
  programId: string;
  givenName: string;
  familyName: string;
  email: string;
  phone: string;
  nationality: string;
  residenceCountry: string;
  otherNationalities: string;
  familySize: number;
  availableFunds: string;
  timeline: string;
  occupation: string;
  sourceOfFunds: string;
  complianceAnswers: string;
  proofFileName: string;
  status: string;
  createdAt: number;
};

const programIds = new Set(['antigua', 'dominica', 'grenada', 'st-kitts', 'st-lucia', 'turkiye']);

function unauthorized() {
  return Response.json({ error: 'Agent access code is invalid.' }, { status: 401 });
}

function intakeReferenceFrom(body: Record<string, unknown>) {
  const intakeReference = String(body.intakeReference ?? '').trim().toUpperCase();
  return /^INT-\d{4}-[A-F0-9]{14}$/.test(intakeReference) ? intakeReference : null;
}

function requiredText(body: Record<string, unknown>, field: string, maxLength: number) {
  const value = String(body[field] ?? '').trim();
  if (!value || value.length > maxLength) throw new Error(`Invalid ${field}`);
  return value;
}

export async function GET(request: Request) {
  if (!isAgentRequest(request, process.env.AGENT_ACCESS_CODE)) return unauthorized();
  await ensureDatabase();

  const result = await getDatabase().prepare(`SELECT
      intake_id AS intakeReference,
      CASE WHEN status = 'accepted' THEN application_id ELSE NULL END AS applicationId,
      program_id AS programId,
      given_name AS givenName,
      family_name AS familyName,
      email,
      phone,
      nationality,
      residence_country AS residenceCountry,
      other_nationalities AS otherNationalities,
      family_size AS familySize,
      available_funds AS availableFunds,
      timeline,
      occupation,
      source_of_funds AS sourceOfFunds,
      compliance_answers AS complianceAnswers,
      proof_file_name AS proofFileName,
      status,
      created_at AS createdAt
    FROM applications
    WHERE status IN ('submitted', 'accepted')
    ORDER BY created_at DESC
    LIMIT 100`).all<AgentApplication>();

  return Response.json({ applications: result.results ?? [] }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: Request) {
  if (!isAgentRequest(request, process.env.AGENT_ACCESS_CODE)) return unauthorized();

  try {
    const body = await request.json() as Record<string, unknown>;
    const intakeReference = intakeReferenceFrom(body);
    if (!intakeReference) {
      return Response.json({ error: 'Intake reference is invalid.' }, { status: 400 });
    }

    await ensureDatabase();
    const db = getDatabase();
    const application = await db.prepare(`SELECT application_id AS applicationId, status
      FROM applications WHERE intake_id = ?`)
      .bind(intakeReference)
      .first<{ applicationId: string; status: string }>();

    if (!application) return Response.json({ error: 'Intake was not found.' }, { status: 404 });
    if (application.status === 'accepted') {
      return Response.json({ applicationId: application.applicationId, alreadyAccepted: true });
    }
    if (application.status !== 'submitted') {
      return Response.json({ error: 'This intake cannot be accepted.' }, { status: 409 });
    }

    const applicationId = createApplicationId();
    const updateResult = await db.prepare(`UPDATE applications
      SET application_id = ?, status = 'accepted'
      WHERE intake_id = ? AND status = 'submitted'`)
      .bind(applicationId, intakeReference)
      .run();

    if (updateResult.meta.changes !== 1) {
      const accepted = await db.prepare(`SELECT application_id AS applicationId
        FROM applications WHERE intake_id = ? AND status = 'accepted'`)
        .bind(intakeReference)
        .first<{ applicationId: string }>();
      if (accepted) return Response.json({ applicationId: accepted.applicationId, alreadyAccepted: true });
      return Response.json({ error: 'This intake could not be accepted.' }, { status: 409 });
    }

    return Response.json({ applicationId }, { status: 201 });
  } catch (error) {
    console.error('Agent acceptance failed', error);
    return Response.json({ error: 'The intake could not be accepted.' }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  if (!isAgentRequest(request, process.env.AGENT_ACCESS_CODE)) return unauthorized();

  try {
    const body = await request.json() as Record<string, unknown>;
    const intakeReference = intakeReferenceFrom(body);
    if (!intakeReference) return Response.json({ error: 'Intake reference is invalid.' }, { status: 400 });

    const programId = requiredText(body, 'programId', 32);
    if (!programIds.has(programId)) return Response.json({ error: 'Program is invalid.' }, { status: 400 });
    const email = requiredText(body, 'email', 160).toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return Response.json({ error: 'Email is invalid.' }, { status: 400 });
    const familySize = Number(body.familySize);
    if (!Number.isInteger(familySize) || familySize < 1 || familySize > 20) {
      return Response.json({ error: 'Family size must be between 1 and 20.' }, { status: 400 });
    }

    const fields = {
      programId,
      givenName: requiredText(body, 'givenName', 80),
      familyName: requiredText(body, 'familyName', 80),
      email,
      phone: requiredText(body, 'phone', 40),
      nationality: requiredText(body, 'nationality', 100),
      residenceCountry: requiredText(body, 'residenceCountry', 100),
      otherNationalities: String(body.otherNationalities ?? '').trim().slice(0, 160),
      familySize,
      availableFunds: requiredText(body, 'availableFunds', 40),
      timeline: requiredText(body, 'timeline', 40),
      occupation: requiredText(body, 'occupation', 120),
      sourceOfFunds: requiredText(body, 'sourceOfFunds', 120),
    };

    await ensureDatabase();
    const db = getDatabase();
    const application = await db.prepare('SELECT application_id AS applicationId FROM applications WHERE intake_id = ?')
      .bind(intakeReference)
      .first<{ applicationId: string }>();
    if (!application) return Response.json({ error: 'Intake was not found.' }, { status: 404 });

    const results = await db.batch([
      db.prepare(`UPDATE applications SET
        program_id = ?, given_name = ?, family_name = ?, email = ?, phone = ?,
        nationality = ?, residence_country = ?, other_nationalities = ?, family_size = ?,
        available_funds = ?, timeline = ?, occupation = ?, source_of_funds = ?
        WHERE intake_id = ?`)
        .bind(
          fields.programId,
          fields.givenName,
          fields.familyName,
          fields.email,
          fields.phone,
          fields.nationality,
          fields.residenceCountry,
          fields.otherNationalities,
          fields.familySize,
          fields.availableFunds,
          fields.timeline,
          fields.occupation,
          fields.sourceOfFunds,
          intakeReference,
        ),
      db.prepare('UPDATE reviews SET program_id = ? WHERE application_id = ?')
        .bind(fields.programId, application.applicationId),
    ]);

    if (results[0].meta.changes !== 1) {
      return Response.json({ error: 'Intake was not updated.' }, { status: 409 });
    }
    return Response.json({ application: { intakeReference, ...fields } });
  } catch (error) {
    console.error('Agent application update failed', error);
    return Response.json({ error: 'Check every application field and try again.' }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  if (!isAgentRequest(request, process.env.AGENT_ACCESS_CODE)) return unauthorized();

  try {
    const body = await request.json() as Record<string, unknown>;
    const intakeReference = intakeReferenceFrom(body);
    if (!intakeReference) return Response.json({ error: 'Intake reference is invalid.' }, { status: 400 });

    await ensureDatabase();
    const db = getDatabase();
    const application = await db.prepare(`SELECT application_id AS applicationId, proof_file_key AS proofFileKey
      FROM applications WHERE intake_id = ?`)
      .bind(intakeReference)
      .first<{ applicationId: string; proofFileKey: string }>();
    if (!application) return Response.json({ error: 'Intake was not found.' }, { status: 404 });

    const results = await db.batch([
      db.prepare('DELETE FROM reviews WHERE application_id = ?').bind(application.applicationId),
      db.prepare('DELETE FROM applications WHERE intake_id = ?').bind(intakeReference),
    ]);
    if (results[1].meta.changes !== 1) {
      return Response.json({ error: 'Intake was not deleted.' }, { status: 409 });
    }
    await deletePrivateFile(application.proofFileKey);
    return Response.json({ deleted: true });
  } catch (error) {
    console.error('Agent application deletion failed', error);
    return Response.json({ error: 'The intake could not be deleted.' }, { status: 400 });
  }
}
