import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Eye,
  PenTool,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  Users,
  Building2,
  MapPin,
  Globe,
  ExternalLink,
  ShieldCheck,
  TrendingUp,
  IndianRupee,
  ArrowRight,
  Sparkles,
  ClipboardCheck,
  ChevronRight,
  Download,
} from "lucide-react";
import { UnifiedShell } from "@/components/shared/UnifiedShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FndSkeleton, FndPill } from "@/components/founder/FounderShell";
import { api, getResponseData, getResponseRows } from "@/lib/api-client";
import { createStartupSlug } from "@/lib/startup-catalog-helpers";
import { resolveUploadUrl } from "@/lib/freelancer-upload";

interface StartupWorkspaceRecord {
  id?: string;
  startup?: string;
  startupName?: string;
  name?: string;
  industry?: string;
  industryId?: string;
  category?: string;
  categoryId?: string;
  stage?: string;
  stageId?: string;
  city?: string;
  country?: string;
  countryId?: string;
  website?: string;
  oneLinePitch?: string;
  pitch?: string;
  description?: string;
  problemStatement?: string;
  problem?: string;
  solution?: string;
  businessModel?: string;
  funding?: number | string;
  targetRaise?: number | string;
  target_raise?: number | string;
  amountRaising?: number | string;
  amount_raising?: number | string;
  equity?: number | string;
  equityOffered?: number | string;
  equity_offered?: number | string;
  visibility?: string;
  status?: string;
  logo?: string;
  logoUrl?: string;
  coverUrl?: string;
  pitchDeck?: string;
  businessPlan?: string;
}

interface PitchDeckRecord {
  url?: string;
  updatedAt?: string;
}

interface BusinessPlanRecord {
  documentUrl?: string;
  summary?: string;
  businessName?: string;
}

interface TeamMemberRecord {
  id: string;
  name: string;
  role?: string;
}

interface InvestorRequestRecord {
  id: string;
  investor?: string;
  offer?: number | string;
  equity?: number | string;
  status?: string;
}

export const Route = createFileRoute("/founder/startup/")({
  head: () => ({ meta: [{ title: "Your Startup — Founder Workspace" }] }),
  component: StartupWorkspacePage,
});

export function StartupWorkspacePage() {
  const [startup, setStartup] = useState<StartupWorkspaceRecord | null>(null);
  const [pitchDeck, setPitchDeck] = useState<PitchDeckRecord | null>(null);
  const [businessPlan, setBusinessPlan] = useState<BusinessPlanRecord | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMemberRecord[]>([]);
  const [investorRequests, setInvestorRequests] = useState<InvestorRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);

    async function loadWorkspaceData() {
      try {
        const [startupRes, deckRes, planRes, teamRes, reqRes, profileRes, authRes] = await Promise.all([
          api.fetch("/founder/startup", { silent: true }).catch(() => null),
          api.fetch("/founder/pitch-deck", { silent: true }).catch(() => null),
          api.fetch("/founder/business-plan", { silent: true }).catch(() => null),
          api.fetch("/founder/team", { silent: true }).catch(() => null),
          api.fetch("/founder/investor-requests", { silent: true }).catch(() => null),
          api.fetch("/founder/profile", { silent: true }).catch(() => null),
          api.fetch("/auth/me", { silent: true }).catch(() => null),
        ]);

        if (!active) return;

        const sData = getResponseData(startupRes, startupRes);
        const startupObj =
          (Array.isArray(sData?.data) ? sData.data[0] : null) ??
          (Array.isArray(sData?.ideas) ? sData.ideas[0] : null) ??
          (Array.isArray(sData) ? sData[0] : null) ??
          sData?.data ??
          sData?.startup ??
          sData ??
          null;

        const pDataRaw = getResponseData(profileRes, profileRes);
        const authPayload = getResponseData(authRes, authRes);
        const authUser = authPayload?.user ?? (authPayload?.role ? authPayload : {});

        const profUser = pDataRaw?.user ?? authUser ?? (pDataRaw?.role ? pDataRaw : {});
        const profProfile = pDataRaw?.profile ?? profUser?.profile ?? profUser?.founderProfile ?? authUser?.founderProfile ?? pDataRaw ?? {};
        const regData = profUser?.registrationData ?? profProfile?.registrationData ?? {};

        const rawLogo =
          startupObj?.logo ||
          startupObj?.logoUrl ||
          startupObj?.startupLogo ||
          profProfile?.companyLogo ||
          profProfile?.logo ||
          profUser?.avatarUrl ||
          authUser?.avatarUrl ||
          "";

        const rawCover =
          startupObj?.coverUrl ||
          startupObj?.cover ||
          startupObj?.bannerUrl ||
          startupObj?.banner ||
          profProfile?.startupCoverUrl ||
          profProfile?.coverUrl ||
          profProfile?.cover ||
          profProfile?.bannerUrl ||
          profUser?.coverImageUrl ||
          profUser?.coverUrl ||
          profUser?.bannerUrl ||
          authUser?.coverImageUrl ||
          authUser?.coverUrl ||
          authUser?.founderProfile?.coverUrl ||
          authUser?.founderProfile?.coverImageUrl ||
          "";

        const mergedStartup: StartupWorkspaceRecord = {
          ...profProfile,
          ...startupObj,
          ...startupObj,
          startupName:
            startupObj?.startupName ||
            startupObj?.startup ||
            startupObj?.name ||
            profProfile?.startupName ||
            profUser?.startupName ||
            regData?.startupName,
          startup:
            startupObj?.startup ||
            startupObj?.startupName ||
            startupObj?.name ||
            profProfile?.startupName ||
            profUser?.startupName ||
            regData?.startupName,
          pitch:
            startupObj?.pitch ||
            startupObj?.oneLinePitch ||
            startupObj?.description ||
            profProfile?.pitch ||
            profUser?.pitch ||
            regData?.pitch,
          oneLinePitch:
            startupObj?.oneLinePitch ||
            startupObj?.pitch ||
            startupObj?.description ||
            profProfile?.pitch ||
            profUser?.pitch ||
            regData?.pitch,
          stage:
            startupObj?.stage ||
            startupObj?.stageName ||
            profProfile?.stage ||
            profUser?.stage ||
            regData?.stage,
          industry:
            startupObj?.industry ||
            startupObj?.industryName ||
            profProfile?.industry ||
            profUser?.industry ||
            regData?.industry,
          funding:
            startupObj?.funding ||
            startupObj?.targetRaise ||
            startupObj?.amountRaising ||
            startupObj?.target_raise ||
            startupObj?.amount_raising ||
            profProfile?.targetRaise ||
            profProfile?.target_raise ||
            profUser?.targetRaise ||
            regData?.targetRaise,
          targetRaise:
            startupObj?.targetRaise ||
            startupObj?.funding ||
            startupObj?.amountRaising ||
            startupObj?.target_raise ||
            startupObj?.amount_raising ||
            profProfile?.targetRaise ||
            profProfile?.target_raise ||
            profUser?.targetRaise ||
            regData?.targetRaise,
          equity:
            startupObj?.equity ??
            startupObj?.equityOffered ??
            startupObj?.equity_offered ??
            profProfile?.equity ??
            profProfile?.equityOffered ??
            profProfile?.equity_offered ??
            profUser?.equity ??
            regData?.equity,
          equityOffered:
            startupObj?.equityOffered ??
            startupObj?.equity_offered ??
            startupObj?.equity ??
            profProfile?.equityOffered ??
            profProfile?.equity_offered ??
            profProfile?.equity ??
            profUser?.equity ??
            regData?.equity,
          logo: rawLogo ? resolveUploadUrl(rawLogo) : undefined,
          pitchDeck: startupObj?.pitchDeck || profProfile?.pitchDeck,
          businessPlan: startupObj?.businessPlan || profProfile?.businessPlan,
          coverUrl: rawCover ? resolveUploadUrl(rawCover) : undefined,
          raised: startupObj?.raised ?? profProfile?.raised ?? profUser?.raised ?? regData?.raised ?? 0,
        };

        setStartup(mergedStartup);

        const dData = getResponseData(deckRes, deckRes);
        setPitchDeck(dData?.data ?? dData ?? null);

        const pData = getResponseData(planRes, planRes);
        setBusinessPlan(pData?.data ?? pData ?? null);

        setTeamMembers(getResponseRows(teamRes));
        setInvestorRequests(getResponseRows(reqRes));
      } finally {
        if (active) setLoading(false);
      }
    }

    loadWorkspaceData();
    return () => {
      active = false;
    };
  }, []);

  const startupName = startup?.startup || startup?.startupName || startup?.name || "";
  const stage = (typeof startup?.stage === "object" ? (startup?.stage as any)?.name : startup?.stage) || startup?.stageId || "";
  const industry = (typeof startup?.industry === "object" ? (startup?.industry as any)?.name : startup?.industry) || startup?.industryId || "";
  const category = (typeof startup?.category === "object" ? (startup?.category as any)?.name : startup?.category) || startup?.categoryId || "";
  const oneLinePitch = startup?.oneLinePitch || startup?.pitch || startup?.description || "";
  const problem = startup?.problemStatement || startup?.problem || "";
  const solution = startup?.solution || "";
  const businessModel = startup?.businessModel || "";
  const location = [startup?.city, startup?.country || startup?.countryId]
    .filter(Boolean)
    .join(", ");
  const website = startup?.website || "";
  const logo = startup?.logo || startup?.logoUrl || "";

  // Real numeric values in ₹ INR (cleanly extract numeric digits from numbers or formatted strings)
  const parseNumeric = (val: unknown): number => {
    if (typeof val === "number") return isFinite(val) ? val : 0;
    if (typeof val === "string") {
      const cleaned = val.replace(/[^0-9.]/g, "");
      const parsed = parseFloat(cleaned);
      return isFinite(parsed) ? parsed : 0;
    }
    return 0;
  };

  const rawFundingVal =
    startup?.funding ??
    startup?.targetRaise ??
    startup?.amountRaising ??
    startup?.target_raise ??
    startup?.amount_raising;

  const rawEquityVal =
    startup?.equity ??
    startup?.equityOffered ??
    startup?.equity_offered;

  const fundingNum = parseNumeric(rawFundingVal);
  const equityNum = parseNumeric(rawEquityVal);

  // Status mapping
  const rawStatus = String(startup?.status || "active").toLowerCase();
  const isPublished = rawStatus === "active" || rawStatus === "published";
  const isUnderReview = rawStatus === "pending" || rawStatus === "under_review";
  const statusLabel = isPublished ? "Published Listing" : isUnderReview ? "Under Review" : "Draft";
  const visibility = startup?.visibility || "Public";

  // Pitch Deck URL
  const pitchDeckUrl = startup?.pitchDeck || pitchDeck?.url || "";
  const hasPitchDeck = Boolean(pitchDeckUrl);

  // Business Plan URL / content
  const businessPlanDocUrl = startup?.businessPlan || businessPlan?.documentUrl || "";
  const hasBusinessPlan = Boolean(
    businessPlanDocUrl ||
    businessPlan?.summary ||
    businessPlan?.businessName,
  );

  // Canonical slug for public preview
  const previewSlug = createStartupSlug(startupName, startup?.id);

  const handleDownloadDocument = async (url: string | null | undefined, fileName: string, docLabel: string) => {
    if (!url) return;
    try {
      const response = await fetch(url, { method: "GET" });
      if (!response.ok) throw new Error("Network response was not ok");
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Listing completeness checks based strictly on the required fields
  const checklist: Array<{
    label: string;
    complete: boolean;
    section?: string;
  }> = [
      {
        label: "Startup Name",
        complete: Boolean(startupName),
        section: "overview",
      },
      {
        label: "Industry & Stage",
        complete: Boolean(industry && stage),
        section: "overview",
      },
      {
        label: "Funding Ask (₹ INR)",
        complete: Boolean(fundingNum > 0),
        section: "funding",
      },
      {
        label: "Equity (%)",
        complete: Boolean(equityNum > 0),
        section: "funding",
      },
      {
        label: "Upload Logo & Cover Banner",
        complete: Boolean(logo && startup?.coverUrl),
        section: "media",
      },
      {
        label: "Upload Pitch Deck",
        complete: hasPitchDeck,
        section: "documents",
      },
      {
        label: "Upload Business Plan",
        complete: hasBusinessPlan,
        section: "documents",
      },
    ];
  const completedCount = checklist.filter((c) => c.complete).length;
  const readinessPercent = Math.round((completedCount / checklist.length) * 100);

  if (loading) {
    return (
      <UnifiedShell
        pathname="/founder/startup"
        title="Your Startup"
        breadcrumbs={[
          { label: "Founder OS", href: "/founder/dashboard" },
          { label: "Your Startup" },
        ]}
      >
        <FndSkeleton rows={6} />
      </UnifiedShell>
    );
  }

  return (
    <UnifiedShell
      pathname="/founder/startup"
      title="Your Startup"
      breadcrumbs={[{ label: "Founder OS", href: "/founder/dashboard" }, { label: "Your Startup" }]}
    >
      {/* Professional Workspace Header */}
      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          {logo ? (
            <img
              src={resolveUploadUrl(logo)}
              alt={startupName || "Startup"}
              className="h-16 w-16 shrink-0 rounded-2xl border border-border object-cover shadow-xs"
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.dataset.tried && logo) {
                  target.dataset.tried = "true";
                  target.src = logo;
                }
              }}
            />
          ) : (
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary font-bold text-2xl border border-primary/20 shadow-xs">
              {(startupName || "S").charAt(0).toUpperCase()}
            </div>
          )}

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {startupName || "Startup Details"}
              </h1>
              <Badge
                variant="outline"
                className={`text-xs font-semibold px-2.5 py-0.5 ${isPublished
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : isUnderReview
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    : "border-muted-foreground/30 bg-muted text-muted-foreground"
                  }`}
              >
                {statusLabel}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {visibility}
              </Badge>
            </div>

            {[industry, stage, location].filter(Boolean).length > 0 && (
              <p className="text-xs text-muted-foreground">
                {[industry, stage, location].filter(Boolean).join(" · ")}
              </p>
            )}

            <p className="text-sm text-muted-foreground max-w-xl line-clamp-2">
              {oneLinePitch ||
                "No one-line pitch provided yet. Add a concise summary to catch investors' attention."}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-center">
          <Button variant="outline" asChild className="gap-1.5">
            <Link to="/founder/startup/edit">
              <PenTool className="h-4 w-4" /> Edit Startup
            </Link>
          </Button>

          {previewSlug && (
            <Button variant="outline" asChild className="gap-1.5 shadow-xs">
              <Link to="/startups/$startupSlug" params={{ startupSlug: previewSlug }}>
                <Eye className="h-4 w-4" /> Preview View
              </Link>
            </Button>
          )}

        </div>
      </div>

      {/* Main Grid: Left side details, Right side investor readiness */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column (2 spans) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Target Raise & Terms */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">Funding Requirements</h2>
                <p className="text-xs text-muted-foreground">
                  Target capital and equity terms visible to accredited investors
                </p>
              </div>
              <Button variant="ghost" size="sm" asChild className="text-xs gap-1">
                <Link to="/founder/startup/edit" search={{ section: "funding" }}>
                  Edit Terms <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                  Target Raise
                </span>
                <p className="text-2xl font-bold text-foreground">
                  {fundingNum > 0 ? `₹${fundingNum.toLocaleString("en-IN")}` : "Not specified"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Directly listed in marketplace search
                </p>
              </div>

              <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                  Equity Offered
                </span>
                <p className="text-2xl font-bold text-foreground">
                  {equityNum > 0 ? `${equityNum}%` : "Not specified"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Proposed allocation for round
                </p>
              </div>

              <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                  Round Status
                </span>
                <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {isPublished ? "Open for Interest" : "Draft Listing"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Governed by listing visibility
                </p>
              </div>
            </div>
          </Card>

          {/* Core Pitch & Value Proposition */}

          {/* Documents & Assets Hub */}
          <Card className="p-6">
            <h2 className="text-base font-semibold text-foreground mb-1">
              Investor Materials & Due Diligence
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Pitch materials accessible to verified investors
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-xl border border-border/70 p-4 bg-card">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-sky-500/10 text-sky-600">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Pitch Deck</p>
                    <p className="text-xs text-muted-foreground">
                      {hasPitchDeck ? "Deck linked & active" : "No pitch deck uploaded"}
                    </p>
                  </div>
                </div>
                {hasPitchDeck ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handleDownloadDocument(
                        pitchDeckUrl,
                        `${startupName.replace(/[^a-zA-Z0-9]+/g, "_") || "Startup"}_Pitch_Deck.pdf`,
                        "Pitch Deck"
                      )
                    }
                    className="text-xs gap-1 cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" /> Download
                  </Button>
                ) : (
                  <Button variant="default" size="sm" asChild className="text-xs gap-1">
                    <Link to="/founder/startup/edit" search={{ section: "documents" }}>Upload Deck</Link>
                  </Button>
                )}
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border/70 p-4 bg-card">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-indigo-500/10 text-indigo-600">
                    <ClipboardCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Business Plan</p>
                    <p className="text-xs text-muted-foreground">
                      {hasBusinessPlan ? "Plan document linked" : "No plan uploaded"}
                    </p>
                  </div>
                </div>
                {hasBusinessPlan && businessPlanDocUrl ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handleDownloadDocument(
                        businessPlanDocUrl,
                        `${startupName.replace(/[^a-zA-Z0-9]+/g, "_") || "Startup"}_Business_Plan.pdf`,
                        "Business Plan"
                      )
                    }
                    className="text-xs gap-1 cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" /> Download
                  </Button>
                ) : (
                  <Button variant="default" size="sm" asChild className="text-xs gap-1">
                    <Link to="/founder/startup/edit" search={{ section: "documents" }}>Add Plan</Link>
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Listing Readiness & Investor Activity */}
        <div className="space-y-6">
          {/* Investor Listing Readiness */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-foreground">Listing Readiness</h2>
              <span className="text-xs font-bold text-primary">{readinessPercent}% Complete</span>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-muted mb-4">
              <div
                className="h-full bg-primary transition-all duration-300 rounded-full"
                style={{ width: `${readinessPercent}%` }}
              />
            </div>

            <div className="space-y-3">
              {checklist.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    {item.complete ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                    )}
                    <span
                      className={
                        item.complete ? "text-foreground font-medium" : "text-muted-foreground"
                      }
                    >
                      {item.label}
                    </span>
                  </div>

                  {!item.complete && item.section && (
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      className="h-6 px-2 text-[11px] text-primary"
                    >
                      <Link to="/founder/startup/edit" search={{ section: item.section }}>
                        Add
                      </Link>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Real Investor Activity */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-foreground">Investor Inquiries</h2>
              <Badge variant="outline" className="text-xs font-semibold">
                {investorRequests.length} Received
              </Badge>
            </div>

            {investorRequests.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/80 p-5 text-center">
                <Users className="mx-auto h-7 w-7 text-muted-foreground/60 mb-2" />
                <p className="text-xs font-medium text-foreground">No investor proposals yet</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Proposals from accredited investors expressing interest will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {investorRequests.slice(0, 3).map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-lg border border-border p-3 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-foreground">{r.investor || "Investor"}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Offer: ₹{Number(r.offer ?? 0).toLocaleString("en-IN")} · {r.equity ?? 0}%
                        equity
                      </p>
                    </div>
                    <FndPill status={r.status || "Pending"} />
                  </div>
                ))}

                <Button variant="outline" size="sm" asChild className="w-full text-xs gap-1 mt-2">
                  <Link to="/founder/investor-requests">
                    View All {investorRequests.length} Requests{" "}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            )}
          </Card>

          {/* Quick Team Card */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-foreground">
                Team ({teamMembers.length})
              </h2>
              <Button variant="ghost" size="sm" asChild className="text-xs gap-1">
                <Link to="/founder/team">
                  Manage <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>

            {teamMembers.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No additional team members listed. Add co-founders and key leaders in the Team
                section.
              </p>
            ) : (
              <div className="space-y-2">
                {teamMembers.slice(0, 3).map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-xs py-1">
                    <span className="font-medium text-foreground">{m.name}</span>
                    <span className="text-muted-foreground">{m.role || "Team"}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </UnifiedShell>
  );
}
