import { prisma } from "../../config/database.js";

export interface KycCatalogDocument {
  id: string;
  key: string;
  name: string;
  category: "personal" | "business";
  description: string;
  acceptedFileTypes: string[];
  maxFileSizeMb: number;
  roles: string[];
  displayOrder: number;
  enabled: boolean;
  required: boolean;
  placeholder?: string;
  formatGuide?: string;
}

export interface KycRolePolicy {
  personalRequired: number;
  businessRequired: number;
  maxFileSizeMb: number;
  acceptedFormats: string[];
  guidelines: {
    formats: string;
    maxSize: string;
    clarity: string;
    governmentIssued: string;
    original: string;
  };
}

export const DEFAULT_KYC_CATALOG: KycCatalogDocument[] = [
  // ─── Personal Documents (5 in screenshot) ───
  {
    id: "doc_pan",
    key: "pan",
    name: "PAN Card",
    category: "personal",
    description: "Permanent Account Number issued by Income Tax Dept.",
    acceptedFileTypes: ["jpg", "jpeg", "png", "pdf"],
    maxFileSizeMb: 5,
    roles: ["freelancer", "client", "founder", "investor"],
    displayOrder: 1,
    enabled: true,
    required: true,
    placeholder: "e.g. ABCDE1234F",
    formatGuide: "10-character alphanumeric PAN format"
  },
  {
    id: "doc_aadhaar",
    key: "aadhaar",
    name: "Aadhaar Card",
    category: "personal",
    description: "12-digit unique identification number issued by UIDAI.",
    acceptedFileTypes: ["jpg", "jpeg", "png", "pdf"],
    maxFileSizeMb: 5,
    roles: ["freelancer", "client", "founder", "investor"],
    displayOrder: 2,
    enabled: true,
    required: true,
    placeholder: "e.g. 1234 5678 9012",
    formatGuide: "12-digit Aadhaar number"
  },
  {
    id: "doc_driving",
    key: "driving",
    name: "Driving Licence",
    category: "personal",
    description: "Valid driving licence issued by regional transport office.",
    acceptedFileTypes: ["jpg", "jpeg", "png", "pdf"],
    maxFileSizeMb: 5,
    roles: ["freelancer", "client", "founder", "investor"],
    displayOrder: 3,
    enabled: true,
    required: false,
    placeholder: "e.g. DL-1420110012345",
    formatGuide: "Valid Indian Driving Licence number"
  },
  {
    id: "doc_passport",
    key: "passport",
    name: "Passport",
    category: "personal",
    description: "Valid passport issued by Ministry of External Affairs.",
    acceptedFileTypes: ["jpg", "jpeg", "png", "pdf"],
    maxFileSizeMb: 5,
    roles: ["freelancer", "client", "founder", "investor"],
    displayOrder: 4,
    enabled: true,
    required: false,
    placeholder: "e.g. A1234567",
    formatGuide: "Valid Indian Passport number"
  },
  {
    id: "doc_voter",
    key: "voter",
    name: "Voter ID",
    category: "personal",
    description: "Election Commission of India voter identity card (EPIC).",
    acceptedFileTypes: ["jpg", "jpeg", "png", "pdf"],
    maxFileSizeMb: 5,
    roles: ["freelancer", "client", "founder", "investor"],
    displayOrder: 5,
    enabled: true,
    required: false,
    placeholder: "e.g. ABC1234567",
    formatGuide: "Voter ID / EPIC Card number"
  },

  // ─── Business Documents (8 in screenshot) ───
  {
    id: "doc_udyam",
    key: "udyam",
    name: "MSME Regd.",
    category: "business",
    description: "MSME / Udyam registration certificate & number.",
    acceptedFileTypes: ["jpg", "jpeg", "png", "pdf"],
    maxFileSizeMb: 5,
    roles: ["freelancer", "client", "founder", "investor"],
    displayOrder: 6,
    enabled: true,
    required: false,
    placeholder: "e.g. UDYAM-MH-18-0123456",
    formatGuide: "UDYAM registration number"
  },
  {
    id: "doc_startup_india",
    key: "startup_india",
    name: "Startup India",
    category: "business",
    description: "DPIIT Startup India recognition certificate & recognition number.",
    acceptedFileTypes: ["jpg", "jpeg", "png", "pdf"],
    maxFileSizeMb: 5,
    roles: ["freelancer", "client", "founder", "investor"],
    displayOrder: 7,
    enabled: true,
    required: false,
    placeholder: "e.g. DIPP12345",
    formatGuide: "DPIIT recognition number"
  },
  {
    id: "doc_iso_27001",
    key: "iso_27001",
    name: "ISO 27001",
    category: "business",
    description: "ISO/IEC 27001 Information Security Management System certification.",
    acceptedFileTypes: ["jpg", "jpeg", "png", "pdf"],
    maxFileSizeMb: 5,
    roles: ["freelancer", "client", "founder", "investor"],
    displayOrder: 8,
    enabled: true,
    required: false,
    placeholder: "e.g. ISO-27001-2022-9876",
    formatGuide: "Certificate identifier or registration number"
  },
  {
    id: "doc_soc2_type2",
    key: "soc2_type2",
    name: "SOC 2 Type II",
    category: "business",
    description: "SOC 2 Type II security & compliance audit report or certification.",
    acceptedFileTypes: ["jpg", "jpeg", "png", "pdf"],
    maxFileSizeMb: 5,
    roles: ["freelancer", "client", "founder", "investor"],
    displayOrder: 9,
    enabled: true,
    required: false,
    placeholder: "e.g. SOC2-TYP2-2024",
    formatGuide: "SOC 2 report reference or certificate ID"
  },
  {
    id: "doc_incorporation",
    key: "incorporation",
    name: "MCA Registered",
    category: "business",
    description: "Ministry of Corporate Affairs registration / CIN proof.",
    acceptedFileTypes: ["jpg", "jpeg", "png", "pdf"],
    maxFileSizeMb: 5,
    roles: ["freelancer", "client", "founder", "investor"],
    displayOrder: 10,
    enabled: true,
    required: false,
    placeholder: "e.g. U72200MH2021PTC123456",
    formatGuide: "21-digit Corporate Identification Number (CIN) or LLPIN"
  },
  {
    id: "doc_gst",
    key: "gst",
    name: "GST Certificate",
    category: "business",
    description: "Goods & Services Tax registration certificate (Form GST REG-06).",
    acceptedFileTypes: ["jpg", "jpeg", "png", "pdf"],
    maxFileSizeMb: 5,
    roles: ["freelancer", "client", "founder", "investor"],
    displayOrder: 11,
    enabled: true,
    required: false,
    placeholder: "e.g. 22AAAAA0000A1Z5",
    formatGuide: "15-character GSTIN number"
  },
  {
    id: "doc_business_pan",
    key: "business_pan",
    name: "Business PAN",
    category: "business",
    description: "Permanent Account Number of the corporate entity / firm / LLP.",
    acceptedFileTypes: ["jpg", "jpeg", "png", "pdf"],
    maxFileSizeMb: 5,
    roles: ["freelancer", "client", "founder", "investor"],
    displayOrder: 12,
    enabled: true,
    required: false,
    placeholder: "e.g. AABCC1234F",
    formatGuide: "10-character Entity PAN format"
  },
  {
    id: "doc_company_incorporation",
    key: "company_incorporation",
    name: "Company Incorporation",
    category: "business",
    description: "Certificate of Incorporation issued by Registrar of Companies.",
    acceptedFileTypes: ["jpg", "jpeg", "png", "pdf"],
    maxFileSizeMb: 5,
    roles: ["freelancer", "client", "founder", "investor"],
    displayOrder: 13,
    enabled: true,
    required: false,
    placeholder: "e.g. ROC-DEL-2021-9988",
    formatGuide: "Certificate of Incorporation Registration Number"
  }
];

export const DEFAULT_ROLE_POLICIES: Record<string, KycRolePolicy> = {
  freelancer: {
    personalRequired: 2,
    businessRequired: 0,
    maxFileSizeMb: 5,
    acceptedFormats: ["JPG", "JPEG", "PNG", "PDF"],
    guidelines: {
      formats: "Accepted formats: JPG, PNG, PDF",
      maxSize: "Maximum file size: 5 MB per document",
      clarity: "Document must be clear, well-lit and valid",
      governmentIssued: "Only original government-issued documents are accepted",
      original: "Do not upload blurred, cropped or edited documents"
    }
  },
  client: {
    personalRequired: 2,
    businessRequired: 2,
    maxFileSizeMb: 5,
    acceptedFormats: ["JPG", "JPEG", "PNG", "PDF"],
    guidelines: {
      formats: "Accepted formats: JPG, PNG, PDF",
      maxSize: "Maximum file size: 5 MB per document",
      clarity: "Document must be clear, well-lit and valid",
      governmentIssued: "Only original government-issued documents are accepted",
      original: "Do not upload blurred, cropped or edited documents"
    }
  },
  founder: {
    personalRequired: 2,
    businessRequired: 2,
    maxFileSizeMb: 5,
    acceptedFormats: ["JPG", "JPEG", "PNG", "PDF"],
    guidelines: {
      formats: "Accepted formats: JPG, PNG, PDF",
      maxSize: "Maximum file size: 5 MB per document",
      clarity: "Document must be clear, well-lit and valid",
      governmentIssued: "Only original government-issued documents are accepted",
      original: "Do not upload blurred, cropped or edited documents"
    }
  },
  investor: {
    personalRequired: 2,
    businessRequired: 2,
    maxFileSizeMb: 5,
    acceptedFormats: ["JPG", "JPEG", "PNG", "PDF"],
    guidelines: {
      formats: "Accepted formats: JPG, PNG, PDF",
      maxSize: "Maximum file size: 5 MB per document",
      clarity: "Document must be clear, well-lit and valid",
      governmentIssued: "Only original government-issued documents are accepted",
      original: "Do not upload blurred, cropped or edited documents"
    }
  }
};

/**
 * Returns the database-stored document catalog, seeding into the Setting table if not yet present.
 */
export async function getKycCatalogFromDb(role?: string): Promise<KycCatalogDocument[]> {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: "kyc_document_catalog" }
    });

    let catalog = DEFAULT_KYC_CATALOG;
    if (setting?.value) {
      try {
        const parsed = JSON.parse(setting.value);
        if (Array.isArray(parsed) && parsed.length > 0) {
          catalog = parsed;
        }
      } catch {
        // fallback to default
      }
    } else {
      // Seed initial catalog into Setting table asynchronously
      prisma.setting.create({
        data: {
          key: "kyc_document_catalog",
          value: JSON.stringify(DEFAULT_KYC_CATALOG),
          category: "kyc"
        }
      }).catch(() => null);
    }

    const normalizedRole = (role || "").toLowerCase().trim();
    if (!normalizedRole) return catalog.filter(d => d.enabled);

    return catalog
      .filter(d => d.enabled && (d.roles.includes(normalizedRole) || d.roles.includes("all")))
      .sort((a, b) => a.displayOrder - b.displayOrder);
  } catch {
    return DEFAULT_KYC_CATALOG;
  }
}

/**
 * Returns role-specific KYC policy from the database or defaults.
 */
export async function getKycPolicyFromDb(role: string): Promise<KycRolePolicy & { bannerMessage: string }> {
  const normalizedRole = (role || "freelancer").toLowerCase().trim();
  let basePolicy = DEFAULT_ROLE_POLICIES[normalizedRole] || DEFAULT_ROLE_POLICIES.freelancer;

  try {
    const setting = await prisma.setting.findUnique({
      where: { key: "kyc_verification_policy" }
    });

    if (setting?.value) {
      const parsed = JSON.parse(setting.value);
      if (parsed[normalizedRole]) {
        basePolicy = { ...basePolicy, ...parsed[normalizedRole] };
      }
    } else {
      prisma.setting.create({
        data: {
          key: "kyc_verification_policy",
          value: JSON.stringify(DEFAULT_ROLE_POLICIES),
          category: "kyc"
        }
      }).catch(() => null);
    }
  } catch {
    // fallback to in-memory default
  }

  // Construct context-accurate banner copy
  let bannerMessage = `Please upload at least ${basePolicy.personalRequired} personal documents to complete your verification.`;
  if (basePolicy.businessRequired > 0) {
    bannerMessage = `Please upload at least ${basePolicy.personalRequired} personal documents and ${basePolicy.businessRequired} business documents to complete your verification.`;
  }

  return {
    ...basePolicy,
    bannerMessage
  };
}
