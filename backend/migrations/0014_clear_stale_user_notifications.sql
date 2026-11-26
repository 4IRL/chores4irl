-- Migration number: 0014 	 clear_stale_user_notifications
-- The notifications hub deprovisioned every chores4irl user on 2026-11-05
-- (clean slate), so every existing user_notifications row points at a dead
-- subscriber. Decided 2026-11-25: delete them all so /enable provisions afresh.
DELETE FROM user_notifications;
