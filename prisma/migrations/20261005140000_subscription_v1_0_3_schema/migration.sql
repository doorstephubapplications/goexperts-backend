-- ==============================================================================
-- Migration: 20261005140000_subscription_v1_0_3_schema
-- Description: Additive migration for Subscription Platform v1.0.3 schema drift
-- Tables: subscription_plans, subscriptions, subscription_transactions, wallet_transactions
-- ==============================================================================

-- 1. Add new columns to subscription_plans
ALTER TABLE `subscription_plans`
  ADD COLUMN `plan_type` VARCHAR(191) NOT NULL DEFAULT 'single_role',
  ADD COLUMN `proposals_limit` INT NOT NULL DEFAULT 36,
  ADD COLUMN `projects_limit` INT NOT NULL DEFAULT 36,
  ADD COLUMN `sort_order` INT NOT NULL DEFAULT 0;

-- 2. Add new columns and index to subscriptions
ALTER TABLE `subscriptions`
  ADD COLUMN `role` VARCHAR(191) NULL,
  ADD COLUMN `plan_type` VARCHAR(191) NULL DEFAULT 'single_role',
  ADD INDEX `subscriptions_role_idx` (`role`);

-- 3. Add missing index to subscription_transactions
ALTER TABLE `subscription_transactions`
  ADD INDEX `subscription_transactions_created_at_idx` (`created_at`);

-- 4. Add missing index to wallet_transactions
ALTER TABLE `wallet_transactions`
  ADD INDEX `wallet_transactions_created_at_idx` (`created_at`);

-- 5. Backfill subscription_plans with authoritative catalog metadata
UPDATE `subscription_plans` SET `plan_type` = 'trial', `proposals_limit` = 36, `projects_limit` = 36, `sort_order` = 1 WHERE `name` = '6-Month Free Access';
UPDATE `subscription_plans` SET `plan_type` = 'single_role', `proposals_limit` = 3, `projects_limit` = 0, `sort_order` = 10 WHERE `name` = 'Freelancer Monthly';
UPDATE `subscription_plans` SET `plan_type` = 'single_role', `proposals_limit` = 0, `projects_limit` = 3, `sort_order` = 11 WHERE `name` = 'Client Monthly';
UPDATE `subscription_plans` SET `plan_type` = 'single_role', `proposals_limit` = 0, `projects_limit` = 5, `sort_order` = 12 WHERE `name` = 'Founder Monthly';
UPDATE `subscription_plans` SET `plan_type` = 'single_role', `proposals_limit` = 0, `projects_limit` = 0, `sort_order` = 13 WHERE `name` = 'Investor Monthly';
UPDATE `subscription_plans` SET `plan_type` = 'single_role', `proposals_limit` = 36, `projects_limit` = 0, `sort_order` = 20 WHERE `name` = 'Freelancer Annual (Standard)';
UPDATE `subscription_plans` SET `plan_type` = 'single_role', `proposals_limit` = 0, `projects_limit` = 36, `sort_order` = 21 WHERE `name` = 'Client Annual';
UPDATE `subscription_plans` SET `plan_type` = 'single_role', `proposals_limit` = 0, `projects_limit` = 60, `sort_order` = 22 WHERE `name` = 'Founder Annual';
UPDATE `subscription_plans` SET `plan_type` = 'single_role', `proposals_limit` = 0, `projects_limit` = 0, `sort_order` = 23 WHERE `name` = 'Investor Annual';
UPDATE `subscription_plans` SET `plan_type` = 'addon', `proposals_limit` = 3, `projects_limit` = 3, `sort_order` = 30 WHERE `name` = 'Additional Role Add-on Monthly';
UPDATE `subscription_plans` SET `plan_type` = 'addon', `proposals_limit` = 36, `projects_limit` = 36, `sort_order` = 31 WHERE `name` = 'Additional Role Add-on Annual';
UPDATE `subscription_plans` SET `plan_type` = 'all_access', `proposals_limit` = 10, `projects_limit` = 10, `sort_order` = 40 WHERE `name` = 'Go Experts All Access Monthly';
UPDATE `subscription_plans` SET `plan_type` = 'all_access', `proposals_limit` = 120, `projects_limit` = 120, `sort_order` = 41 WHERE `name` = 'Go Experts All Access Annual';
UPDATE `subscription_plans` SET `plan_type` = 'single_role', `proposals_limit` = 20, `projects_limit` = 0, `sort_order` = 100 WHERE `name` = 'Freelancer Starter';
UPDATE `subscription_plans` SET `plan_type` = 'single_role', `proposals_limit` = 50, `projects_limit` = 0, `sort_order` = 101 WHERE `name` = 'Freelancer Pro';
UPDATE `subscription_plans` SET `plan_type` = 'single_role', `proposals_limit` = 100, `projects_limit` = 0, `sort_order` = 102 WHERE `name` = 'Freelancer Elite';
UPDATE `subscription_plans` SET `plan_type` = 'single_role', `proposals_limit` = 250, `projects_limit` = 0, `sort_order` = 103 WHERE `name` IN ('Freelancer Annual', 'Freelancer Annual (Legacy)');
UPDATE `subscription_plans` SET `plan_type` = 'single_role', `proposals_limit` = 0, `projects_limit` = 5, `sort_order` = 104 WHERE `name` = 'Client Starter';
UPDATE `subscription_plans` SET `plan_type` = 'single_role', `proposals_limit` = 0, `projects_limit` = 5, `sort_order` = 105 WHERE `name` = 'Client Basic';
UPDATE `subscription_plans` SET `plan_type` = 'single_role', `proposals_limit` = 0, `projects_limit` = 25, `sort_order` = 106 WHERE `name` = 'Client Business';
UPDATE `subscription_plans` SET `plan_type` = 'single_role', `proposals_limit` = 0, `projects_limit` = 100, `sort_order` = 107 WHERE `name` = 'Client Enterprise';
UPDATE `subscription_plans` SET `plan_type` = 'single_role', `proposals_limit` = 0, `projects_limit` = 5, `sort_order` = 108 WHERE `name` = 'Founder Starter';
UPDATE `subscription_plans` SET `plan_type` = 'single_role', `proposals_limit` = 0, `projects_limit` = 10, `sort_order` = 109 WHERE `name` = 'Founder Launchpad';
UPDATE `subscription_plans` SET `plan_type` = 'single_role', `proposals_limit` = 0, `projects_limit` = 0, `sort_order` = 110 WHERE `name` = 'Investor Basic';
UPDATE `subscription_plans` SET `plan_type` = 'single_role', `proposals_limit` = 0, `projects_limit` = 0, `sort_order` = 111 WHERE `name` = 'Investor Starter';
UPDATE `subscription_plans` SET `plan_type` = 'single_role', `proposals_limit` = 0, `projects_limit` = 0, `sort_order` = 112 WHERE `name` = 'Investor Premium';
UPDATE `subscription_plans` SET `plan_type` = 'trial', `proposals_limit` = 36, `projects_limit` = 0, `sort_order` = 113 WHERE `name` = '90-Day Free Trial';

-- 6. Backfill subscriptions.role and subscriptions.plan_type from single-role plans
UPDATE `subscriptions` s
JOIN `subscription_plans` sp ON s.`plan_id` = sp.`id`
SET s.`role` = sp.`role`, s.`plan_type` = sp.`plan_type`
WHERE sp.`role` IN ('freelancer', 'client', 'founder', 'investor');

-- 7. Backfill subscriptions.role and subscriptions.plan_type from user profile for multi-role/all-access/trial plans
UPDATE `subscriptions` s
JOIN `subscription_plans` sp ON s.`plan_id` = sp.`id`
JOIN `users` u ON s.`user_id` = u.`id`
SET s.`role` = u.`role`, s.`plan_type` = sp.`plan_type`
WHERE sp.`role` = 'all';

-- 8. Backfill orphaned subscriptions without plan_id
UPDATE `subscriptions` s
JOIN `users` u ON s.`user_id` = u.`id`
SET s.`role` = u.`role`, s.`plan_type` = 'single_role'
WHERE s.`plan_id` IS NULL;
