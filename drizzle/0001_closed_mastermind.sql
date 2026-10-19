ALTER TABLE `applications` ADD `intake_id` text;--> statement-breakpoint
UPDATE `applications` SET `intake_id` = 'LEGACY-' || `application_id` WHERE `intake_id` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_applications_intake_id` ON `applications` (`intake_id`);
