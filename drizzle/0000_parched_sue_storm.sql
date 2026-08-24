CREATE TABLE `calendar_events` (
	`id` text PRIMARY KEY NOT NULL,
	`interviewee_name` text NOT NULL,
	`publish_date` text NOT NULL,
	`memo` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `interviews` (
	`id` text PRIMARY KEY NOT NULL,
	`interviewee_name` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`article_json` text NOT NULL,
	`needs_check_json` text DEFAULT '[]' NOT NULL,
	`revision_summary_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
