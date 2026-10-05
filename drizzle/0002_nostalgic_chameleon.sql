CREATE TABLE `workspace_file_chunks` (
	`file_id` text NOT NULL,
	`seq` integer NOT NULL,
	`bytes` blob NOT NULL,
	PRIMARY KEY(`file_id`, `seq`)
);
--> statement-breakpoint
CREATE TABLE `workspace_files` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`workspace_key` text NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`chunks` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_workspace_files_owner_key` ON `workspace_files` (`owner_id`,`workspace_key`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`owner_id` text NOT NULL,
	`key` text NOT NULL,
	`data` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`owner_id`, `key`)
);
