import { describe, it, expect } from "vitest";
import { getVerificationStats, VERIFICATION_KEY_MAP, } from "../../common/helpers/verification.js";
import { DEFAULT_KYC_CATALOG, } from "../../services/kyc/kyc-catalog.service.js";
describe("KYC Verification Helper & Catalog Tests", () => {
    it("should contain all reference screenshot document keys in canonical map", () => {
        // Personal documents
        expect(VERIFICATION_KEY_MAP.pan).toBe("PAN Card");
        expect(VERIFICATION_KEY_MAP.aadhaar).toBe("Aadhaar Card");
        expect(VERIFICATION_KEY_MAP.driving).toBe("Driving Licence");
        expect(VERIFICATION_KEY_MAP.passport).toBe("Passport");
        expect(VERIFICATION_KEY_MAP.voter).toBe("Voter ID");
        // Business documents
        expect(VERIFICATION_KEY_MAP.udyam).toBe("MSME Regd.");
        expect(VERIFICATION_KEY_MAP.startup_india).toBe("Startup India");
        expect(VERIFICATION_KEY_MAP.iso_27001).toBe("ISO 27001");
        expect(VERIFICATION_KEY_MAP.soc2_type2).toBe("SOC 2 Type II");
        expect(VERIFICATION_KEY_MAP.incorporation).toBe("MCA Registered");
        expect(VERIFICATION_KEY_MAP.gst).toBe("GST Certificate");
        expect(VERIFICATION_KEY_MAP.business_pan).toBe("Business PAN");
        expect(VERIFICATION_KEY_MAP.company_incorporation).toBe("Company Incorporation");
    });
    it("should calculate correct verification progression and percentage", () => {
        const mockUser = {
            id: "test-user-1",
            fullName: "Vinod",
            email: "vinod@example.com",
            role: "freelancer",
            freelancerProfile: {
                verificationJson: JSON.stringify({
                    pan: { key: "pan", label: "PAN Card", value: "ABCDE1234F", status: "verified", documentUrl: "https://example.com/pan.pdf" },
                    aadhaar: { key: "aadhaar", label: "Aadhaar Card", value: "123456789012", status: "verified", documentUrl: "https://example.com/aadhaar.pdf" },
                    udyam: { key: "udyam", label: "MSME Regd.", value: "UDYAM-MH-18-0123456", status: "pending", documentUrl: "https://example.com/msme.pdf" },
                    startup_india: { key: "startup_india", label: "Startup India", value: "DIPP12345", status: "verified", documentUrl: "https://example.com/startup.pdf" },
                })
            }
        };
        const stats = getVerificationStats(mockUser);
        expect(stats.personalSubmitted).toBe(2);
        expect(stats.businessSubmitted).toBe(2);
        expect(stats.personalVerified).toBe(2);
        expect(stats.businessVerified).toBe(1);
        expect(stats.personalRequired).toBe(2);
        expect(stats.currentStep).toBe(4); // Fully approved because freelancer only requires 2 personal docs and both are verified
    });
    it("should return exactly 0% completion and step 1 when no documents are uploaded", () => {
        const emptyUser = {
            id: "test-user-empty",
            fullName: "New User",
            email: "new@example.com",
            role: "client",
            clientProfile: {
                verificationJson: JSON.stringify({})
            }
        };
        const stats = getVerificationStats(emptyUser);
        expect(stats.personalSubmitted).toBe(0);
        expect(stats.businessSubmitted).toBe(0);
        expect(stats.completionPercentage).toBe(0);
        expect(stats.currentStep).toBe(1);
        expect(stats.completedProgressSlots).toBe(0);
        expect(stats.totalProgressSlots).toBe(4); // 2 personal + 2 business
    });
    it("should have matching catalog default counts", () => {
        const personal = DEFAULT_KYC_CATALOG.filter(d => d.category === "personal");
        const business = DEFAULT_KYC_CATALOG.filter(d => d.category === "business");
        expect(personal.length).toBe(5);
        expect(business.length).toBe(8);
    });
});
