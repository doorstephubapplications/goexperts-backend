-- ============================================================================
-- GO EXPERTS ENTERPRISE DIRECT REFERRAL & CASHBACK SCHEMA MIGRATION
-- Migration Date: 2026-10-19
-- ============================================================================

-- 1. Enhance referrals table for qualification lifecycle
ALTER TABLE `referrals` 
  ADD COLUMN IF NOT EXISTS `profile_completed_at` DATETIME NULL,
  ADD COLUMN IF NOT EXISTS `qualified_at` DATETIME NULL,
  ADD COLUMN IF NOT EXISTS `policy_version` VARCHAR(191) DEFAULT 'v1.0';

-- 2. Enhance referral_rewards table for permanent financial ledger linking & idempotency
ALTER TABLE `referral_rewards`
  ADD COLUMN IF NOT EXISTS `beneficiary_user_id` VARCHAR(191) NULL,
  ADD COLUMN IF NOT EXISTS `subscription_id` VARCHAR(191) NULL,
  ADD COLUMN IF NOT EXISTS `reward_category` VARCHAR(191) NOT NULL DEFAULT 'ONE_TIME_CASHBACK',
  ADD COLUMN IF NOT EXISTS `period_start` DATETIME NULL,
  ADD COLUMN IF NOT EXISTS `period_end` DATETIME NULL,
  ADD COLUMN IF NOT EXISTS `policy_version` VARCHAR(191) DEFAULT 'v1.0',
  ADD COLUMN IF NOT EXISTS `wallet_transaction_id` VARCHAR(191) NULL,
  ADD COLUMN IF NOT EXISTS `idempotency_key` VARCHAR(191) NULL UNIQUE,
  ADD COLUMN IF NOT EXISTS `credited_at` DATETIME NULL,
  ADD COLUMN IF NOT EXISTS `metadata` TEXT NULL;

-- 3. Create recurring_reward_schedules table for 5% recurring cashback allocations
CREATE TABLE IF NOT EXISTS `recurring_reward_schedules` (
  `id` VARCHAR(191) NOT NULL,
  `referral_id` VARCHAR(191) NOT NULL,
  `referrer_user_id` VARCHAR(191) NOT NULL,
  `subscription_id` VARCHAR(191) NOT NULL,
  `eligible_start_at` DATETIME NOT NULL,
  `eligible_end_at` DATETIME NOT NULL,
  `total_subscription_duration_days` DOUBLE NOT NULL,
  `remaining_duration_days` DOUBLE NOT NULL,
  `base_subscription_amount` DOUBLE NOT NULL,
  `reward_basis_amount` DOUBLE NOT NULL,
  `total_allocated_amount` DOUBLE NOT NULL,
  `total_credited_amount` DOUBLE NOT NULL DEFAULT 0,
  `status` VARCHAR(191) NOT NULL DEFAULT 'ACCRUING',
  `settled_at` DATETIME NULL,
  `next_settlement_at` DATETIME NULL,
  `policy_version` VARCHAR(191) NOT NULL DEFAULT 'v1.0',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `recurring_reward_schedules_referral_id_idx` (`referral_id`),
  INDEX `recurring_reward_schedules_referrer_user_id_idx` (`referrer_user_id`),
  INDEX `recurring_reward_schedules_subscription_id_idx` (`subscription_id`),
  INDEX `recurring_reward_schedules_status_idx` (`status`),
  CONSTRAINT `recurring_reward_schedules_referral_id_fkey` FOREIGN KEY (`referral_id`) REFERENCES `referrals` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Create referral_policies table for Super Admin configurable policy
CREATE TABLE IF NOT EXISTS `referral_policies` (
  `id` VARCHAR(191) NOT NULL,
  `policy_name` VARCHAR(191) NOT NULL DEFAULT 'Default Direct Referral Policy',
  `policy_version` VARCHAR(191) NOT NULL DEFAULT 'v1.0',
  `one_time_reward_amount` DOUBLE NOT NULL DEFAULT 25,
  `recurring_rate` DOUBLE NOT NULL DEFAULT 0.05,
  `gst_rate` DOUBLE NOT NULL DEFAULT 0.18,
  `payout_frequency` VARCHAR(191) NOT NULL DEFAULT 'ON_EXPIRY_OR_MONTHLY',
  `free_plan_one_time_eligible` BOOLEAN NOT NULL DEFAULT TRUE,
  `free_plan_recurring_eligible` BOOLEAN NOT NULL DEFAULT FALSE,
  `paid_plan_recurring_eligible` BOOLEAN NOT NULL DEFAULT TRUE,
  `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
  `effective_from` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `effective_to` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `referral_policies_policy_version_key` (`policy_version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Seed initial default policy if none exists
INSERT INTO `referral_policies` (
  `id`, `policy_name`, `policy_version`, `one_time_reward_amount`, `recurring_rate`, 
  `gst_rate`, `payout_frequency`, `free_plan_one_time_eligible`, `free_plan_recurring_eligible`, 
  `paid_plan_recurring_eligible`, `status`, `effective_from`
) VALUES (
  UUID(), 'Default Direct Referral Policy', 'v1.0', 25.00, 0.05, 
  0.18, 'ON_EXPIRY_OR_MONTHLY', TRUE, FALSE, 
  TRUE, 'ACTIVE', CURRENT_TIMESTAMP
) ON DUPLICATE KEY UPDATE `status` = 'ACTIVE';
