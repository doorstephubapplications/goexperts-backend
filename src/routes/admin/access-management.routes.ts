import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../../config/database.js";
import { authMiddleware, AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { sendEmail } from "../../services/mobile/email.service.js";

export const accessManagementRouter = Router();

// Require admin staff authentication for all access management routes
accessManagementRouter.use(authMiddleware as any);

// Middleware to audit actions
async function auditAction(adminUserId: string, module: string, action: string, details: string, req: Request) {
  try {
    const rawIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";
    const ipAddress = (req.headers["x-client-ip"] as string) || rawIp.split(",")[0]?.trim();
    
    // Resolve location dynamically from headers, session, or staff record
    let location = (req.headers["x-client-location"] as string) || (req.headers["x-client-city"] as string) || "";
    if (!location && adminUserId) {
      const staffUser = await prisma.adminUser.findUnique({
        where: { id: adminUserId },
        select: { lastLoginLocation: true, officeLocation: true },
      }).catch(() => null);
      if (staffUser?.lastLoginLocation) {
        location = staffUser.lastLoginLocation;
      } else if (staffUser?.officeLocation) {
        location = staffUser.officeLocation;
      }
    }

    if (!location) {
      location = "Dynamic Locality";
    }

    await prisma.staffActivityAudit.create({
      data: {
        adminUserId,
        module,
        action,
        details,
        ipAddress: ipAddress === "::1" ? "127.0.0.1" : ipAddress,
        location,
        status: "success",
      },
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}

// Helper to auto-send employee welcome email with credentials, role, and permissions summary
async function sendEmployeeWelcomeEmail(data: {
  fullName: string;
  email: string;
  password: string;
  employeeCode: string;
  department: string;
  designation: string;
  role: string;
  accessLevel: string;
  roleId: string;
}) {
  try {
    const rolePermissions = await prisma.rolePermission.findMany({
      where: { roleId: data.roleId },
      include: { permission: true },
    });

    const portalUrl = process.env.ADMIN_PORTAL_URL || "https://adminai.goexperts.in";

    let permissionsSummaryHtml = "";
    if (!rolePermissions || rolePermissions.length === 0) {
      permissionsSummaryHtml = "<p style='margin:0; font-style: italic; color: #64748b;'>Standard role permissions granted.</p>";
    } else {
      const byModule: Record<string, string[]> = {};
      for (const rp of rolePermissions) {
        const mod = rp.permission?.module || "General";
        if (!byModule[mod]) byModule[mod] = [];
        const actions = Array.isArray(rp.actions) && rp.actions.length > 0 ? (rp.actions as string[]).join(", ") : "All";
        byModule[mod].push(`<strong>${rp.permission?.name || "Feature"}</strong> <span style="color:#64748b;">(${actions})</span>`);
      }
      permissionsSummaryHtml = Object.entries(byModule)
        .map(([mod, perms]) => `<div style="margin-bottom: 6px;"><strong style="color: #9810FA;">${mod}:</strong> ${perms.join("; ")}</div>`)
        .join("");
    }

    const html = `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 620px; margin: 0 auto; color: #1e293b; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
  <div style="background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); padding: 32px 24px; text-align: center; border-bottom: 3px solid #9810FA;">
    <h1 style="color: #ffffff; font-size: 24px; font-weight: 800; margin: 0 0 6px 0; letter-spacing: -0.5px;">Go Experts Admin Portal</h1>
    <p style="color: #cbd5e1; font-size: 14px; margin: 0;">Employee Access Credentials & Role Entitlement</p>
  </div>
  
  <div style="padding: 28px 24px;">
    <p style="font-size: 15px; color: #334155; line-height: 1.6; margin-top: 0;">Hello <strong>${data.fullName}</strong>,</p>
    <p style="font-size: 14px; color: #475569; line-height: 1.6;">
      An employee administrative account has been provisioned for you on the <strong>Go Experts Centralized Admin Portal</strong>. Please use the credentials below to sign in and begin your administrative duties.
    </p>

    <!-- Credentials Card -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 20px; margin: 20px 0;">
      <h3 style="color: #0f172a; margin: 0 0 12px 0; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
        🔐 Login Credentials
      </h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr>
          <td style="padding: 6px 0; color: #64748b; width: 140px;">Employee ID:</td>
          <td style="padding: 6px 0; color: #0f172a; font-family: monospace; font-weight: 700;">${data.employeeCode}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Login Email:</td>
          <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${data.email}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Temporary Password:</td>
          <td style="padding: 6px 0; color: #9810FA; font-family: monospace; font-size: 14px; font-weight: 700; background: #f3e8ff; display: inline-block; padding: 2px 8px; border-radius: 6px;">${data.password}</td>
        </tr>
      </table>
    </div>

    <!-- Login CTA Button -->
    <div style="text-align: center; margin: 26px 0;">
      <a href="${portalUrl}" target="_blank" style="background: #9810FA; color: #ffffff; padding: 12px 32px; border-radius: 8px; font-weight: 700; font-size: 14px; text-decoration: none; display: inline-block; box-shadow: 0 4px 12px rgba(152, 16, 250, 0.25);">
        Log in to Go Experts Portal &rarr;
      </a>
    </div>

    <!-- Organizational & Role Entitlements -->
    <div style="background-color: #faf5ff; border: 1px solid #e9d5ff; border-radius: 10px; padding: 18px 20px; margin: 20px 0;">
      <h3 style="color: #6b21a8; margin: 0 0 12px 0; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e9d5ff; padding-bottom: 8px;">
        🏢 Organizational Assignment & Scope
      </h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr>
          <td style="padding: 6px 0; color: #64748b; width: 140px;">Department:</td>
          <td style="padding: 6px 0; color: #1e293b; font-weight: 600;">${data.department}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Designation:</td>
          <td style="padding: 6px 0; color: #1e293b; font-weight: 600;">${data.designation}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Assigned Role:</td>
          <td style="padding: 6px 0; color: #9810FA; font-weight: 700;">${data.role}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Data Access Level:</td>
          <td style="padding: 6px 0; color: #1e293b; font-weight: 600;">${data.accessLevel}</td>
        </tr>
      </table>
    </div>

    <!-- Role Permissions Summary -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 20px; margin: 20px 0;">
      <h3 style="color: #0f172a; margin: 0 0 10px 0; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
        📋 Assigned Permissions & Module Capabilities
      </h3>
      <div style="font-size: 12px; color: #475569; line-height: 1.8;">
        ${permissionsSummaryHtml}
      </div>
    </div>

    <!-- Security Warning Notice -->
    <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 4px 8px 8px 4px; padding: 12px 16px; margin: 20px 0;">
      <p style="margin: 0; font-size: 12px; color: #92400e; line-height: 1.5;">
        <strong>⚠️ Security Policy Notice:</strong> This email contains confidential temporary credentials. You must change your password immediately upon your first sign in. All administrative actions and session events are continuously monitored and logged under compliance audit protocols.
      </p>
    </div>
  </div>

  <div style="background-color: #f1f5f9; padding: 20px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
    <p style="margin: 0 0 4px 0; font-weight: 600; color: #334155;">Go Experts Enterprise Administration Portal</p>
    <p style="margin: 0;">If you did not expect this invitation or have questions, contact the System Administrator at <a href="mailto:admin@goexperts.in" style="color: #9810FA; text-decoration: none;">admin@goexperts.in</a></p>
  </div>
</div>`;

    const subject = "Welcome to Go Experts Portal - Your Staff Account & Access Credentials 🔐";
    await sendEmail(data.email, subject, html);
    console.log(`[EMPLOYEE ONBOARDING] Welcome email dispatched successfully to ${data.email}`);
  } catch (err) {
    console.error("[EMPLOYEE ONBOARDING] Failed to send welcome email:", err);
  }
}

// Fine-grained permission guard middleware
export function requireStaffPermission(permissionKey: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user || req.user.type !== "admin") {
        return res.status(403).json({ success: false, message: "Administrative authorization required." });
      }

      // Check if session has been revoked
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        const session = await prisma.adminSession.findFirst({
          where: { sessionToken: token },
        }).catch(() => null);
        if (session && session.isRevoked) {
          return res.status(401).json({
            success: false,
            message: `Session has been revoked: ${session.revocationReason || "Access terminated by administrator"}`,
          });
        }
      }

      const adminUser = await prisma.adminUser.findUnique({
        where: { id: req.user.id },
        include: {
          role: {
            include: {
              rolePermissions: {
                include: { permission: true },
              },
            },
          },
        },
      });

      if (!adminUser || adminUser.status !== "active") {
        return res.status(403).json({ success: false, message: "Administrative account is suspended or inactive." });
      }

      // Super Admin has unrestricted access to everything
      const isSuper = adminUser.role?.name === "Super Admin" || adminUser.role?.name === "super_admin";
      if (isSuper) {
        return next();
      }

      // Verify specific permission key or full access
      const hasPerm = adminUser.role?.rolePermissions?.some(
        (rp) => rp.permission?.key === permissionKey || rp.permission?.key === "all"
      );

      if (!hasPerm) {
        return res.status(403).json({
          success: false,
          message: `Forbidden: Missing required permission '${permissionKey}' for this operation.`,
        });
      }

      next();
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  };
}

// ==========================================
// 1. SUMMARY DASHBOARD METRICS
// GET /api/admin/access-management/summary
// ==========================================
accessManagementRouter.get("/summary", async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const now = new Date();

    const [
      totalEmployees,
      activeEmployees,
      inactiveEmployees,
      rolesCreated,
      departmentsCount,
      allSessions,
      departments,
      topRolesList,
      recentLoginsList,
    ] = await Promise.all([
      prisma.adminUser.count(),
      prisma.adminUser.count({ where: { status: "active" } }),
      prisma.adminUser.count({ where: { status: { not: "active" } } }),
      prisma.role.count(),
      prisma.department.count(),
      prisma.adminSession.findMany({
        where: {
          isRevoked: false,
          expiresAt: { gt: now },
        },
        select: { id: true, deviceName: true, ipAddress: true, adminUserId: true },
      }),
      prisma.department.findMany({
        include: {
          _count: {
            select: { adminUsers: true, roles: true },
          },
        },
        orderBy: { adminUsers: { _count: "desc" } },
      }),
      prisma.role.findMany({
        take: 5,
        include: {
          department: { select: { id: true, name: true, code: true } },
          _count: { select: { adminUsers: true } },
        },
        orderBy: { adminUsers: { _count: "desc" } },
      }),
      prisma.adminLoginEvent.findMany({
        take: 6,
        orderBy: { loginTime: "desc" },
        include: {
          adminUser: {
            select: { id: true, fullName: true, email: true, avatarUrl: true },
          },
        },
      }),
    ]);

    // Active Devices = count of distinct valid device sessions
    const activeDevices = allSessions.length;

    // Department Stats for Chart
    const totalStaffCount = totalEmployees || 1;
    const departmentStats = departments.map((d) => ({
      id: d.id,
      name: d.name,
      code: d.code || d.slug.toUpperCase(),
      employeeCount: d._count.adminUsers,
      roleCount: d._count.roles,
      status: d.status,
      percentage: Math.round((d._count.adminUsers / totalStaffCount) * 100),
    }));

    // Top Departments for table
    const topDepartments = departments.slice(0, 5).map((d) => ({
      id: d.id,
      name: d.name,
      code: d.code || d.slug.toUpperCase(),
      employees: d._count.adminUsers,
      roles: d._count.roles,
      status: d.status,
    }));

    // Top Roles for table
    const topRoles = topRolesList.map((r) => ({
      id: r.id,
      roleName: r.name,
      department: r.department?.code || r.department?.name || "General",
      employees: r._count.adminUsers,
      status: r.status,
    }));

    // Recent login activity for table
    const recentLogins = recentLoginsList.map((l) => ({
      id: l.id,
      employee: l.adminUser?.fullName || l.email,
      device: l.device || "Unknown Device",
      location: l.location || "India",
      ipAddress: l.ipAddress || "127.0.0.1",
      loginTime: l.loginTime,
      status: l.status === "success" ? "Success" : "Failed",
    }));

    res.json({
      success: true,
      data: {
        totalEmployees,
        activeEmployees,
        inactiveEmployees,
        rolesCreated,
        departmentsCount,
        activeDevices,
        topDepartments,
        topRoles,
        recentLogins,
        departmentStats,
        serverTime: now.toISOString(),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 2. DEPARTMENTS CRUD
// ==========================================
accessManagementRouter.get("/departments", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const search = ((req.query.search as string) || "").trim();
    const status = (req.query.status as string) || "";
    const parentId = (req.query.parentId as string) || "";

    const where: any = {};
    if (status && status !== "all") {
      where.status = status;
    }
    if (parentId && parentId !== "all") {
      where.parentId = parentId === "root" ? null : parentId;
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.department.count({ where }),
      prisma.department.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          parent: { select: { id: true, name: true, code: true } },
          _count: { select: { adminUsers: true, roles: true, designations: true } },
        },
        orderBy: { name: "asc" },
      }),
    ]);

    const formatted = items.map((d) => ({
      id: d.id,
      name: d.name,
      code: d.code || d.slug.toUpperCase(),
      slug: d.slug,
      description: d.description,
      parent: d.parent ? d.parent.name : "None (Root)",
      parentId: d.parentId,
      location: d.location || "Headquarters",
      employees: d._count.adminUsers,
      roles: d._count.roles,
      designations: d._count.designations,
      status: d.status,
      createdAt: d.createdAt,
    }));

    res.json({
      success: true,
      data: {
        items: formatted,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

accessManagementRouter.post("/departments", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, code, description, parentId, location, status } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: "Department name is required" });
    }

    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const slug = `${baseSlug}-${Date.now().toString().slice(-4)}`;
    const deptCode = (code || name.slice(0, 3)).toUpperCase().trim();

    const department = await prisma.department.create({
      data: {
        name: name.trim(),
        code: deptCode,
        slug,
        description: description?.trim() || null,
        parentId: parentId || null,
        location: location?.trim() || "Headquarters",
        status: status || "active",
        createdBy: req.user?.id,
      },
    });

    if (req.user?.id) {
      await auditAction(req.user.id, "Departments", "create", `Created department "${department.name}" (${deptCode})`, req);
    }

    res.status(201).json({ success: true, data: department });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

accessManagementRouter.patch("/departments/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, code, description, parentId, location, status } = req.body;

    const updated = await prisma.department.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(code !== undefined && { code: code.toUpperCase().trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(parentId !== undefined && { parentId: parentId || null }),
        ...(location !== undefined && { location: location?.trim() }),
        ...(status !== undefined && { status }),
      },
    });

    if (req.user?.id) {
      await auditAction(req.user.id, "Departments", "update", `Updated department "${updated.name}"`, req);
    }

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

accessManagementRouter.patch("/departments/:id/status", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status || !["active", "inactive"].includes(status)) {
      return res.status(400).json({ success: false, message: "Valid status ('active' or 'inactive') is required" });
    }

    const updated = await prisma.department.update({
      where: { id },
      data: { status },
    });

    if (req.user?.id) {
      await auditAction(req.user.id, "Departments", "status_change", `Changed department "${updated.name}" status to ${status}`, req);
    }

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

accessManagementRouter.delete("/departments/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const dept = await prisma.department.findUnique({
      where: { id },
      include: { _count: { select: { adminUsers: true } } },
    });
    if (!dept) return res.status(404).json({ success: false, message: "Department not found" });

    if (dept._count.adminUsers > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete department with ${dept._count.adminUsers} assigned employees. Please reassign them first.`,
      });
    }

    await prisma.department.delete({ where: { id } });

    if (req.user?.id) {
      await auditAction(req.user.id, "Departments", "delete", `Deleted department "${dept.name}"`, req);
    }

    res.json({ success: true, message: "Department deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 3. DESIGNATIONS CRUD
// ==========================================
accessManagementRouter.get("/designations", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const search = ((req.query.search as string) || "").trim();
    const departmentId = (req.query.departmentId as string) || "";
    const status = (req.query.status as string) || "";

    const where: any = {};
    if (status && status !== "all") where.status = status;
    if (departmentId && departmentId !== "all") where.departmentId = departmentId;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
        { department: { name: { contains: search } } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.designation.count({ where }),
      prisma.designation.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          department: { select: { id: true, name: true, code: true } },
          reportsTo: { select: { id: true, name: true } },
          _count: { select: { adminUsers: true } },
        },
        orderBy: [{ department: { name: "asc" } }, { seniority: "desc" }],
      }),
    ]);

    const formatted = items.map((d) => ({
      id: d.id,
      name: d.name,
      code: d.code,
      department: d.department.name,
      departmentCode: d.department.code,
      departmentId: d.departmentId,
      jobGrade: d.jobGrade || "Standard",
      reportsTo: d.reportsTo?.name || "None",
      seniority: d.seniority,
      employees: d._count.adminUsers,
      status: d.status,
      createdAt: d.createdAt,
    }));

    res.json({
      success: true,
      data: {
        items: formatted,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

accessManagementRouter.post("/designations", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, code, departmentId, jobGrade, reportsToId, seniority, status } = req.body;
    if (!name?.trim() || !departmentId) {
      return res.status(400).json({ success: false, message: "Designation name and department are required" });
    }

    const desigCode = (code || `DES-${Date.now().toString().slice(-6)}`).toUpperCase().trim();

    const designation = await prisma.designation.create({
      data: {
        name: name.trim(),
        code: desigCode,
        departmentId,
        jobGrade: jobGrade?.trim() || "Standard",
        reportsToId: reportsToId || null,
        seniority: parseInt(seniority) || 1,
        status: status || "active",
      },
      include: { department: true },
    });

    if (req.user?.id) {
      await auditAction(req.user.id, "Designations", "create", `Created designation "${designation.name}" in ${designation.department.name}`, req);
    }

    res.status(201).json({ success: true, data: designation });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

accessManagementRouter.patch("/designations/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, code, departmentId, jobGrade, reportsToId, seniority, status } = req.body;

    const updated = await prisma.designation.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(code !== undefined && { code: code.toUpperCase().trim() }),
        ...(departmentId !== undefined && { departmentId }),
        ...(jobGrade !== undefined && { jobGrade: jobGrade?.trim() }),
        ...(reportsToId !== undefined && { reportsToId: reportsToId || null }),
        ...(seniority !== undefined && { seniority: parseInt(seniority) }),
        ...(status !== undefined && { status }),
      },
      include: { department: true },
    });

    if (req.user?.id) {
      await auditAction(req.user.id, "Designations", "update", `Updated designation "${updated.name}"`, req);
    }

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

accessManagementRouter.patch("/designations/:id/status", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const updated = await prisma.designation.update({
      where: { id },
      data: { status },
    });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

accessManagementRouter.delete("/designations/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const desig = await prisma.designation.findUnique({
      where: { id },
      include: { _count: { select: { adminUsers: true } } },
    });
    if (!desig) return res.status(404).json({ success: false, message: "Designation not found" });

    if (desig._count.adminUsers > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete designation assigned to ${desig._count.adminUsers} employees.`,
      });
    }

    await prisma.designation.delete({ where: { id } });
    res.json({ success: true, message: "Designation deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 4. ROLES & PERMISSION MATRIX
// ==========================================
accessManagementRouter.get("/roles", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const search = ((req.query.search as string) || "").trim();
    const departmentId = (req.query.departmentId as string) || "";
    const category = (req.query.category as string) || "";

    const where: any = {};
    if (departmentId && departmentId !== "all") where.departmentId = departmentId;
    if (category && category !== "all") where.category = category;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.role.count({ where }),
      prisma.role.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          department: { select: { id: true, name: true, code: true } },
          _count: { select: { adminUsers: true, rolePermissions: true } },
        },
        orderBy: [{ systemProtected: "desc" }, { name: "asc" }],
      }),
    ]);

    const formatted = items.map((r) => ({
      id: r.id,
      name: r.name,
      code: r.code || r.name.toUpperCase().replace(/\s+/g, "_"),
      description: r.description,
      category: r.category,
      department: r.department?.name || "All Departments",
      departmentCode: r.department?.code,
      departmentId: r.departmentId,
      systemProtected: r.systemProtected,
      status: r.status,
      employees: r._count.adminUsers,
      permissionsCount: r._count.rolePermissions,
      createdAt: r.createdAt,
    }));

    res.json({
      success: true,
      data: {
        items: formatted,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

accessManagementRouter.post("/roles", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, code, description, departmentId, category, status } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: "Role name is required" });
    }

    const roleCode = (code || `ROLE-${name.replace(/\s+/g, "_").toUpperCase()}`).trim();

    const role = await prisma.role.create({
      data: {
        name: name.trim(),
        code: roleCode,
        description: description?.trim() || null,
        departmentId: departmentId || null,
        category: category || "custom",
        systemProtected: false,
        status: status || "active",
        createdBy: req.user?.id,
      },
    });

    if (req.user?.id) {
      await auditAction(req.user.id, "Roles", "create", `Created role "${role.name}" (${roleCode})`, req);
    }

    res.status(201).json({ success: true, data: role });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

accessManagementRouter.get("/roles/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const role = await prisma.role.findUnique({
      where: { id: req.params.id },
      include: {
        department: true,
        rolePermissions: {
          include: { permission: true },
        },
        _count: { select: { adminUsers: true } },
      },
    });
    if (!role) return res.status(404).json({ success: false, message: "Role not found" });

    res.json({ success: true, data: role });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

accessManagementRouter.patch("/roles/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, departmentId, category, status } = req.body;

    const existing = await prisma.role.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: "Role not found" });

    if (existing.systemProtected && name && name !== existing.name) {
      return res.status(403).json({ success: false, message: "Protected system roles cannot be renamed" });
    }

    const updated = await prisma.role.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(departmentId !== undefined && { departmentId: departmentId || null }),
        ...(category !== undefined && { category }),
        ...(status !== undefined && { status }),
        updatedBy: req.user?.id,
      },
    });

    if (req.user?.id) {
      await auditAction(req.user.id, "Roles", "update", `Updated role "${updated.name}"`, req);
    }

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

accessManagementRouter.post("/roles/:id/duplicate", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const source = await prisma.role.findUnique({
      where: { id: req.params.id },
      include: { rolePermissions: true },
    });
    if (!source) return res.status(404).json({ success: false, message: "Source role not found" });

    const newName = `${source.name} (Copy ${Date.now().toString().slice(-4)})`;
    const newCode = `${source.code || "ROLE"}_COPY_${Date.now().toString().slice(-4)}`;

    const duplicated = await prisma.role.create({
      data: {
        name: newName,
        code: newCode,
        description: `Duplicated from ${source.name}. ${source.description || ""}`.trim(),
        departmentId: source.departmentId,
        category: "custom",
        systemProtected: false,
        status: "active",
        createdBy: req.user?.id,
      },
    });

    // Copy permission mappings
    for (const rp of source.rolePermissions) {
      await prisma.rolePermission.create({
        data: {
          roleId: duplicated.id,
          permissionId: rp.permissionId,
          scope: rp.scope,
          actions: rp.actions,
          fieldMasking: rp.fieldMasking,
        },
      });
    }

    if (req.user?.id) {
      await auditAction(req.user.id, "Roles", "duplicate", `Duplicated role "${source.name}" as "${duplicated.name}"`, req);
    }

    res.status(201).json({ success: true, data: duplicated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update Role Permissions Matrix
accessManagementRouter.put("/roles/:id/permissions", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const roleId = req.params.id;
    const { permissions } = req.body; // Array of { permissionId, scope, actions, fieldMasking }

    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) return res.status(404).json({ success: false, message: "Role not found" });

    if (role.name === "Super Admin" && req.user?.role !== "Super Admin" && req.user?.role !== "super_admin") {
      return res.status(403).json({ success: false, message: "Only Super Admin can modify Super Admin permissions" });
    }

    // Prevent self-privilege escalation: cannot modify own assigned role
    const currentUser = await prisma.adminUser.findUnique({ where: { id: req.user?.id } });
    if (currentUser?.roleId === roleId && req.user?.role !== "Super Admin" && req.user?.role !== "super_admin") {
      return res.status(403).json({ success: false, message: "Self-privilege escalation prohibited: You cannot modify permissions for your own assigned role." });
    }

    if (!Array.isArray(permissions)) {
      return res.status(400).json({ success: false, message: "permissions array is required" });
    }

    // Delete existing permissions for this role and replace
    await prisma.rolePermission.deleteMany({ where: { roleId } });

    for (const p of permissions) {
      if (p.permissionId) {
        await prisma.rolePermission.create({
          data: {
            roleId,
            permissionId: p.permissionId,
            scope: p.scope || "all",
            actions: Array.isArray(p.actions) ? p.actions : ["view"],
            fieldMasking: p.fieldMasking || null,
          },
        });
      }
    }

    if (req.user?.id) {
      await auditAction(req.user.id, "Permissions", "sync", `Synchronized ${permissions.length} permissions for role "${role.name}"`, req);
    }

    res.json({ success: true, message: "Role permissions saved successfully", count: permissions.length });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 5. PERMISSION REGISTRY & TREE
// ==========================================
accessManagementRouter.get("/permissions/registry", async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const permissions = await prisma.permission.findMany({
      orderBy: [{ module: "asc" }, { order: "asc" }],
    });
    res.json({ success: true, data: permissions });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

accessManagementRouter.get("/permissions/tree", async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const all = await prisma.permission.findMany({
      orderBy: [{ module: "asc" }, { order: "asc" }],
    });

    // Group into hierarchical modules
    const modulesMap = new Map<string, any[]>();
    for (const p of all) {
      const topModule = p.module.split(" - ")[0] || p.module;
      if (!modulesMap.has(topModule)) {
        modulesMap.set(topModule, []);
      }
      modulesMap.get(topModule)!.push(p);
    }

    const tree = Array.from(modulesMap.entries()).map(([moduleName, items]) => ({
      module: moduleName,
      items: items.map((i) => ({
        id: i.id,
        key: i.key,
        name: i.name,
        category: i.category,
        action: i.action,
        order: i.order,
      })),
    }));

    res.json({ success: true, data: tree });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 6. EMPLOYEES / STAFF MANAGEMENT
// ==========================================
accessManagementRouter.get("/staff", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
    const search = ((req.query.search as string) || "").trim();
    const departmentId = (req.query.departmentId as string) || "";
    const roleId = (req.query.roleId as string) || "";
    const status = (req.query.status as string) || "";

    const where: any = {};
    if (status && status !== "all") where.status = status;
    if (departmentId && departmentId !== "all") where.departmentId = departmentId;
    if (roleId && roleId !== "all") where.roleId = roleId;
    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { email: { contains: search } },
        { employeeCode: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    const [total, staffList] = await Promise.all([
      prisma.adminUser.count({ where }),
      prisma.adminUser.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          department: { select: { id: true, name: true, code: true } },
          designation: { select: { id: true, name: true, code: true } },
          role: { select: { id: true, name: true, code: true } },
          _count: {
            select: {
              staffSessions: { where: { isRevoked: false } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const formatted = staffList.map((s) => ({
      id: s.id,
      fullName: s.fullName,
      email: s.email,
      phone: s.phone || "—",
      avatarUrl: s.avatarUrl,
      employeeCode: s.employeeCode || `EMP-${s.id.slice(0, 5).toUpperCase()}`,
      department: s.department?.code || s.department?.name || "General",
      departmentName: s.department?.name || "General",
      departmentId: s.departmentId,
      designation: s.designation?.name || "Staff Member",
      designationId: s.designationId,
      role: s.role?.name || "Staff",
      roleId: s.roleId,
      accessLevel: s.accessLevel || "custom",
      status: s.status,
      employmentStatus: s.employmentStatus,
      joiningDate: s.joiningDate || s.createdAt,
      lastLoginAt: s.lastLoginAt,
      lastLoginLocation: s.lastLoginLocation || null,
      activeDevices: s._count.staffSessions,
    }));

    res.json({
      success: true,
      data: {
        items: formatted,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

accessManagementRouter.get("/staff/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const staff = await prisma.adminUser.findUnique({
      where: { id: req.params.id },
      include: {
        department: true,
        designation: true,
        role: {
          include: {
            rolePermissions: {
              include: { permission: true },
            },
          },
        },
        reportingManager: { select: { id: true, fullName: true, email: true } },
        staffSessions: {
          where: { isRevoked: false },
          orderBy: { lastActivityAt: "desc" },
        },
        loginEvents: {
          take: 10,
          orderBy: { loginTime: "desc" },
        },
        staffAuditLogs: {
          take: 10,
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!staff) return res.status(404).json({ success: false, message: "Employee not found" });

    res.json({ success: true, data: staff });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

accessManagementRouter.post("/staff", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      fullName,
      email,
      password,
      phone,
      departmentId,
      designationId,
      roleId,
      accessLevel,
      officeLocation,
      employmentType,
    } = req.body;

    if (!fullName?.trim() || !email?.trim() || !password?.trim()) {
      return res.status(400).json({ success: false, message: "Full name, email, and password are required" });
    }

    const existing = await prisma.adminUser.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (existing) {
      return res.status(409).json({ success: false, message: "A staff account with this email already exists" });
    }

    // Default to a valid role if not specified
    let targetRoleId = roleId;
    if (!targetRoleId) {
      const defaultRole = await prisma.role.findFirst({ where: { name: "CRM Executive" } });
      targetRoleId = defaultRole?.id;
    }
    if (!targetRoleId) {
      const anyRole = await prisma.role.findFirst();
      targetRoleId = anyRole?.id;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const employeeCode = `EMP-${Date.now().toString().slice(-6)}`;

    const newStaff = await prisma.adminUser.create({
      data: {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        password: hashedPassword,
        phone: phone?.trim() || null,
        employeeCode,
        departmentId: departmentId || null,
        designationId: designationId || null,
        roleId: targetRoleId!,
        accessLevel: accessLevel || "menu_access",
        officeLocation: officeLocation?.trim() || "Headquarters",
        employmentType: employmentType || "full_time",
        employmentStatus: "active",
        status: "active",
        joiningDate: new Date(),
        createdBy: req.user?.id,
      },
      include: { department: true, designation: true, role: true },
    });

    if (req.user?.id) {
      await auditAction(req.user.id, "Employees", "create", `Created employee account "${newStaff.fullName}" (${newStaff.email})`, req);
    }

    // Auto-dispatch onboarding welcome email with credentials, role, and permissions
    sendEmployeeWelcomeEmail({
      fullName: newStaff.fullName,
      email: newStaff.email,
      password: password.trim(),
      employeeCode: newStaff.employeeCode || `EMP-${Date.now().toString().slice(-6)}`,
      department: newStaff.department?.name || "General",
      designation: newStaff.designation?.name || "Staff Member",
      role: newStaff.role?.name || "Assigned Role",
      accessLevel: newStaff.accessLevel || "Full Access",
      roleId: targetRoleId!,
    }).catch((err) => console.error("[EMPLOYEE ONBOARDING] Async email dispatch error:", err));

    res.status(201).json({ success: true, data: newStaff });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

accessManagementRouter.patch("/staff/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      fullName,
      phone,
      departmentId,
      designationId,
      roleId,
      accessLevel,
      status,
      officeLocation,
      employmentStatus,
      password,
    } = req.body;

    const existing = await prisma.adminUser.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!existing) return res.status(404).json({ success: false, message: "Staff not found" });

    // 1. Protect Super Admin: cannot be deactivated, suspended, or demoted
    if (existing.email === "superadmin@goexperts.com") {
      if (status && status !== "active") {
        return res.status(403).json({ success: false, message: "The primary Super Admin account cannot be deactivated or suspended" });
      }
      if (roleId && roleId !== existing.roleId) {
        return res.status(403).json({ success: false, message: "The primary Super Admin role cannot be demoted or changed" });
      }
    }

    // 2. Prevent Self-Privilege Escalation
    if (req.user?.id === id) {
      if (roleId && roleId !== existing.roleId) {
        return res.status(403).json({ success: false, message: "Self-privilege escalation prohibited: You cannot modify your own assigned role." });
      }
      if (accessLevel && accessLevel !== existing.accessLevel) {
        return res.status(403).json({ success: false, message: "Self-privilege escalation prohibited: You cannot alter your own access level." });
      }
      if (status && status !== existing.status) {
        return res.status(403).json({ success: false, message: "You cannot alter your own account status." });
      }
    }

    // 3. Only Super Admin can assign the Super Admin role to anyone
    if (roleId && roleId !== existing.roleId) {
      const targetRole = await prisma.role.findUnique({ where: { id: roleId } });
      if (targetRole?.name === "Super Admin" && req.user?.role !== "Super Admin" && req.user?.role !== "super_admin") {
        return res.status(403).json({ success: false, message: "Only an active Super Admin can assign the Super Admin role." });
      }
    }

    let hashedPassword = undefined;
    if (password && password.trim().length >= 6) {
      const salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(password.trim(), salt);
    }

    const updated = await prisma.adminUser.update({
      where: { id },
      data: {
        ...(fullName !== undefined && { fullName: fullName.trim() }),
        ...(phone !== undefined && { phone: phone?.trim() || null }),
        ...(departmentId !== undefined && { departmentId: departmentId || null }),
        ...(designationId !== undefined && { designationId: designationId || null }),
        ...(roleId !== undefined && { roleId }),
        ...(accessLevel !== undefined && { accessLevel }),
        ...(status !== undefined && { status }),
        ...(officeLocation !== undefined && { officeLocation }),
        ...(employmentStatus !== undefined && { employmentStatus }),
        ...(hashedPassword && { password: hashedPassword }),
      },
      include: { department: true, designation: true, role: true },
    });

    // If status changed to inactive/suspended or role changed, invalidate active sessions immediately
    if ((status && status !== "active") || (roleId && roleId !== existing.roleId)) {
      await prisma.adminSession.updateMany({
        where: { adminUserId: id, isRevoked: false },
        data: {
          isRevoked: true,
          revokedAt: new Date(),
          revocationReason: status && status !== "active" ? `Account status set to ${status}` : "Role assignment updated",
        },
      });
    }

    if (req.user?.id) {
      await auditAction(req.user.id, "Employees", "update", `Updated employee account "${updated.fullName}"`, req);
    }

    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

accessManagementRouter.post("/staff/:id/sessions/revoke", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.adminSession.updateMany({
      where: { adminUserId: id, isRevoked: false },
      data: { isRevoked: true, revokedAt: new Date(), revocationReason: `Revoked by administrator (${req.user?.email})` },
    });

    if (req.user?.id) {
      await auditAction(req.user.id, "Sessions", "revoke_all", `Revoked all active sessions for employee ${id}`, req);
    }

    res.json({ success: true, message: "All sessions revoked for employee" });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete Employee Permanently & Invalidate All Future Access
accessManagementRouter.delete("/staff/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.adminUser.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    // 1. Protect Super Admin: primary admin account cannot be deleted
    if (existing.email === "superadmin@goexperts.com" || (existing.role?.name === "Super Admin" && existing.email === "superadmin@goexperts.com")) {
      return res.status(403).json({ success: false, message: "The primary Super Admin account cannot be deleted" });
    }

    // 2. Prevent Self-Deletion
    if (req.user?.id === id) {
      return res.status(403).json({ success: false, message: "You cannot delete your own logged-in admin account." });
    }

    // 3. Delete dependent sessions, tokens, audits, and employee record
    await prisma.$transaction([
      prisma.adminSession.deleteMany({ where: { adminUserId: id } }),
      prisma.adminLoginEvent.deleteMany({ where: { adminUserId: id } }),
      prisma.staffActivityAudit.deleteMany({ where: { adminUserId: id } }),
      prisma.session.deleteMany({ where: { adminUserId: id } }),
      prisma.refreshToken.deleteMany({ where: { adminUserId: id } }),
      prisma.adminUser.delete({ where: { id } }),
    ]);

    if (req.user?.id) {
      await auditAction(
        req.user.id,
        "Employees",
        "delete",
        `Permanently deleted employee account "${existing.fullName}" (${existing.email})`,
        req
      );
    }

    res.json({
      success: true,
      message: `Employee "${existing.fullName}" has been permanently deleted and all access revoked.`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Bulk Staff Actions
accessManagementRouter.post("/staff/bulk-action", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { action, employeeIds, roleId } = req.body;
    if (!action || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      return res.status(400).json({ success: false, message: "action and employeeIds array are required" });
    }

    // Filter out Super Admin from bulk modifications to prevent accidental lockout
    const safeEmployeeIds = [];
    for (const empId of employeeIds) {
      const emp = await prisma.adminUser.findUnique({ where: { id: empId } });
      if (emp?.email !== "superadmin@goexperts.com") {
        safeEmployeeIds.push(empId);
      }
    }

    if (action === "activate") {
      await prisma.adminUser.updateMany({
        where: { id: { in: safeEmployeeIds } },
        data: { status: "active" },
      });
    } else if (action === "suspend") {
      await prisma.adminUser.updateMany({
        where: { id: { in: safeEmployeeIds } },
        data: { status: "suspended" },
      });
    } else if (action === "assign_role" && roleId) {
      await prisma.adminUser.updateMany({
        where: { id: { in: safeEmployeeIds } },
        data: { roleId },
      });
    } else if (action === "revoke_sessions") {
      await prisma.adminSession.updateMany({
        where: { adminUserId: { in: safeEmployeeIds }, isRevoked: false },
        data: { isRevoked: true, revokedAt: new Date(), revocationReason: "Bulk revoked by administrator" },
      });
    }

    if (req.user?.id) {
      await auditAction(req.user.id, "Employees", `bulk_${action}`, `Executed ${action} on ${safeEmployeeIds.length} employees`, req);
    }

    res.json({ success: true, message: `Bulk action '${action}' completed on ${safeEmployeeIds.length} employees` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 7. SESSIONS & DEVICES
// ==========================================
accessManagementRouter.get("/staff-sessions", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

    const [total, sessions] = await Promise.all([
      prisma.adminSession.count({ where: { isRevoked: false } }),
      prisma.adminSession.findMany({
        where: { isRevoked: false },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          adminUser: {
            select: { id: true, fullName: true, email: true, employeeCode: true, department: true },
          },
        },
        orderBy: { lastActivityAt: "desc" },
      }),
    ]);

    const formatted = sessions.map((s) => ({
      id: s.id,
      employee: s.adminUser.fullName,
      email: s.adminUser.email,
      department: s.adminUser.department?.name || "General",
      device: s.deviceName || `${s.operatingSystem} (${s.browser})`,
      ipAddress: s.ipAddress,
      location: s.location || "India",
      lastActivity: s.lastActivityAt,
      createdAt: s.createdAt,
    }));

    res.json({
      success: true,
      data: {
        items: formatted,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

accessManagementRouter.post("/staff-sessions/:id/revoke", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const session = await prisma.adminSession.update({
      where: { id },
      data: { isRevoked: true, revokedAt: new Date(), revocationReason: "Session manually revoked" },
    });
    res.json({ success: true, data: session, message: "Session revoked successfully" });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 8. AUDIT & ACTIVITY LOGS
// ==========================================
accessManagementRouter.get("/staff-audit-logs", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const search = ((req.query.search as string) || "").trim();
    const module = (req.query.module as string) || "";

    const where: any = {};
    if (module && module !== "all") where.module = module;
    if (search) {
      where.OR = [
        { action: { contains: search } },
        { details: { contains: search } },
        { adminUser: { fullName: { contains: search } } },
      ];
    }

    const [total, logs] = await Promise.all([
      prisma.staffActivityAudit.count({ where }),
      prisma.staffActivityAudit.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          adminUser: {
            select: { id: true, fullName: true, email: true, employeeCode: true, department: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const formatted = logs.map((l) => ({
      id: l.id,
      timestamp: l.createdAt,
      employee: l.adminUser.fullName,
      email: l.adminUser.email,
      department: l.adminUser.department?.name || "General",
      module: l.module,
      action: l.action,
      details: l.details,
      ipAddress: l.ipAddress,
      location: l.location || "India",
      status: l.status,
    }));

    res.json({
      success: true,
      data: {
        items: formatted,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 9. ACCESS REPORTS & GRANTS
// ==========================================
accessManagementRouter.get("/access-reports", async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const [totalGrants, activeGrants, expiredGrants, highPrivilegeCount, roles] = await Promise.all([
      prisma.adminAccessGrant.count(),
      prisma.adminAccessGrant.count({ where: { status: "active" } }),
      prisma.adminAccessGrant.count({ where: { status: { not: "active" } } }),
      prisma.adminUser.count({ where: { accessLevel: "full_access" } }),
      prisma.role.findMany({
        include: { _count: { select: { adminUsers: true } } },
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalGrants,
        activeGrants,
        expiredGrants,
        highPrivilegeCount,
        rolesBreakdown: roles.map((r) => ({ roleName: r.name, count: r._count.adminUsers })),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 10. ACCESS GRANTS MANAGEMENT
// ==========================================
accessManagementRouter.get("/access-grants", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const status = (req.query.status as string) || "";

    const where: any = {};
    if (status && status !== "all") where.status = status;

    const [total, grants] = await Promise.all([
      prisma.adminAccessGrant.count({ where }),
      prisma.adminAccessGrant.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          grantor: { select: { id: true, fullName: true, email: true } },
          staff: { select: { id: true, fullName: true, email: true, employeeCode: true, department: true } },
          role: { select: { id: true, name: true, code: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const formatted = grants.map((g) => ({
      id: g.id,
      grantor: g.grantor.fullName,
      grantorEmail: g.grantor.email,
      staff: g.staff.fullName,
      staffEmail: g.staff.email,
      staffCode: g.staff.employeeCode,
      department: g.staff.department?.name || "General",
      role: g.role?.name || "Custom Role",
      scope: g.scope,
      reason: g.reason || "Administrative assignment",
      status: g.status,
      expiresAt: g.expiresAt,
      createdAt: g.createdAt,
    }));

    res.json({
      success: true,
      data: {
        items: formatted,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

accessManagementRouter.post("/access-grants", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { staffId, roleId, scope, reason, expiresAt } = req.body;
    if (!staffId) {
      return res.status(400).json({ success: false, message: "staffId is required" });
    }

    const grant = await prisma.adminAccessGrant.create({
      data: {
        grantorId: req.user!.id,
        staffId,
        roleId: roleId || null,
        scope: scope || "assigned",
        reason: reason?.trim() || "Administrative access grant",
        status: "active",
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      include: { staff: true, role: true },
    });

    if (req.user?.id) {
      await auditAction(
        req.user.id,
        "Access Grants",
        "create",
        `Granted access role "${grant.role?.name || "Custom"}" to ${grant.staff.fullName}`,
        req
      );
    }

    res.status(201).json({ success: true, data: grant });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

accessManagementRouter.post("/access-grants/:id/revoke", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const grant = await prisma.adminAccessGrant.update({
      where: { id },
      data: { status: "revoked", revokedAt: new Date() },
    });

    if (req.user?.id) {
      await auditAction(req.user.id, "Access Grants", "revoke", `Revoked access grant ${id}`, req);
    }

    res.json({ success: true, data: grant, message: "Access grant revoked successfully" });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 11. SECURITY POLICY MANAGEMENT
// ==========================================
accessManagementRouter.get("/security-policy", async (_req: AuthenticatedRequest, res: Response) => {
  try {
    let policy = await prisma.adminSecurityPolicy.findFirst();
    if (!policy) {
      policy = await prisma.adminSecurityPolicy.create({
        data: {
          sessionTimeoutMinutes: 60,
          maxConcurrentSessions: 5,
          requireMfa: false,
          ipWhitelist: "",
          countryRestrictions: "",
          defaultDataScope: "assigned",
        },
      });
    }
    res.json({ success: true, data: policy });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

accessManagementRouter.patch("/security-policy", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== "Super Admin" && req.user?.role !== "super_admin") {
      return res.status(403).json({ success: false, message: "Forbidden: Only Super Admin can modify platform security policies." });
    }

    const { sessionTimeoutMinutes, maxConcurrentSessions, requireMfa, ipWhitelist, countryRestrictions, defaultDataScope } = req.body;
    let policy = await prisma.adminSecurityPolicy.findFirst();

    if (!policy) {
      policy = await prisma.adminSecurityPolicy.create({
        data: {
          sessionTimeoutMinutes: sessionTimeoutMinutes || 60,
          maxConcurrentSessions: maxConcurrentSessions || 5,
          requireMfa: requireMfa !== undefined ? Boolean(requireMfa) : false,
          ipWhitelist: ipWhitelist || "",
          countryRestrictions: countryRestrictions || "",
          defaultDataScope: defaultDataScope || "assigned",
        },
      });
    } else {
      policy = await prisma.adminSecurityPolicy.update({
        where: { id: policy.id },
        data: {
          ...(sessionTimeoutMinutes !== undefined && { sessionTimeoutMinutes: parseInt(sessionTimeoutMinutes) }),
          ...(maxConcurrentSessions !== undefined && { maxConcurrentSessions: parseInt(maxConcurrentSessions) }),
          ...(requireMfa !== undefined && { requireMfa: Boolean(requireMfa) }),
          ...(ipWhitelist !== undefined && { ipWhitelist }),
          ...(countryRestrictions !== undefined && { countryRestrictions }),
          ...(defaultDataScope !== undefined && { defaultDataScope }),
        },
      });
    }

    if (req.user?.id) {
      await auditAction(req.user.id, "Security Policy", "update", "Updated system security policies", req);
    }

    res.json({ success: true, data: policy, message: "Security policy updated successfully" });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 12. CURRENT STAFF NAVIGATION & PERMISSIONS
// GET /api/admin/me/navigation
// ==========================================
accessManagementRouter.get("/me/navigation", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminUser = await prisma.adminUser.findUnique({
      where: { id: req.user?.id },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: { permission: true },
            },
          },
        },
        department: true,
        designation: true,
      },
    });

    if (!adminUser) {
      return res.status(404).json({ success: false, message: "Staff profile not found" });
    }

    const isSuperAdmin = adminUser.role.name === "Super Admin" || adminUser.role.name === "super_admin";
    const grantedKeys = new Set<string>();

    if (isSuperAdmin) {
      // Super Admin receives everything
      const allPerms = await prisma.permission.findMany();
      allPerms.forEach((p) => {
        if (p.key) grantedKeys.add(p.key);
      });
    } else {
      adminUser.role.rolePermissions.forEach((rp) => {
        if (rp.permission?.key) {
          grantedKeys.add(rp.permission.key);
        }
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: adminUser.id,
          fullName: adminUser.fullName,
          email: adminUser.email,
          role: adminUser.role.name,
          department: adminUser.department?.name,
          designation: adminUser.designation?.name,
          accessLevel: adminUser.accessLevel,
          isSuperAdmin,
        },
        permittedKeys: Array.from(grantedKeys),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default accessManagementRouter;
