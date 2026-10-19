import { getDatabase } from '@/lib/database';
import { ensureDatabase, isAgentRequest } from '@/lib/persistence';
import { readPrivateFile } from '@/lib/storage';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!isAgentRequest(request, process.env.AGENT_ACCESS_CODE)) {
    return Response.json({ error: 'Agent access code is invalid.' }, { status: 401 });
  }

  const intakeReference = new URL(request.url).searchParams.get('intakeReference')?.trim().toUpperCase() ?? '';
  if (!/^INT-\d{4}-[A-F0-9]{14}$/.test(intakeReference)) {
    return Response.json({ error: 'Intake reference is invalid.' }, { status: 400 });
  }

  await ensureDatabase();
  const application = await getDatabase().prepare(`SELECT
      proof_file_key AS proofFileKey,
      proof_file_name AS proofFileName,
      proof_content_type AS proofContentType
    FROM applications WHERE intake_id = ?`)
    .bind(intakeReference)
    .first<{ proofFileKey: string; proofFileName: string; proofContentType: string }>();

  if (!application) return Response.json({ error: 'Intake was not found.' }, { status: 404 });
  const file = await readPrivateFile(application.proofFileKey);
  if (!file) return Response.json({ error: 'Proof-of-funds file was not found.' }, { status: 404 });

  const safeName = application.proofFileName.replace(/[\r\n"\\]/g, '_');
  return new Response(new Uint8Array(file), {
    headers: {
      'Content-Type': application.proofContentType,
      'Content-Disposition': `attachment; filename="${safeName}"`,
      'Cache-Control': 'no-store, private',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
