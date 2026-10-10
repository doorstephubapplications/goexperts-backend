-- Migration: widen_limits_features_to_text
-- Applied directly via phpMyAdmin on 2026-10-10.
-- This migration is recorded here so Prisma migration history stays in sync.
-- The ALTER TABLE was already executed on the remote database.

ALTER TABLE `subscription_plans` MODIFY COLUMN `features` TEXT NULL;
ALTER TABLE `subscription_plans` MODIFY COLUMN `limits` TEXT NULL;
