-- ==============================================================================
-- GO EXPERTS v1.0.4 — READ-ONLY PRODUCTION DATABASE PREFLIGHT
-- SAFE: CONTAINS ZERO MUTATING STATEMENTS (SELECT ONLY)
-- NO ALTER, NO UPDATE, NO INSERT, NO DELETE, NO DROP
-- ==============================================================================

-- 1. Database Engine & Target Identity
SELECT 
  VERSION() as db_version,
  DATABASE() as db_name,
  USER() as db_user,
  @@hostname as db_host;

-- 2. Prisma Migrations Table State
SELECT 
  id, 
  migration_name, 
  checksum, 
  finished_at, 
  applied_steps_count
FROM _prisma_migrations 
ORDER BY started_at ASC;

-- 3. Physical Schema Verification: Check for presence/absence of 6 target columns
SELECT 
  table_name, 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND (
    (table_name = 'subscription_plans' AND column_name IN ('plan_type', 'proposals_limit', 'projects_limit', 'sort_order'))
    OR
    (table_name = 'subscriptions' AND column_name IN ('role', 'plan_type'))
  );

-- 4. Physical Schema Verification: Check for presence/absence of 3 target indexes
SELECT 
  table_name, 
  index_name, 
  column_name, 
  non_unique
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND index_name IN ('subscriptions_role_idx', 'subscription_transactions_created_at_idx', 'wallet_transactions_created_at_idx');

-- 5. Production Plans: Total and Deterministic Mappability Audit
SELECT 
  COUNT(*) as total_plans,
  SUM(CASE 
    WHEN name IN (
      '6-Month Free Access', 'Freelancer Monthly', 'Client Monthly', 'Founder Monthly', 'Investor Monthly',
      'Freelancer Annual (Standard)', 'Client Annual', 'Founder Annual', 'Investor Annual',
      'Additional Role Add-on Monthly', 'Additional Role Add-on Annual',
      'Go Experts All Access Monthly', 'Go Experts All Access Annual',
      'Freelancer Starter', 'Freelancer Pro', 'Freelancer Elite', 'Freelancer Annual', 'Freelancer Annual (Legacy)',
      'Client Starter', 'Client Basic', 'Client Business', 'Client Enterprise',
      'Founder Starter', 'Founder Launchpad',
      'Investor Basic', 'Investor Starter', 'Investor Premium', '90-Day Free Trial'
    ) THEN 1 ELSE 0 
  END) as mappable_plans,
  SUM(CASE 
    WHEN name NOT IN (
      '6-Month Free Access', 'Freelancer Monthly', 'Client Monthly', 'Founder Monthly', 'Investor Monthly',
      'Freelancer Annual (Standard)', 'Client Annual', 'Founder Annual', 'Investor Annual',
      'Additional Role Add-on Monthly', 'Additional Role Add-on Annual',
      'Go Experts All Access Monthly', 'Go Experts All Access Annual',
      'Freelancer Starter', 'Freelancer Pro', 'Freelancer Elite', 'Freelancer Annual', 'Freelancer Annual (Legacy)',
      'Client Starter', 'Client Basic', 'Client Business', 'Client Enterprise',
      'Founder Starter', 'Founder Launchpad',
      'Investor Basic', 'Investor Starter', 'Investor Premium', '90-Day Free Trial'
    ) THEN 1 ELSE 0 
  END) as unmapped_plans
FROM subscription_plans;

-- 6. Production Plans: Deterministic Target Values Audit
SELECT 
  id, 
  name, 
  role as subscription_role,
  amount,
  duration,
  CASE 
    WHEN name = '6-Month Free Access' THEN 'trial'
    WHEN name LIKE '%Add-on%' THEN 'addon'
    WHEN name LIKE '%All Access%' THEN 'all_access'
    ELSE 'single_role'
  END as simulated_plan_type,
  CASE 
    WHEN name = '6-Month Free Access' THEN 36
    WHEN name = 'Freelancer Monthly' THEN 3
    WHEN name = 'Freelancer Annual (Standard)' THEN 36
    WHEN name = 'Additional Role Add-on Monthly' THEN 3
    WHEN name = 'Additional Role Add-on Annual' THEN 36
    WHEN name = 'Go Experts All Access Monthly' THEN 10
    WHEN name = 'Go Experts All Access Annual' THEN 120
    WHEN name = 'Freelancer Starter' THEN 20
    WHEN name = 'Freelancer Pro' THEN 50
    WHEN name = 'Freelancer Elite' THEN 100
    WHEN name IN ('Freelancer Annual', 'Freelancer Annual (Legacy)') THEN 250
    WHEN name = '90-Day Free Trial' THEN 36
    ELSE 0
  END as simulated_proposals_limit,
  CASE 
    WHEN name = '6-Month Free Access' THEN 36
    WHEN name = 'Client Monthly' THEN 3
    WHEN name = 'Founder Monthly' THEN 5
    WHEN name = 'Client Annual' THEN 36
    WHEN name = 'Founder Annual' THEN 60
    WHEN name = 'Additional Role Add-on Monthly' THEN 3
    WHEN name = 'Additional Role Add-on Annual' THEN 36
    WHEN name = 'Go Experts All Access Monthly' THEN 10
    WHEN name = 'Go Experts All Access Annual' THEN 120
    WHEN name IN ('Client Starter', 'Client Basic', 'Founder Starter') THEN 5
    WHEN name = 'Founder Launchpad' THEN 10
    WHEN name = 'Client Business' THEN 25
    WHEN name = 'Client Enterprise' THEN 100
    ELSE 0
  END as simulated_projects_limit
FROM subscription_plans
ORDER BY amount ASC;

-- 7. Production Subscriptions: Total, Mappability & Ambiguity Dry-Run
SELECT 
  COUNT(*) as total_subscriptions,
  SUM(CASE 
    WHEN sp.role IN ('freelancer', 'client', 'founder', 'investor') THEN 1
    WHEN sp.role = 'all' AND u.role IN ('freelancer', 'client', 'founder', 'investor') THEN 1
    WHEN s.plan_id IS NULL AND u.role IN ('freelancer', 'client', 'founder', 'investor') THEN 1
    ELSE 0 
  END) as mappable_subscriptions,
  SUM(CASE 
    WHEN sp.role IS NULL AND s.plan_id IS NOT NULL THEN 1
    WHEN sp.role = 'all' AND (u.role IS NULL OR u.role NOT IN ('freelancer', 'client', 'founder', 'investor')) THEN 1
    WHEN s.plan_id IS NULL AND (u.role IS NULL OR u.role NOT IN ('freelancer', 'client', 'founder', 'investor')) THEN 1
    ELSE 0 
  END) as unmapped_subscriptions,
  SUM(CASE 
    WHEN sp.role = 'all' AND u.role IS NULL THEN 1
    ELSE 0 
  END) as ambiguous_role_mappings
FROM subscriptions s
LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
LEFT JOIN users u ON s.user_id = u.id;
