-- Migration: Increase bio column size on users table to TEXT
-- Root Cause: In MySQL, Prisma mapped `bio String?` to VARCHAR(191), causing Error P2000:
-- "Validation error: The provided value for the column is too long for the column's type. Column: bio"
-- when entering bios up to 1000 characters during onboarding.

ALTER TABLE `users` MODIFY COLUMN `bio` TEXT NULL;
