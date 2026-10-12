-- AlterTable freelancer_certificates
ALTER TABLE `freelancer_certificates` 
    ADD COLUMN IF NOT EXISTS `expiration_date` VARCHAR(191) NULL,
    ADD COLUMN IF NOT EXISTS `does_not_expire` BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS `credential_id` VARCHAR(191) NULL,
    ADD COLUMN IF NOT EXISTS `credential_url` VARCHAR(191) NULL,
    ADD COLUMN IF NOT EXISTS `category_id` VARCHAR(191) NULL,
    ADD COLUMN IF NOT EXISTS `description` TEXT NULL,
    ADD COLUMN IF NOT EXISTS `attachment_reference` VARCHAR(191) NULL;

-- CreateTable freelancer_achievements
CREATE TABLE IF NOT EXISTS `freelancer_achievements` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `achievement_type` VARCHAR(191) NOT NULL,
    `organization` VARCHAR(191) NULL,
    `achievement_date` VARCHAR(191) NOT NULL,
    `category_id` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `evidence_url` VARCHAR(191) NULL,
    `attachment_reference` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    INDEX `freelancer_achievements_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`),
    CONSTRAINT `freelancer_achievements_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable freelancer_services
CREATE TABLE IF NOT EXISTS `freelancer_services` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `category_id` VARCHAR(191) NULL,
    `skills` TEXT NULL,
    `thumbnail_url` VARCHAR(191) NULL,
    `rate_amount` DOUBLE NULL,
    `rate_unit` VARCHAR(191) NULL,
    `currency` VARCHAR(191) NULL DEFAULT 'INR',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    INDEX `freelancer_services_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`),
    CONSTRAINT `freelancer_services_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable freelancer_languages
CREATE TABLE IF NOT EXISTS `freelancer_languages` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `language_code` VARCHAR(191) NOT NULL,
    `language_name` VARCHAR(191) NOT NULL,
    `proficiency` VARCHAR(191) NOT NULL,
    `is_native` BOOLEAN NOT NULL DEFAULT FALSE,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `freelancer_languages_user_id_language_code_key`(`user_id`, `language_code`),
    INDEX `freelancer_languages_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`),
    CONSTRAINT `freelancer_languages_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable freelancer_availabilities
CREATE TABLE IF NOT EXISTS `freelancer_availabilities` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'available',
    `start_date` VARCHAR(191) NULL,
    `end_date` VARCHAR(191) NULL,
    `reason_code` VARCHAR(191) NULL,
    `custom_reason` VARCHAR(191) NULL,
    `private_notes` TEXT NULL,
    `reason_public_visibility` BOOLEAN NOT NULL DEFAULT TRUE,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    INDEX `freelancer_availabilities_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`),
    CONSTRAINT `freelancer_availabilities_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
