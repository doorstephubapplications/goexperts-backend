-- =============================================================================
-- Migration: Cleanup Orphaned Connections and Invitations
-- Purpose: Safely delete dangling connection rows where user_one_id or user_two_id
--          points to a user that no longer exists in the `users` table.
-- =============================================================================

-- 1. Clean up orphaned connection records
DELETE FROM `connections`
WHERE `user_one_id` NOT IN (SELECT `id` FROM `users`)
   OR `user_two_id` NOT IN (SELECT `id` FROM `users`)
   OR `user_one_id` IS NULL
   OR `user_two_id` IS NULL;

-- 2. Clean up orphaned connection invitations
DELETE FROM `connection_invitations`
WHERE `sender_id` NOT IN (SELECT `id` FROM `users`)
   OR `receiver_id` NOT IN (SELECT `id` FROM `users`)
   OR `sender_id` IS NULL
   OR `receiver_id` IS NULL;
