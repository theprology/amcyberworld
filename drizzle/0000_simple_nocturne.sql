CREATE TABLE `applications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`application_id` text NOT NULL,
	`program_id` text NOT NULL,
	`given_name` text NOT NULL,
	`family_name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`nationality` text NOT NULL,
	`residence_country` text NOT NULL,
	`other_nationalities` text NOT NULL,
	`family_size` integer NOT NULL,
	`available_funds` text NOT NULL,
	`timeline` text NOT NULL,
	`occupation` text NOT NULL,
	`source_of_funds` text NOT NULL,
	`compliance_answers` text NOT NULL,
	`proof_file_key` text NOT NULL,
	`proof_file_name` text NOT NULL,
	`proof_content_type` text NOT NULL,
	`proof_size` integer NOT NULL,
	`status` text DEFAULT 'submitted' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_applications_application_id` ON `applications` (`application_id`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`application_id` text NOT NULL,
	`program_id` text NOT NULL,
	`display_name` text NOT NULL,
	`rating` integer NOT NULL,
	`speed_rating` integer NOT NULL,
	`message` text NOT NULL,
	`published` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_reviews_application_id` ON `reviews` (`application_id`);