import { describe, it, expect, vi } from "vitest";
import { evaluateSchedulerInstance, isPrimarySchedulerInstance } from "../../config/scheduler-guard.js";

describe("Stage 1.1: Scheduler Singleton Guard & Cluster Concurrency", () => {
  it("should designate standalone / local development process as primary runner", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "development",
      // NODE_APP_INSTANCE is undefined
    };

    const decision = evaluateSchedulerInstance(env);
    expect(decision.isPrimary).toBe(true);
    expect(decision.reason).toContain("Standalone");
    expect(isPrimarySchedulerInstance(env)).toBe(true);
  });

  it("should designate PM2 cluster instance 0 (string '0') as primary runner", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "production",
      NODE_APP_INSTANCE: "0",
    };

    const decision = evaluateSchedulerInstance(env);
    expect(decision.isPrimary).toBe(true);
    expect(decision.instanceId).toBe("0");
    expect(decision.reason).toContain("PM2 cluster primary instance (instance 0)");
    expect(isPrimarySchedulerInstance(env)).toBe(true);
  });

  it("should designate PM2 cluster instance 0 (numeric 0) as primary runner", () => {
    const env: any = {
      NODE_ENV: "production",
      NODE_APP_INSTANCE: 0,
    };

    const decision = evaluateSchedulerInstance(env);
    expect(decision.isPrimary).toBe(true);
    expect(isPrimarySchedulerInstance(env)).toBe(true);
  });

  it("should bypass schedulers on PM2 cluster secondary instance 1", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "production",
      NODE_APP_INSTANCE: "1",
    };

    const decision = evaluateSchedulerInstance(env);
    expect(decision.isPrimary).toBe(false);
    expect(decision.instanceId).toBe("1");
    expect(decision.reason).toContain("PM2 cluster secondary instance (instance 1) - schedulers bypassed");
    expect(isPrimarySchedulerInstance(env)).toBe(false);
  });

  it("should bypass schedulers on PM2 cluster secondary instances 2, 3, and 4", () => {
    for (const inst of ["2", "3", "4"]) {
      const env: NodeJS.ProcessEnv = {
        NODE_ENV: "production",
        NODE_APP_INSTANCE: inst,
      };

      const decision = evaluateSchedulerInstance(env);
      expect(decision.isPrimary).toBe(false);
      expect(isPrimarySchedulerInstance(env)).toBe(false);
    }
  });

  it("should strictly respect ENABLE_SCHEDULER='false' override even on instance 0", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "production",
      NODE_APP_INSTANCE: "0",
      ENABLE_SCHEDULER: "false",
    };

    const decision = evaluateSchedulerInstance(env);
    expect(decision.isPrimary).toBe(false);
    expect(decision.reason).toContain("ENABLE_SCHEDULER environment flag is explicitly false");
    expect(isPrimarySchedulerInstance(env)).toBe(false);
  });

  it("should strictly respect ENABLE_SCHEDULER='true' override even on secondary instance", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "production",
      NODE_APP_INSTANCE: "2",
      ENABLE_SCHEDULER: "true",
    };

    const decision = evaluateSchedulerInstance(env);
    expect(decision.isPrimary).toBe(true);
    expect(decision.reason).toContain("ENABLE_SCHEDULER environment flag is explicitly true");
    expect(isPrimarySchedulerInstance(env)).toBe(true);
  });

  it("should verify pre-registration guard prevents background job registration on secondary cluster instances", () => {
    const registerJobMock = vi.fn();
    const envSecondary: NodeJS.ProcessEnv = {
      NODE_ENV: "production",
      NODE_APP_INSTANCE: "1",
    };

    // Simulate server startup logic on secondary instance
    const guardSecondary = evaluateSchedulerInstance(envSecondary);
    if (guardSecondary.isPrimary) {
      registerJobMock();
    }

    expect(registerJobMock).not.toHaveBeenCalled();

    // Simulate server startup logic on primary instance
    const envPrimary: NodeJS.ProcessEnv = {
      NODE_ENV: "production",
      NODE_APP_INSTANCE: "0",
    };
    const guardPrimary = evaluateSchedulerInstance(envPrimary);
    if (guardPrimary.isPrimary) {
      registerJobMock();
    }

    expect(registerJobMock).toHaveBeenCalledTimes(1);
  });
});
