-- Sprint 5: Multi-channel communication system (Slack-like)
-- Channels, members, messages, reactions, pins, read cursors, bookmarks

-- ── Channels ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "channels" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "topic" text,
  "type" text NOT NULL DEFAULT 'public',
  "team_id" uuid REFERENCES "agent_teams"("id") ON DELETE SET NULL,
  "project_id" uuid REFERENCES "projects"("id") ON DELETE SET NULL,
  "is_private" boolean NOT NULL DEFAULT false,
  "is_archived" boolean NOT NULL DEFAULT false,
  "bridge_type" text NOT NULL DEFAULT 'internal',
  "bridge_config" jsonb DEFAULT '{}',
  "last_message_at" timestamp with time zone,
  "message_count" integer NOT NULL DEFAULT 0,
  "member_count" integer NOT NULL DEFAULT 0,
  "created_by_agent_id" uuid REFERENCES "agents"("id") ON DELETE SET NULL,
  "created_by_user_id" text,
  "metadata" jsonb DEFAULT '{}',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "channels_company_type_idx" ON "channels" ("company_id", "type");
CREATE INDEX IF NOT EXISTS "channels_team_idx" ON "channels" ("team_id");
CREATE INDEX IF NOT EXISTS "channels_company_last_msg_idx" ON "channels" ("company_id", "last_message_at" DESC NULLS LAST);
CREATE UNIQUE INDEX IF NOT EXISTS "channels_company_slug_uniq" ON "channels" ("company_id", "slug");

-- ── Channel Members ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "channel_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "channel_id" uuid NOT NULL REFERENCES "channels"("id") ON DELETE CASCADE,
  "agent_id" uuid REFERENCES "agents"("id") ON DELETE CASCADE,
  "user_id" text,
  "role" text NOT NULL DEFAULT 'member',
  "nickname" text,
  "notification_pref" text NOT NULL DEFAULT 'all',
  "joined_at" timestamp with time zone NOT NULL DEFAULT now(),
  "left_at" timestamp with time zone,
  "muted_until" timestamp with time zone,
  "metadata" jsonb DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS "channel_members_channel_idx" ON "channel_members" ("channel_id") WHERE "left_at" IS NULL;
CREATE INDEX IF NOT EXISTS "channel_members_agent_idx" ON "channel_members" ("agent_id") WHERE "left_at" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "channel_members_agent_uniq" ON "channel_members" ("channel_id", "agent_id") WHERE "left_at" IS NULL AND "agent_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "channel_members_user_uniq" ON "channel_members" ("channel_id", "user_id") WHERE "left_at" IS NULL AND "user_id" IS NOT NULL;

-- ── Channel Messages ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "channel_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "channel_id" uuid NOT NULL REFERENCES "channels"("id") ON DELETE CASCADE,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,

  -- Sender: one of these is set
  "sender_agent_id" uuid REFERENCES "agents"("id") ON DELETE SET NULL,
  "sender_user_id" text,
  "sender_external_id" text,
  "sender_display_name" text,

  -- Threading
  "thread_id" uuid,
  "parent_message_id" uuid REFERENCES "channel_messages"("id") ON DELETE SET NULL,
  "reply_count" integer NOT NULL DEFAULT 0,
  "last_reply_at" timestamp with time zone,

  -- Content
  "message_type" text NOT NULL DEFAULT 'chat',
  "subject" text,
  "body" text NOT NULL,
  "attachments" jsonb DEFAULT '[]',
  "metadata" jsonb DEFAULT '{}',

  -- Mentions
  "mentions_agent_ids" uuid[] DEFAULT '{}',
  "mentions_channel" boolean NOT NULL DEFAULT false,
  "mentions_here" boolean NOT NULL DEFAULT false,

  -- State
  "is_pinned" boolean NOT NULL DEFAULT false,
  "pinned_at" timestamp with time zone,
  "pinned_by_agent_id" uuid REFERENCES "agents"("id") ON DELETE SET NULL,
  "edited_at" timestamp with time zone,
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "channel_msgs_channel_created_idx" ON "channel_messages" ("channel_id", "created_at");
CREATE INDEX IF NOT EXISTS "channel_msgs_thread_idx" ON "channel_messages" ("thread_id", "created_at") WHERE "thread_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "channel_msgs_company_idx" ON "channel_messages" ("company_id", "created_at");
CREATE INDEX IF NOT EXISTS "channel_msgs_sender_agent_idx" ON "channel_messages" ("sender_agent_id", "created_at");
CREATE INDEX IF NOT EXISTS "channel_msgs_pinned_idx" ON "channel_messages" ("channel_id") WHERE "is_pinned" = true;

-- ── Reactions ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "channel_message_reactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "message_id" uuid NOT NULL REFERENCES "channel_messages"("id") ON DELETE CASCADE,
  "emoji" text NOT NULL,
  "agent_id" uuid REFERENCES "agents"("id") ON DELETE CASCADE,
  "user_id" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE("message_id", "emoji", "agent_id"),
  UNIQUE("message_id", "emoji", "user_id")
);

CREATE INDEX IF NOT EXISTS "reactions_message_idx" ON "channel_message_reactions" ("message_id");

-- ── Read Cursors ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "channel_read_cursors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "channel_id" uuid NOT NULL REFERENCES "channels"("id") ON DELETE CASCADE,
  "agent_id" uuid REFERENCES "agents"("id") ON DELETE CASCADE,
  "user_id" text,
  "last_read_message_id" uuid REFERENCES "channel_messages"("id") ON DELETE SET NULL,
  "last_read_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "read_cursors_agent_uniq" ON "channel_read_cursors" ("channel_id", "agent_id") WHERE "agent_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "read_cursors_user_uniq" ON "channel_read_cursors" ("channel_id", "user_id") WHERE "user_id" IS NOT NULL;

-- ── Bookmarks ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "channel_bookmarks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "channel_id" uuid NOT NULL REFERENCES "channels"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "url" text,
  "emoji" text,
  "message_id" uuid REFERENCES "channel_messages"("id") ON DELETE SET NULL,
  "created_by_agent_id" uuid REFERENCES "agents"("id") ON DELETE SET NULL,
  "created_by_user_id" text,
  "position" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "bookmarks_channel_idx" ON "channel_bookmarks" ("channel_id");
