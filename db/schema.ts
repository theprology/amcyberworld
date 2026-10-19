import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const applications = sqliteTable(
  'applications',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    intakeId: text('intake_id').notNull(),
    applicationId: text('application_id').notNull(),
    programId: text('program_id').notNull(),
    givenName: text('given_name').notNull(),
    familyName: text('family_name').notNull(),
    email: text('email').notNull(),
    phone: text('phone').notNull(),
    nationality: text('nationality').notNull(),
    residenceCountry: text('residence_country').notNull(),
    otherNationalities: text('other_nationalities').notNull(),
    familySize: integer('family_size').notNull(),
    availableFunds: text('available_funds').notNull(),
    timeline: text('timeline').notNull(),
    occupation: text('occupation').notNull(),
    sourceOfFunds: text('source_of_funds').notNull(),
    complianceAnswers: text('compliance_answers').notNull(),
    proofFileKey: text('proof_file_key').notNull(),
    proofFileName: text('proof_file_name').notNull(),
    proofContentType: text('proof_content_type').notNull(),
    proofSize: integer('proof_size').notNull(),
    status: text('status').notNull().default('submitted'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_applications_intake_id').on(table.intakeId),
    uniqueIndex('idx_applications_application_id').on(table.applicationId),
  ],
);

export const reviews = sqliteTable(
  'reviews',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    applicationId: text('application_id').notNull(),
    programId: text('program_id').notNull(),
    displayName: text('display_name').notNull(),
    rating: integer('rating').notNull(),
    speedRating: integer('speed_rating').notNull(),
    message: text('message').notNull(),
    staffReply: text('staff_reply'),
    staffReplyAt: integer('staff_reply_at'),
    published: integer('published', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [uniqueIndex('idx_reviews_application_id').on(table.applicationId)],
);
