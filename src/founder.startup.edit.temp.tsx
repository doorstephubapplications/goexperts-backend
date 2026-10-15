import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Save,
  ArrowLeft,
  UploadCloud,
  Building2,
  FileText,
  Eye,
  Sparkles,
  IndianRupee,
  FileCheck,
} from "lucide-react";
import { UnifiedShell } from "@/components/shared/UnifiedShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FndSkeleton } from "@/components/founder/FounderShell";
import { ActionGateModal } from "@/components/ui/ActionGateModal";
import { api, getResponseData, getResponseRows, getApiErrorMessage } from "@/lib/api-client";
import { toast } from "sonner";
import { createStartupSlug } from "@/lib/startup-catalog-helpers";
import { resolveUploadUrl, uploadFreelancerMedia, pickFile } from "@/lib/freelancer-upload";
import { DocumentPreviewModal } from "@/components/shared/DocumentPreviewModal";

export const Route = createFileRoute("/founder/startup/edit")({
  validateSearch: (search: Record<string, unknown>) => ({
    section: typeof search.section === "string" ? search.section : "overview",
    mode: typeof search.mode === "string" ? search.mode : undefined,
  }),
  head: () => ({ meta: [{ title: "Edit Startup — Founder Workspace" }] }),
  component: EditStartupPage,
});

export function EditStartupPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const activeSection = search.section || "overview";
  const isCreateMode = search.mode === "create";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [coverUrl, setCoverUrl] = useState<string>("");
  const [pitchDeckUrl, setPitchDeckUrl] = useState<string>("");
  const [businessPlanUrl, setBusinessPlanUrl] = useState<string>("");

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingPitchDeck, setUploadingPitchDeck] = useState(false);
  const [uploadingBusinessPlan, setUploadingBusinessPlan] = useState(false);

  // Document preview modal state
  const [previewDoc, setPreviewDoc] = useState<{ url: string; title: string; docType: "pitch-deck" | "business-plan" } | null>(null);

  // Master Data
  const [industries, setIndustries] = useState<Array<{ id: string; name: string; value?: string }>>([]);
  const [stages, setStages] = useState<Array<{ id: string; name: string; value?: string }>>([]);

  // Form State strictly mapping to the requested Startup fields
  const [form, setForm] = useState({
    startup: "",
    industry: "",
    category: "",
    stage: "",
    funding: "",
    equity: "",
  });

  const [startupId, setStartupId] = useState<string>("");
  const [gateOpen, setGateOpen] = useState(false);
  const [gateCapability, setGateCapability] = useState<any>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);

    async function loadData() {
      try {
        const [startupRes, profileRes, authRes, indRes, stageRes, deckRes, planRes] = await Promise.all([
          api.fetch("/founder/startup", { silent: true }).catch(() => null),
          api.fetch("/founder/profile", { silent: true }).catch(() => null),
          api.fetch("/auth/me", { silent: true }).catch(() => null),
          api.fetch("/public/industries", { silent: true }).catch(() => null),
          api.fetch("/public/startup-stages", { silent: true }).catch(() => null),
          api.fetch("/founder/pitch-deck", { silent: true }).catch(() => null),
          api.fetch("/founder/business-plan", { silent: true }).catch(() => null),
        ]);

        if (!active) return;

        // Master Taxonomies (Dynamic from DB without hardcoded fallbacks)
        const indRows = getResponseRows(indRes);
        if (indRows.length > 0) {
          setIndustries(
            indRows.map((r: { id?: string; name?: string; label?: string; value?: string }) => {
              const displayName = r.label || r.name || r.value || r.id || "";
              const val = r.value || r.name || r.label || r.id || "";
              return {
                id: r.id || val,
                name: displayName,
                value: val,
              };
            }),
          );
        }

        const stageRows = getResponseRows(stageRes);
        if (stageRows.length > 0) {
          setStages(
            stageRows.map((r: { id?: string; name?: string; label?: string; value?: string }) => {
              const displayLabel = r.label || r.name || r.value || r.id || "";
              const val = r.value || r.label || r.name || r.id || "";
              return {
                id: r.id || val,
                name: displayLabel,
                value: val,
              };
            }),
          );
        }

        // Startup Data dynamically from DB
        const sPayload = getResponseData(startupRes, startupRes);
        const s = (Array.isArray(sPayload?.data) ? sPayload.data[0] : null) ??
          (Array.isArray(sPayload?.ideas) ? sPayload.ideas[0] : null) ??
          (Array.isArray(sPayload) ? sPayload[0] : null) ??
          sPayload?.data ??
          sPayload?.startup ??
          sPayload ??
          {};

        const pDataRaw = getResponseData(profileRes, profileRes);
        const authPayload = getResponseData(authRes, authRes);
        const authUser = authPayload?.user ?? (authPayload?.role ? authPayload : {});

        const profUser = pDataRaw?.user ?? authUser ?? (pDataRaw?.role ? pDataRaw : {});
        const profProfile = pDataRaw?.profile ?? profUser?.profile ?? profUser?.founderProfile ?? authUser?.founderProfile ?? pDataRaw ?? {};
        const regData = profUser?.registrationData ?? profProfile?.registrationData ?? {};

        const dData = getResponseData(deckRes, deckRes);
        const pData = getResponseData(planRes, planRes);

        const currentPitchDeck = s?.pitchDeck || dData?.url || dData?.data?.url || profProfile?.pitchDeck || "";
        const currentBusinessPlan = s?.businessPlan || pData?.documentUrl || pData?.data?.documentUrl || profProfile?.businessPlan || "";

        if (s?.id) setStartupId(s.id);
        
        // Resolve startup logo and coverUrl from DB payloads
        const rawStartupLogo =
          s?.logo ||
          s?.logoUrl ||
          s?.startupLogo ||
          profProfile?.companyLogo ||
          profProfile?.logo ||
          profUser?.avatarUrl ||
          authUser?.avatarUrl ||
          "";

        const rawStartupCover =
          s?.coverUrl ||
          s?.cover ||
          s?.bannerUrl ||
          s?.banner ||
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

        if (rawStartupLogo) setLogoUrl(rawStartupLogo);
        if (rawStartupCover) setCoverUrl(rawStartupCover);
        if (currentPitchDeck) setPitchDeckUrl(currentPitchDeck);
        if (currentBusinessPlan) setBusinessPlanUrl(currentBusinessPlan);

        // Map values registered during founder registration:
        // startupName, industry, stage, targetRaise (funding ask), equity
        const resolvedStartupName =
          s.startup ||
          s.startupName ||
          s.name ||
          profProfile?.startupName ||
          profUser?.startupName ||
          regData?.startupName ||
          "";

        const resolvedIndustry =
          s.industry ||
          s.industryId ||
          profProfile?.industry ||
          profUser?.industry ||
          regData?.industry ||
          "";

        const resolvedCategory =
          s.category ||
          s.categoryId ||
          resolvedIndustry;

        const resolvedStage =
          s.stage ||
          s.stageId ||
          profProfile?.stage ||
          profUser?.stage ||
          regData?.stage ||
          "";

        const cleanNumStr = (val: unknown): string => {
          if (val === undefined || val === null || val === "") return "";
          if (typeof val === "number") return isFinite(val) ? String(val) : "";
          if (typeof val === "string") {
            const digits = val.replace(/[^0-9.]/g, "");
            return digits !== "" && !isNaN(Number(digits)) ? digits : "";
          }
          return "";
        };

        const resolvedFunding = cleanNumStr(
          s.funding ??
          s.amountRaising ??
          s.targetRaise ??
          s.amount_raising ??
          s.target_raise ??
          profProfile?.targetRaise ??
          profProfile?.target_raise ??
          profUser?.targetRaise ??
          regData?.targetRaise
        );

        const resolvedEquity = cleanNumStr(
          s.equity ??
          s.equityOffered ??
          s.equity_offered ??
          profProfile?.equity ??
          profProfile?.equityOffered ??
          profProfile?.equity_offered ??
          profUser?.equity ??
          regData?.equity
        );

        setForm({
          startup: resolvedStartupName,
          industry: resolvedIndustry,
          category: resolvedCategory,
          stage: resolvedStage,
          funding: resolvedFunding,
          equity: resolvedEquity,
        });
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, []);

  const update = (key: string, val: string) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  const handleLogoUpload = async (file: File) => {
    setUploadingLogo(true);
    try {
      const resolved = await uploadFreelancerMedia(file, true, "founder");
      if (resolved) {
        setLogoUrl(resolved);
        // Immediately persist logo to /founder/startup and profile
        await Promise.allSettled([
          api.fetch("/founder/startup", {
            method: "PUT",
            silent: true,
            body: JSON.stringify({
              startup: form.startup || "WorkNex",
              logo: resolved,
              coverUrl: coverUrl || undefined,
            }),
          }),
          api.fetch("/founder/profile", {
            method: "PATCH",
            silent: true,
            body: JSON.stringify({
              logo: resolved,
              companyLogo: resolved,
            }),
          }),
        ]);
        toast.success("Logo uploaded successfully");
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to upload logo"));
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleCoverUpload = async (file: File) => {
    setUploadingCover(true);
    try {
      const resolved = await uploadFreelancerMedia(file, true, "founder");
      if (resolved) {
        setCoverUrl(resolved);
        // Immediately persist coverUrl to /founder/startup and profile
        await Promise.allSettled([
          api.fetch("/founder/startup", {
            method: "PUT",
            silent: true,
            body: JSON.stringify({
              startup: form.startup || "WorkNex",
              coverUrl: resolved,
              logo: logoUrl || undefined,
            }),
          }),
          api.fetch("/founder/profile", {
            method: "PATCH",
            silent: true,
            body: JSON.stringify({
              coverUrl: resolved,
              startupCoverUrl: resolved,
            }),
          }),
        ]);
        toast.success("Cover banner uploaded successfully");
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to upload cover banner"));
    } finally {
      setUploadingCover(false);
    }
  };

  const handlePitchDeckUpload = async (file: File) => {
    setUploadingPitchDeck(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await api.fetch("/founder/media/upload", {
        method: "POST",
        body: formData,
      });
      const data = getResponseData(res, res);
      const url = data?.url || res?.url;
      if (url) {
        setPitchDeckUrl(url);
        await api
          .fetch("/founder/pitch-deck", {
            method: "PUT",
            body: JSON.stringify({ url }),
          })
          .catch(() => {});
        toast.success("Pitch deck uploaded successfully");
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to upload pitch deck"));
    } finally {
      setUploadingPitchDeck(false);
    }
  };

  const handleBusinessPlanUpload = async (file: File) => {
    setUploadingBusinessPlan(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await api.fetch("/founder/media/upload", {
        method: "POST",
        body: formData,
      });
      const data = getResponseData(res, res);
      const url = data?.url || res?.url;
      if (url) {
        setBusinessPlanUrl(url);
        await api
          .fetch("/founder/business-plan", {
            method: "PUT",
            body: JSON.stringify({ documentUrl: url }),
          })
          .catch(() => {});
        toast.success("Business plan uploaded successfully");
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to upload business plan"));
    } finally {
      setUploadingBusinessPlan(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.startup.trim()) {
      toast.error("Startup Name is required");
      return;
    }

    setSaving(true);
    try {
      const fundingNum = Number(form.funding);
      const equityNum = Number(form.equity);

      const payload = {
        startup: form.startup.trim(),
        startupName: form.startup.trim(),
        name: form.startup.trim(),
        industry: form.industry,
        category: form.category || form.industry,
        stage: form.stage,
        funding: Number.isFinite(fundingNum) ? fundingNum : 0,
        amountRaising: Number.isFinite(fundingNum) ? fundingNum : 0,
        equity: Number.isFinite(equityNum) ? equityNum : 0,
        equityOffered: Number.isFinite(equityNum) ? equityNum : 0,
        logo: logoUrl || undefined,
        coverUrl: coverUrl || undefined,
        pitchDeck: pitchDeckUrl || undefined,
        businessPlan: businessPlanUrl || undefined,
        visibility: "Public",
        status: "active",
      };

      // 1. Direct update to PUT /founder/startup which updates StartupIdea in DB (startup logo and coverUrl)
      await api.fetch("/founder/startup", {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      // 2. Sync startup metadata and media to Founder Profile
      await api
        .fetch("/founder/profile", {
          method: "PATCH",
          body: JSON.stringify({
            startupName: form.startup.trim(),
            industry: form.industry,
            stage: form.stage,
            targetRaise: Number.isFinite(fundingNum) ? fundingNum : undefined,
            companyLogo: logoUrl || undefined,
            logo: logoUrl || undefined,
            coverUrl: coverUrl || undefined,
            startupCoverUrl: coverUrl || undefined,
          }),
        })
        .catch(() => {});

      toast.success("Startup profile updated successfully!");
      navigate({ to: "/founder/startup" });
    } catch (err: any) {
      const errorObj = err as Record<string, unknown>;
      if (
        errorObj?.code === "SUBSCRIPTION_REQUIRED" ||
        errorObj?.status === 403 ||
        errorObj?.code === "ROLE_NOT_ENTITLED"
      ) {
        setGateCapability({
          allowed: false,
          code: (errorObj.code as string) || "SUBSCRIPTION_REQUIRED",
          reason:
            typeof errorObj?.message === "string"
              ? errorObj.message
              : "An active Founder subscription or 6-Month Free Trial is required to publish your startup to the marketplace.",
        });
        setGateOpen(true);
        return;
      }
      toast.error(getApiErrorMessage(err, "Failed to save startup"));
    } finally {
      setSaving(false);
    }
  };

  // Preview calculations for the investor card
  const previewFunding = Number(form.funding || 0);
  const previewEquity = Number(form.equity || 0);
  const previewSlug = createStartupSlug(form.startup, startupId);

  // Tabs based on fields
  const sections = [
    { id: "overview", label: "Overview & Basics", icon: Building2 },
    { id: "funding", label: "Funding & Terms", icon: IndianRupee },
    { id: "documents", label: "Pitch Deck & Plans", icon: FileText },
    { id: "media", label: "Branding & Media", icon: UploadCloud },
  ];

  if (loading) {
    return (
      <UnifiedShell
        pathname="/founder/startup"
        title="Edit Startup"
        breadcrumbs={[
          { label: "Founder OS", href: "/founder/dashboard" },
          { label: "Startup", href: "/founder/startup" },
          { label: "Edit" },
        ]}
      >
        <FndSkeleton rows={8} />
      </UnifiedShell>
    );
  }

  return (
    <UnifiedShell
      pathname="/founder/startup"
      title={isCreateMode ? "Create Startup" : "Edit Startup"}
      breadcrumbs={[
        { label: "Founder OS", href: "/founder/dashboard" },
        { label: "Startup", href: "/founder/startup" },
        { label: isCreateMode ? "Create" : "Edit" },
      ]}
    >
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild className="h-8 w-8">
              <Link to="/founder/startup">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {isCreateMode ? "Create Startup Idea" : "Edit Startup Profile"}
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 ml-10">
            {isCreateMode
              ? "Publish your startup idea to connect with investors and partners."
              : "Changes made here directly update the listing viewed by investors across the marketplace."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isCreateMode && startupId && (
            <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
              <Link to="/startups/$startupSlug" params={{ startupSlug: previewSlug }}>
                <Eye className="h-3.5 w-3.5" /> Preview View
              </Link>
            </Button>
          )}

          <Button
            onClick={save}
            disabled={saving}
            size="sm"
            className="gap-1.5 bg-primary text-primary-foreground text-xs"
          >
            <Save className="h-3.5 w-3.5" />{" "}
            {saving
              ? isCreateMode
                ? "Publishing..."
                : "Saving..."
              : isCreateMode
                ? "Publish Startup"
                : "Save Changes"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Navigation Tabs (Desktop Left Sidebar) in original style */}
        <aside className="lg:col-span-1">
          <Card className="p-2 space-y-1">
            {sections.map((sec) => {
              const Icon = sec.icon;
              const isActive = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() =>
                    navigate({
                      to: "/founder/startup/edit",
                      search: { section: sec.id, mode: isCreateMode ? "create" : undefined },
                    })
                  }
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors text-left ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{sec.label}</span>
                </button>
              );
            })}
          </Card>

          {/* Live Investor Preview Card */}
          <Card className="mt-4 p-4 border-dashed bg-muted/20">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
              Investor Preview
            </span>
            <div className="rounded-xl border border-border bg-card p-3 shadow-xs">
              <div className="flex items-center gap-2 mb-2">
                {logoUrl ? (
                  <img
                    src={resolveUploadUrl(logoUrl)}
                    alt="Logo"
                    className="h-7 w-7 rounded-lg object-cover border"
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (!target.dataset.tried && logoUrl) {
                        target.dataset.tried = "true";
                        target.src = logoUrl;
                      }
                    }}
                  />
                ) : (
                  <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary font-bold text-xs">
                    {form.startup ? form.startup.charAt(0).toUpperCase() : "S"}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-foreground truncate">
                    {form.startup || "Your Startup"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {form.industry || "Industry"} · {form.stage || "Stage"}
                  </p>
                </div>
              </div>

              <div className="bg-muted/40 rounded-lg p-2 text-xs">
                <span className="text-muted-foreground block text-[10px]">Target Raise</span>
                <span className="font-bold text-foreground">
                  {previewFunding > 0
                    ? `₹${previewFunding.toLocaleString("en-IN")}`
                    : "Undisclosed"}
                </span>
                {previewEquity > 0 && (
                  <span className="text-muted-foreground text-[11px] block mt-0.5">
                    for <strong className="text-foreground">{previewEquity}%</strong> equity
                  </span>
                )}
              </div>
            </div>
          </Card>
        </aside>

        {/* Form Body (Right 3 spans) */}
        <div className="lg:col-span-3">
          <form onSubmit={save} className="space-y-6">
            {/* 1. Overview Section: Startup Name, Industry, Stage */}
            {activeSection === "overview" && (
              <Card className="p-6 space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Overview & Basics</h2>
                  <p className="text-xs text-muted-foreground">
                    General identification, industry category, and development stage
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-foreground block mb-1.5">
                      Startup Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={form.startup}
                      onChange={(e) => update("startup", e.target.value)}
                      placeholder="e.g. HealthBridge AI"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1.5">
                      Industry
                    </label>
                    <select
                      value={form.industry}
                      onChange={(e) => update("industry", e.target.value)}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                    >
                      <option value="">Search and select industry...</option>
                      {industries.map((ind) => (
                        <option key={ind.id} value={ind.name}>
                          {ind.name}
                        </option>
                      ))}
                      {form.industry &&
                        !industries.some((i) => i.name === form.industry) && (
                          <option value={form.industry}>{form.industry}</option>
                        )}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1.5">
                      Stage
                    </label>
                    <select
                      value={form.stage}
                      onChange={(e) => update("stage", e.target.value)}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                    >
                      <option value="">Select development stage...</option>
                      {stages.map((stg) => {
                        const optVal = stg.value || stg.name;
                        return (
                          <option key={stg.id} value={optVal}>
                            {stg.name}
                          </option>
                        );
                      })}
                      {form.stage &&
                        !stages.some((s) => (s.value || s.name) === form.stage || s.name === form.stage) && (
                          <option value={form.stage}>{form.stage}</option>
                        )}
                    </select>
                  </div>
                </div>
              </Card>
            )}

            {/* 2. Funding Section: Funding Ask & Equity (%) */}
            {activeSection === "funding" && (
              <Card className="p-6 space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    Funding Requirements & Equity Terms
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    State the capital your startup is seeking. Expressed in Indian Rupees (₹ INR).
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1.5">
                      Funding Ask (₹ INR)
                    </label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <input
                        type="number"
                        min="0"
                        step="10000"
                        value={form.funding}
                        onChange={(e) => update("funding", e.target.value)}
                        placeholder="0"
                        className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm outline-none focus:border-primary font-mono"
                      />
                    </div>
                    {previewFunding > 0 && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Formatted: <strong>₹{previewFunding.toLocaleString("en-IN")}</strong>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1.5">
                      Equity (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={form.equity}
                        onChange={(e) => update("equity", e.target.value)}
                        placeholder="0"
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary font-mono"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Percentage of equity allocated for this raise
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-border/80 bg-muted/20 p-4 mt-2">
                  <div className="flex items-start gap-2.5">
                    <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        Honest Marketplace Pricing
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Go Experts facilitates direct connection and discussions between founders
                        and accredited investors. We do not calculate implied valuations or publish
                        synthetic equity metrics.
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* 3. Pitch Deck & Business Plan Section */}
            {activeSection === "documents" && (
              <Card className="p-6 space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    Pitch Deck & Business Plan
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Upload official investor presentation and executive business plan documents
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Pitch Deck Card */}
                  <div className="rounded-xl border border-border/70 p-4 bg-muted/10 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-lg bg-sky-500/10 text-sky-600 shrink-0">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">Pitch Deck</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {pitchDeckUrl ? "Document linked & ready" : "No pitch deck uploaded"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90">
                        <UploadCloud className="h-3.5 w-3.5" />
                        <span>{uploadingPitchDeck ? "Uploading..." : "Upload Pitch Deck"}</span>
                        <input
                          type="file"
                          accept=".pdf,.ppt,.pptx"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handlePitchDeckUpload(f);
                          }}
                        />
                      </label>
                      {pitchDeckUrl && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setPreviewDoc({
                              url: pitchDeckUrl,
                              title: "Pitch Deck Preview",
                              docType: "pitch-deck",
                            })
                          }
                          className="h-8 text-xs gap-1 cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" /> View
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Business Plan Card */}
                  <div className="rounded-xl border border-border/70 p-4 bg-muted/10 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-lg bg-indigo-500/10 text-indigo-600 shrink-0">
                        <FileCheck className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">Business Plan</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {businessPlanUrl ? "Document linked & ready" : "No business plan uploaded"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90">
                        <UploadCloud className="h-3.5 w-3.5" />
                        <span>{uploadingBusinessPlan ? "Uploading..." : "Upload Business Plan"}</span>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleBusinessPlanUpload(f);
                          }}
                        />
                      </label>
                      {businessPlanUrl && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setPreviewDoc({
                              url: businessPlanUrl,
                              title: "Business Plan Document",
                              docType: "business-plan",
                            })
                          }
                          className="h-8 text-xs gap-1 cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" /> View
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* 4. Media & Branding: Logo & Cover Banner */}
            {activeSection === "media" && (
              <Card className="p-6 space-y-6">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Branding & Media</h2>
                  <p className="text-xs text-muted-foreground">
                    Upload logo and cover banner visual assets displayed across the marketplace
                  </p>
                </div>

                {/* Logo Upload Box */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground block">
                    Startup Logo
                  </label>
                  <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-xl border border-border/60 bg-muted/10">
                    {logoUrl ? (
                      <img
                        src={resolveUploadUrl(logoUrl)}
                        alt="Startup Logo"
                        className="h-20 w-20 rounded-2xl border object-cover shadow-sm shrink-0"
                        onError={(e) => {
                          const target = e.currentTarget;
                          if (!target.dataset.tried && logoUrl) {
                            target.dataset.tried = "true";
                            target.src = logoUrl;
                          }
                        }}
                      />
                    ) : (
                      <div className="grid h-20 w-20 place-items-center rounded-2xl bg-muted text-muted-foreground font-bold text-2xl border border-dashed shrink-0">
                        {form.startup ? form.startup.charAt(0).toUpperCase() : "S"}
                      </div>
                    )}

                    <div className="space-y-2 text-center sm:text-left">
                      <label className="cursor-pointer inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90">
                        <UploadCloud className="h-4 w-4" />
                        <span>{uploadingLogo ? "Uploading..." : "Upload Logo"}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleLogoUpload(f);
                          }}
                        />
                      </label>
                      <p className="text-[11px] text-muted-foreground">
                        PNG, JPG, or SVG. Maximum file size 5MB.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Cover Banner Upload Box */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground block">
                    Cover Banner
                  </label>
                  <div className="rounded-xl border border-border/60 bg-muted/10 p-4 space-y-3">
                    {coverUrl ? (
                      <div className="relative h-36 w-full rounded-lg overflow-hidden border border-border/80 bg-slate-900">
                        <img
                          src={resolveUploadUrl(coverUrl)}
                          alt="Cover Banner"
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            const target = e.currentTarget;
                            if (!target.dataset.tried && coverUrl) {
                              target.dataset.tried = "true";
                              target.src = coverUrl;
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <div className="h-24 w-full rounded-lg border-2 border-dashed border-border/60 flex items-center justify-center text-xs text-muted-foreground">
                        No cover banner uploaded yet
                      </div>
                    )}

                    <div>
                      <label className="cursor-pointer inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90">
                        <UploadCloud className="h-4 w-4" />
                        <span>{uploadingCover ? "Uploading..." : "Upload Cover Banner"}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleCoverUpload(f);
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="ghost" asChild className="text-xs">
                <Link to="/founder/startup">Cancel</Link>
              </Button>
              <Button type="submit" disabled={saving} className="gap-1.5 text-xs shadow-xs">
                <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </div>
      </div>

      <ActionGateModal
        open={gateOpen}
        onOpenChange={setGateOpen}
        title="Publish Startup"
        capability={gateCapability}
      />

      <DocumentPreviewModal
        isOpen={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        url={previewDoc?.url}
        title={previewDoc?.title || "Document Preview"}
        docType={previewDoc?.docType || "document"}
      />
    </UnifiedShell>
  );
}
