CREATE TABLE `waitlist` (
	`email` text PRIMARY KEY NOT NULL,
	`consent_version` text DEFAULT 'early-access-v1' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
