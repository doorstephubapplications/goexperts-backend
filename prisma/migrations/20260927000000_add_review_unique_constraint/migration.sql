-- Go Experts Database Migration: Add Unique Constraint on Reviews
-- Constraint: @@unique([projectId, reviewerId, revieweeId])
-- Prevents race conditions and duplicate reviews for the same project counterpart.

-- Safety Check / Pre-Migration Audit:
-- The following query should return 0 rows before executing the ALTER TABLE statement:
-- SELECT project_id, reviewer_id, reviewee_id, COUNT(*) as duplicate_count 
-- FROM `reviews` 
-- GROUP BY project_id, reviewer_id, reviewee_id 
-- HAVING duplicate_count > 1;

-- Create Unique Index
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_project_reviewer_reviewee_unique` UNIQUE (`project_id`, `reviewer_id`, `reviewee_id`);
