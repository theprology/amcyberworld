let databaseReady = false;

export async function ensureDatabase(db: D1Database) {
  if (databaseReady) return;

  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id TEXT NOT NULL UNIQUE,
      program_id TEXT NOT NULL,
      given_name TEXT NOT NULL,
      family_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      nationality TEXT NOT NULL,
      residence_country TEXT NOT NULL,
      other_nationalities TEXT NOT NULL,
      family_size INTEGER NOT NULL,
      available_funds TEXT NOT NULL,
      timeline TEXT NOT NULL,
      occupation TEXT NOT NULL,
      source_of_funds TEXT NOT NULL,
      compliance_answers TEXT NOT NULL,
      proof_file_key TEXT NOT NULL,
      proof_file_name TEXT NOT NULL,
      proof_content_type TEXT NOT NULL,
      proof_size INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'submitted',
      created_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id TEXT NOT NULL UNIQUE,
      program_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      speed_rating INTEGER NOT NULL CHECK (speed_rating BETWEEN 1 AND 5),
      message TEXT NOT NULL,
      published INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (application_id) REFERENCES applications(application_id)
    )`),
    db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_application_id ON applications(application_id)'),
    db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_application_id ON reviews(application_id)'),
  ]);
  await db.prepare('PRAGMA optimize').run();
  databaseReady = true;
}

export function createApplicationId() {
  const entropy = crypto.randomUUID().replaceAll('-', '').slice(0, 20).toUpperCase();
  return `CIB-${new Date().getUTCFullYear()}-${entropy}`;
}

export function textField(form: FormData, name: string, maxLength: number) {
  const value = form.get(name);
  if (typeof value !== 'string') throw new Error(`Missing ${name}`);
  const clean = value.trim();
  if (!clean || clean.length > maxLength) throw new Error(`Invalid ${name}`);
  return clean;
}
