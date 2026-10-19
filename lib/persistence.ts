import { getDatabase } from '@/lib/database';

let databaseReady: Promise<void> | null = null;

export async function ensureDatabase() {
  if (!databaseReady) {
    databaseReady = initializeDatabase().catch((error) => {
      databaseReady = null;
      throw error;
    });
  }
  return databaseReady;
}

async function initializeDatabase() {
  const db = getDatabase();
  await db.prepare(`CREATE TABLE IF NOT EXISTS applications (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    intake_id VARCHAR(40) NOT NULL,
    application_id VARCHAR(64) NOT NULL,
    program_id VARCHAR(32) NOT NULL,
    given_name VARCHAR(80) NOT NULL,
    family_name VARCHAR(80) NOT NULL,
    email VARCHAR(160) NOT NULL,
    phone VARCHAR(40) NOT NULL,
    nationality VARCHAR(100) NOT NULL,
    residence_country VARCHAR(100) NOT NULL,
    other_nationalities VARCHAR(160) NOT NULL,
    family_size TINYINT UNSIGNED NOT NULL,
    available_funds VARCHAR(40) NOT NULL,
    timeline VARCHAR(40) NOT NULL,
    occupation VARCHAR(120) NOT NULL,
    source_of_funds VARCHAR(120) NOT NULL,
    compliance_answers TEXT NOT NULL,
    proof_file_key VARCHAR(255) NOT NULL,
    proof_file_name VARCHAR(180) NOT NULL,
    proof_content_type VARCHAR(100) NOT NULL,
    proof_size INT UNSIGNED NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'submitted',
    created_at BIGINT UNSIGNED NOT NULL,
    UNIQUE KEY idx_applications_intake_id (intake_id),
    UNIQUE KEY idx_applications_application_id (application_id),
    KEY idx_applications_status_created (status, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS reviews (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    application_id VARCHAR(64) NOT NULL,
    program_id VARCHAR(32) NOT NULL,
    display_name VARCHAR(60) NOT NULL,
    rating TINYINT UNSIGNED NOT NULL,
    speed_rating TINYINT UNSIGNED NOT NULL,
    message TEXT NOT NULL,
    staff_reply TEXT NULL,
    staff_reply_at BIGINT UNSIGNED NULL,
    published TINYINT(1) NOT NULL DEFAULT 1,
    created_at BIGINT UNSIGNED NOT NULL,
    UNIQUE KEY idx_reviews_application_id (application_id),
    KEY idx_reviews_published_created (published, created_at),
    CONSTRAINT fk_reviews_application
      FOREIGN KEY (application_id) REFERENCES applications(application_id)
      ON UPDATE CASCADE ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`).run();
}

export function createApplicationId() {
  const entropy = crypto.randomUUID().replaceAll('-', '').slice(0, 20).toUpperCase();
  return `CIB-${new Date().getUTCFullYear()}-${entropy}`;
}

export function createIntakeReference() {
  const entropy = crypto.randomUUID().replaceAll('-', '').slice(0, 14).toUpperCase();
  return `INT-${new Date().getUTCFullYear()}-${entropy}`;
}

export function isAgentRequest(request: Request, expectedCode?: string) {
  const receivedCode = request.headers.get('x-agent-code') ?? '';
  if (!expectedCode || receivedCode.length !== expectedCode.length) return false;
  let difference = 0;
  for (let index = 0; index < expectedCode.length; index += 1) {
    difference |= expectedCode.charCodeAt(index) ^ receivedCode.charCodeAt(index);
  }
  return difference === 0;
}

export function textField(form: FormData, name: string, maxLength: number) {
  const value = form.get(name);
  if (typeof value !== 'string') throw new Error(`Missing ${name}`);
  const clean = value.trim();
  if (!clean || clean.length > maxLength) throw new Error(`Invalid ${name}`);
  return clean;
}
