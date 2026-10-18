import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export async function seedEmployees() {
  if (process.env.NODE_ENV === "production") {
    console.error("🛑 CRITICAL: seed-employees.ts contains development simulation records and is strictly prohibited in PRODUCTION.");
    throw new Error("Zero mock data violation: Cannot execute seed-employees.ts in production.");
  }
  console.log("👥 Seeding Enterprise Staff Employees (Development Only)...");

  // Fetch departments and roles
  const departments = await prisma.department.findMany();
  const designations = await prisma.designation.findMany();
  const roles = await prisma.role.findMany();

  const getDept = (code: string) => departments.find((d) => d.code === code)?.id;
  const getDesig = (code: string) => designations.find((d) => d.code === code)?.id;
  const getRole = (name: string) => roles.find((r) => r.name === name)?.id;

  const superAdmin = await prisma.adminUser.findFirst({ where: { email: "superadmin@goexperts.com" } });

  const staffEmployees = [
    {
      fullName: "Rahul Sharma",
      email: "rahul.sharma@goexperts.com",
      phone: "+91 98765 43210",
      employeeCode: "EMP-CRM-001",
      deptCode: "CRM",
      desigCode: "DES-CRM-MGR",
      roleName: "CRM Manager",
      accessLevel: "full_access",
      officeLocation: "New Delhi, India",
      status: "active",
      employmentStatus: "active",
      joiningDate: new Date("2024-01-15T09:00:00Z"),
      lastLoginIp: "103.21.244.12",
      lastLoginLocation: "New Delhi, India",
      lastLoginAt: new Date("2024-10-16T10:30:00Z"),
      devices: [
        { name: "Windows (Chrome)", os: "Windows 11", browser: "Chrome 129", ip: "103.21.244.12", location: "New Delhi, India" },
        { name: "iPhone (Safari)", os: "iOS 18", browser: "Mobile Safari", ip: "103.21.244.15", location: "New Delhi, India" },
        { name: "MacBook Pro (Chrome)", os: "macOS 15", browser: "Chrome 129", ip: "103.21.244.18", location: "New Delhi, India" },
      ],
    },
    {
      fullName: "Priya Mehta",
      email: "priya.mehta@goexperts.com",
      phone: "+91 98112 23344",
      employeeCode: "EMP-OPS-002",
      deptCode: "OPS",
      desigCode: "DES-SUP-EXEC",
      roleName: "Support Agent",
      accessLevel: "menu_access",
      officeLocation: "Mumbai, India",
      status: "active",
      employmentStatus: "active",
      joiningDate: new Date("2024-02-10T09:00:00Z"),
      lastLoginIp: "49.36.128.45",
      lastLoginLocation: "Mumbai, India",
      lastLoginAt: new Date("2024-10-16T09:15:00Z"),
      devices: [
        { name: "iPhone (Safari)", os: "iOS 18", browser: "Mobile Safari", ip: "49.36.128.45", location: "Mumbai, India" },
        { name: "Windows (Chrome)", os: "Windows 11", browser: "Chrome 128", ip: "49.36.128.46", location: "Mumbai, India" },
      ],
    },
    {
      fullName: "Amit Kumar",
      email: "amit.kumar@goexperts.com",
      phone: "+91 97223 34455",
      employeeCode: "EMP-FIN-003",
      deptCode: "FIN",
      desigCode: "DES-FIN-EXEC",
      roleName: "Finance Executive",
      accessLevel: "view_edit",
      officeLocation: "Bengaluru, India",
      status: "active",
      employmentStatus: "active",
      joiningDate: new Date("2024-03-01T09:00:00Z"),
      lastLoginIp: "27.58.97.221",
      lastLoginLocation: "Bengaluru, India",
      lastLoginAt: new Date("2024-10-15T18:20:00Z"),
      devices: [
        { name: "Windows (Edge)", os: "Windows 10", browser: "Edge 128", ip: "27.58.97.221", location: "Bengaluru, India" },
      ],
    },
    {
      fullName: "Sneha Patel",
      email: "sneha.patel@goexperts.com",
      phone: "+91 96334 45566",
      employeeCode: "EMP-HR-004",
      deptCode: "HR",
      desigCode: "DES-HR-EXEC",
      roleName: "HR Employee",
      accessLevel: "view_only",
      officeLocation: "Ahmedabad, India",
      status: "active",
      employmentStatus: "active",
      joiningDate: new Date("2024-04-18T09:00:00Z"),
      lastLoginIp: "103.12.65.91",
      lastLoginLocation: "Ahmedabad, India",
      lastLoginAt: new Date("2024-10-15T16:12:00Z"),
      devices: [
        { name: "Mac (Chrome)", os: "macOS Sonoma", browser: "Chrome 128", ip: "103.12.65.91", location: "Ahmedabad, India" },
        { name: "iPad (Safari)", os: "iPadOS 17", browser: "Mobile Safari", ip: "103.12.65.92", location: "Ahmedabad, India" },
      ],
    },
    {
      fullName: "Vikram Singh",
      email: "vikram.singh@goexperts.com",
      phone: "+91 95445 56677",
      employeeCode: "EMP-MKT-005",
      deptCode: "MKT",
      desigCode: "DES-MKT-LEAD",
      roleName: "Marketing Manager",
      accessLevel: "custom",
      officeLocation: "Pune, India",
      status: "active",
      employmentStatus: "active",
      joiningDate: new Date("2024-05-20T09:00:00Z"),
      lastLoginIp: "49.37.201.15",
      lastLoginLocation: "Pune, India",
      lastLoginAt: new Date("2024-10-14T11:45:00Z"),
      devices: [
        { name: "Android (Chrome)", os: "Android 14", browser: "Chrome 128", ip: "49.37.201.15", location: "Pune, India" },
        { name: "Windows (Chrome)", os: "Windows 11", browser: "Chrome 128", ip: "49.37.201.16", location: "Pune, India" },
        { name: "MacBook (Brave)", os: "macOS 15", browser: "Brave 1.69", ip: "49.37.201.17", location: "Pune, India" },
        { name: "Linux (Firefox)", os: "Ubuntu 24", browser: "Firefox 130", ip: "49.37.201.18", location: "Pune, India" },
      ],
    },
    {
      fullName: "Ananya Iyer",
      email: "ananya.iyer@goexperts.com",
      phone: "+91 94556 67788",
      employeeCode: "EMP-TECH-006",
      deptCode: "TECH",
      desigCode: "DES-ENG-TECHLEAD",
      roleName: "Access Administrator",
      accessLevel: "full_access",
      officeLocation: "Chennai, India",
      status: "active",
      employmentStatus: "active",
      joiningDate: new Date("2023-11-01T09:00:00Z"),
      lastLoginIp: "106.51.72.19",
      lastLoginLocation: "Chennai, India",
      lastLoginAt: new Date("2024-10-16T11:00:00Z"),
      devices: [
        { name: "MacBook Pro (Chrome)", os: "macOS Sequoia", browser: "Chrome 129", ip: "106.51.72.19", location: "Chennai, India" },
      ],
    },
    {
      fullName: "Rohan Deshmukh",
      email: "rohan.deshmukh@goexperts.com",
      phone: "+91 93667 78899",
      employeeCode: "EMP-CRM-007",
      deptCode: "CRM",
      desigCode: "DES-CRM-EXEC",
      roleName: "CRM Executive",
      accessLevel: "view_edit",
      officeLocation: "Hyderabad, India",
      status: "active",
      employmentStatus: "active",
      joiningDate: new Date("2024-06-15T09:00:00Z"),
      lastLoginIp: "182.74.88.33",
      lastLoginLocation: "Hyderabad, India",
      lastLoginAt: new Date("2024-10-15T14:30:00Z"),
      devices: [
        { name: "Windows (Chrome)", os: "Windows 11", browser: "Chrome 129", ip: "182.74.88.33", location: "Hyderabad, India" },
      ],
    },
    {
      fullName: "Neha Kapoor",
      email: "neha.kapoor@goexperts.com",
      phone: "+91 92778 89900",
      employeeCode: "EMP-TAS-008",
      deptCode: "TAS",
      desigCode: "DES-TAS-MOD",
      roleName: "Trust & Safety Moderator",
      accessLevel: "custom",
      officeLocation: "Noida, India",
      status: "active",
      employmentStatus: "active",
      joiningDate: new Date("2024-07-01T09:00:00Z"),
      lastLoginIp: "122.161.45.10",
      lastLoginLocation: "Noida, India",
      lastLoginAt: new Date("2024-10-14T17:10:00Z"),
      devices: [
        { name: "Windows (Chrome)", os: "Windows 11", browser: "Chrome 128", ip: "122.161.45.10", location: "Noida, India" },
      ],
    },
    {
      fullName: "Siddharth Rao",
      email: "siddharth.rao@goexperts.com",
      phone: "+91 91889 90011",
      employeeCode: "EMP-OPS-009",
      deptCode: "OPS",
      desigCode: "DES-OPS-MGR",
      roleName: "Operations Manager",
      accessLevel: "full_access",
      officeLocation: "Bengaluru, India",
      status: "active",
      employmentStatus: "active",
      joiningDate: new Date("2024-02-15T09:00:00Z"),
      lastLoginIp: "49.207.210.88",
      lastLoginLocation: "Bengaluru, India",
      lastLoginAt: new Date("2024-10-16T08:45:00Z"),
      devices: [
        { name: "MacBook (Safari)", os: "macOS 14", browser: "Safari 17", ip: "49.207.210.88", location: "Bengaluru, India" },
      ],
    },
    {
      fullName: "Meera Nair",
      email: "meera.nair@goexperts.com",
      phone: "+91 90990 01122",
      employeeCode: "EMP-LEG-010",
      deptCode: "LEG",
      desigCode: "DES-LEG-OFFICER",
      roleName: "Security Auditor",
      accessLevel: "view_only",
      officeLocation: "Kochi, India",
      status: "inactive",
      employmentStatus: "probation",
      joiningDate: new Date("2024-08-01T09:00:00Z"),
      lastLoginIp: "117.201.62.4",
      lastLoginLocation: "Kochi, India",
      lastLoginAt: new Date("2024-10-10T12:00:00Z"),
      devices: [],
    },
  ];

  for (const emp of staffEmployees) {
    const deptId = getDept(emp.deptCode);
    const desigId = getDesig(emp.desigCode);
    const roleId = getRole(emp.roleName) || roles[0]?.id;

    const user = await prisma.adminUser.upsert({
      where: { email: emp.email },
      update: {
        fullName: emp.fullName,
        phone: emp.phone,
        employeeCode: emp.employeeCode,
        departmentId: deptId,
        designationId: desigId,
        roleId: roleId!,
        accessLevel: emp.accessLevel,
        officeLocation: emp.officeLocation,
        status: emp.status,
        employmentStatus: emp.employmentStatus,
        joiningDate: emp.joiningDate,
        lastLoginAt: emp.lastLoginAt,
        lastLoginIp: emp.lastLoginIp,
        lastLoginLocation: emp.lastLoginLocation,
      },
      create: {
        fullName: emp.fullName,
        email: emp.email,
        password,
        phone: emp.phone,
        employeeCode: emp.employeeCode,
        departmentId: deptId,
        designationId: desigId,
        roleId: roleId!,
        accessLevel: emp.accessLevel,
        officeLocation: emp.officeLocation,
        status: emp.status,
        employmentStatus: emp.employmentStatus,
        joiningDate: emp.joiningDate,
        lastLoginAt: emp.lastLoginAt,
        lastLoginIp: emp.lastLoginIp,
        lastLoginLocation: emp.lastLoginLocation,
      },
    });

    // Seed devices and active sessions
    await prisma.adminSession.deleteMany({ where: { adminUserId: user.id } });
    for (const dev of emp.devices) {
      const sessionToken = `sess_${user.id.slice(0, 8)}_${Math.random().toString(36).substring(2, 12)}`;
      await prisma.adminSession.create({
        data: {
          adminUserId: user.id,
          sessionToken,
          deviceName: dev.name,
          browser: dev.browser,
          operatingSystem: dev.os,
          ipAddress: dev.ip,
          location: dev.location,
          country: "India",
          city: dev.location.split(",")[0]?.trim(),
          deviceCategory: dev.name.toLowerCase().includes("phone") || dev.name.toLowerCase().includes("android") ? "mobile" : "desktop",
          lastActivityAt: emp.lastLoginAt || new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          isRevoked: false,
        },
      });

      // Record Login Event
      await prisma.adminLoginEvent.create({
        data: {
          adminUserId: user.id,
          email: user.email,
          device: dev.name,
          browser: dev.browser,
          ipAddress: dev.ip,
          location: dev.location,
          status: "success",
          risk: "low",
          loginTime: emp.lastLoginAt || new Date(),
        },
      });
    }

    // Record Access Grant if superAdmin exists
    if (superAdmin) {
      await prisma.adminAccessGrant.create({
        data: {
          grantorId: superAdmin.id,
          staffId: user.id,
          roleId: roleId!,
          scope: emp.accessLevel === "full_access" ? "all" : "department",
          reason: `Initial departmental assignment to ${emp.fullName}`,
          status: "active",
        },
      });
    }

    // Seed Staff Activity Audit record
    await prisma.staffActivityAudit.create({
      data: {
        adminUserId: user.id,
        module: emp.deptCode,
        action: "login",
        resourceType: "auth",
        resourceId: user.id,
        details: `Employee authenticated successfully from ${emp.lastLoginLocation}`,
        ipAddress: emp.lastLoginIp,
        location: emp.lastLoginLocation,
        status: "success",
        createdAt: emp.lastLoginAt || new Date(),
      },
    });
  }

  console.log("✅ Seeded staff employees with real sessions, device records, and audit logs!");
}

if (process.argv[1]?.endsWith("seed-employees.ts")) {
  seedEmployees()
    .catch((e) => {
      console.error("❌ Employee Seed Failed:", e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
