/**
 * GO EXPERTS: PM2 CLUSTER & SINGLETON SCHEDULER GUARD
 *
 * Governs the execution of background cron jobs, schedulers, and queue workers
 * across single-instance development and multi-instance PM2 cluster deployments.
 *
 * Safety Invariants:
 * 1. PM2 Cluster Mode: PM2 supplies `NODE_APP_INSTANCE` as a string: "0", "1", "2", ...
 *    Only instance "0" (or 0) registers and executes singleton background workers.
 *    Secondary instances ("1", "2", etc.) bypass scheduler registration entirely.
 * 2. Standalone / Local Development: When `NODE_APP_INSTANCE` is undefined or empty,
 *    the process is treated as a standalone single instance and registers workers.
 * 3. Environment Overrides:
 *    - `ENABLE_SCHEDULER="false"` or `ENABLE_SCHEDULER="0"` forces scheduler bypass.
 *    - `ENABLE_SCHEDULER="true"` or `ENABLE_SCHEDULER="1"` forces scheduler execution.
 */

export interface SchedulerGuardDecision {
  isPrimary: boolean;
  reason: string;
  instanceId: string | number | undefined;
}

export function evaluateSchedulerInstance(
  env: NodeJS.ProcessEnv = process.env
): SchedulerGuardDecision {
  // Explicit disable override (e.g. for API-only nodes in decoupled worker architecture)
  if (env.ENABLE_SCHEDULER === "false" || env.ENABLE_SCHEDULER === "0") {
    return {
      isPrimary: false,
      reason: "ENABLE_SCHEDULER environment flag is explicitly false",
      instanceId: env.NODE_APP_INSTANCE,
    };
  }

  // Explicit enable override (e.g. for dedicated worker nodes)
  if (env.ENABLE_SCHEDULER === "true" || env.ENABLE_SCHEDULER === "1") {
    return {
      isPrimary: true,
      reason: "ENABLE_SCHEDULER environment flag is explicitly true",
      instanceId: env.NODE_APP_INSTANCE,
    };
  }

  // PM2 cluster mode instance identification
  const instance = env.NODE_APP_INSTANCE;
  if (instance !== undefined && instance !== "") {
    const isZero = instance === "0" || (instance as any) === 0;
    return {
      isPrimary: isZero,
      reason: isZero
        ? "PM2 cluster primary instance (instance 0)"
        : `PM2 cluster secondary instance (instance ${instance}) - schedulers bypassed`,
      instanceId: instance,
    };
  }

  // Standalone / local development / single-instance staging
  return {
    isPrimary: true,
    reason: "Standalone / single-instance mode (NODE_APP_INSTANCE undefined)",
    instanceId: undefined,
  };
}

export function isPrimarySchedulerInstance(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return evaluateSchedulerInstance(env).isPrimary;
}
