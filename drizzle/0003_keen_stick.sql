CREATE TABLE `art_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`workspace_key` text NOT NULL,
	`runpod_id` text NOT NULL,
	`status` text NOT NULL,
	`prompt` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`seed` integer NOT NULL,
	`file_id` text,
	`error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_art_jobs_owner_created` ON `art_jobs` (`owner_id`,`created_at`);