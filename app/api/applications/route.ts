import { getDatabase } from '@/lib/database';
import { createIntakeReference, ensureDatabase, textField } from '@/lib/persistence';
import { deletePrivateFile, savePrivateFile } from '@/lib/storage';

export const runtime = 'nodejs';

const acceptedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const programIds = new Set(['antigua', 'dominica', 'grenada', 'st-kitts', 'st-lucia', 'turkiye']);

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get('proofOfFunds');
    if (!(file instanceof File) || file.size === 0 || file.size > 8 * 1024 * 1024 || !acceptedTypes.has(file.type)) {
      return Response.json({ error: 'Upload a PDF, JPG, PNG or WEBP file up to 8 MB.' }, { status: 400 });
    }

    const programId = textField(form, 'programId', 32);
    if (!programIds.has(programId)) return Response.json({ error: 'Select a supported program.' }, { status: 400 });

    const email = textField(form, 'email', 160).toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return Response.json({ error: 'Enter a valid email address.' }, { status: 400 });

    const familySize = Number(textField(form, 'familySize', 2));
    if (!Number.isInteger(familySize) || familySize < 1 || familySize > 20) {
      return Response.json({ error: 'Family size must be between 1 and 20.' }, { status: 400 });
    }

    if (form.get('consent') !== 'yes' || form.get('redacted') !== 'yes') {
      return Response.json({ error: 'Privacy consent and document redaction confirmation are required.' }, { status: 400 });
    }

    await ensureDatabase();
    const db = getDatabase();
    const intakeReference = createIntakeReference();
    const pendingApplicationKey = `PENDING-${intakeReference}`;
    const extension = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase().replace(/[^a-z0-9]/g, '') : 'bin';
    const fileKey = `applications/${intakeReference}/proof.${extension || 'bin'}`;

    await savePrivateFile(fileKey, file);

    try {
      await db.prepare(`INSERT INTO applications (
        intake_id, application_id, program_id, given_name, family_name, email, phone,
        nationality, residence_country, other_nationalities, family_size,
        available_funds, timeline, occupation, source_of_funds, compliance_answers,
        proof_file_key, proof_file_name, proof_content_type, proof_size, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?)`)
        .bind(
          intakeReference,
          pendingApplicationKey,
          programId,
          textField(form, 'givenName', 80),
          textField(form, 'familyName', 80),
          email,
          textField(form, 'phone', 40),
          textField(form, 'nationality', 100),
          textField(form, 'residenceCountry', 100),
          (typeof form.get('otherNationalities') === 'string' ? String(form.get('otherNationalities')).trim() : '').slice(0, 160),
          familySize,
          textField(form, 'availableFunds', 40),
          textField(form, 'timeline', 40),
          textField(form, 'occupation', 120),
          textField(form, 'sourceOfFunds', 120),
          JSON.stringify({
            politicallyExposed: textField(form, 'politicallyExposed', 8),
            criminalRecord: textField(form, 'criminalRecord', 8),
            visaRefusal: textField(form, 'visaRefusal', 8),
          }),
          fileKey,
          file.name.slice(0, 180),
          file.type,
          file.size,
          Date.now(),
        )
        .run();
    } catch (error) {
      await deletePrivateFile(fileKey);
      throw error;
    }

    const telegramText = encodeURIComponent(`Hello AMCYBERWORLD Support, my intake reference is ${intakeReference}. Please connect me with a case specialist.`);
    const siteOrigin = new URL(request.url).origin;
    const telegramContactUrl = process.env.TELEGRAM_CONTACT_URL?.trim();
    const verifiedContact = telegramContactUrl?.startsWith('https://t.me/')
      ? telegramContactUrl
      : null;
    const telegramUrl = verifiedContact
      ? `${verifiedContact}${verifiedContact.includes('?') ? '&' : '?'}draft_text=${telegramText}`
      : `https://t.me/share/url?url=${encodeURIComponent(siteOrigin)}&text=${telegramText}`;
    return Response.json({
      intakeReference,
      telegramUrl,
    }, { status: 201 });
  } catch (error) {
    console.error('Application submission failed', error);
    return Response.json({ error: 'We could not submit the application. Please review the form and try again.' }, { status: 400 });
  }
}
