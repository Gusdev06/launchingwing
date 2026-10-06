CREATE TABLE `login_codigos` (
	`email` text PRIMARY KEY NOT NULL,
	`hash` text NOT NULL,
	`expira` integer NOT NULL,
	`tentativas` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessoes` (
	`hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`expira` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_sessoes_user` ON `sessoes` (`user_id`);--> statement-breakpoint
CREATE TABLE `usuarios` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`criado_em` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `usuarios_email_unique` ON `usuarios` (`email`);