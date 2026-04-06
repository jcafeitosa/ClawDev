ALTER TABLE "issue_comments" ADD COLUMN "created_by_run_id" uuid REFERENCES "heartbeat_runs"("id") ON DELETE SET NULL;
