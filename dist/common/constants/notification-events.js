/**
 * Go Experts - Centralized Notification Event Registry & Route Resolver
 * Canonical definitions for event types, delivery channels, and role-aware deep linking.
 */
export const NotificationEventType = {
    // ACCOUNT & SECURITY
    ACCOUNT_CREATED: "ACCOUNT_CREATED",
    EMAIL_VERIFIED: "EMAIL_VERIFIED",
    PASSWORD_RESET_REQUESTED: "PASSWORD_RESET_REQUESTED",
    PASSWORD_CHANGED: "PASSWORD_CHANGED",
    VERIFICATION_APPROVED: "VERIFICATION_APPROVED",
    VERIFICATION_REJECTED: "VERIFICATION_REJECTED",
    // PROJECTS & PROPOSALS
    PROJECT_PUBLISHED: "PROJECT_PUBLISHED",
    PROJECT_COMPLETED: "PROJECT_COMPLETED",
    PROJECT_CANCELLED: "PROJECT_CANCELLED",
    PROPOSAL_RECEIVED: "PROPOSAL_RECEIVED",
    PROPOSAL_ACCEPTED: "PROPOSAL_ACCEPTED",
    PROPOSAL_REJECTED: "PROPOSAL_REJECTED",
    // CONTRACTS
    CONTRACT_ISSUED: "CONTRACT_ISSUED",
    CONTRACT_ACCEPTED: "CONTRACT_ACCEPTED",
    CONTRACT_COMPLETED: "CONTRACT_COMPLETED",
    CONTRACT_CANCELLED: "CONTRACT_CANCELLED",
    // TASKS
    TASK_ASSIGNED: "TASK_ASSIGNED",
    TASK_UPDATED: "TASK_UPDATED",
    TASK_COMMENT_ADDED: "TASK_COMMENT_ADDED",
    // MILESTONES
    MILESTONE_SUBMITTED: "MILESTONE_SUBMITTED",
    MILESTONE_APPROVED: "MILESTONE_APPROVED",
    MILESTONE_CHANGES_REQUESTED: "MILESTONE_CHANGES_REQUESTED",
    // MESSAGES
    MESSAGE_RECEIVED: "MESSAGE_RECEIVED",
    // REVIEWS
    REVIEW_RECEIVED: "REVIEW_RECEIVED",
    // STARTUP & INVESTOR
    INVESTOR_INTEREST_EXPRESSED: "INVESTOR_INTEREST_EXPRESSED",
    FOUNDER_INTEREST_ACCEPTED: "FOUNDER_INTEREST_ACCEPTED",
    FOUNDER_INTEREST_REJECTED: "FOUNDER_INTEREST_REJECTED",
    INVESTOR_REQUEST_RECEIVED: "INVESTOR_REQUEST_RECEIVED",
    FOUNDER_REQUEST_RESPONDED: "FOUNDER_REQUEST_RESPONDED",
};
/**
 * Events that bypass marketing/optional preferences and are mandatory for account security
 */
export const SECURITY_CRITICAL_EVENTS = new Set([
    NotificationEventType.PASSWORD_RESET_REQUESTED,
    NotificationEventType.PASSWORD_CHANGED,
    NotificationEventType.EMAIL_VERIFIED,
    NotificationEventType.VERIFICATION_APPROVED,
    NotificationEventType.VERIFICATION_REJECTED,
]);
/**
 * High-value business events eligible for transactional email
 */
export const EMAIL_ELIGIBLE_EVENTS = new Set([
    ...SECURITY_CRITICAL_EVENTS,
    NotificationEventType.PROPOSAL_RECEIVED,
    NotificationEventType.PROPOSAL_ACCEPTED,
    NotificationEventType.CONTRACT_ISSUED,
    NotificationEventType.CONTRACT_ACCEPTED,
    NotificationEventType.MILESTONE_SUBMITTED,
    NotificationEventType.MILESTONE_APPROVED,
    NotificationEventType.MILESTONE_CHANGES_REQUESTED,
    NotificationEventType.PROJECT_COMPLETED,
    NotificationEventType.REVIEW_RECEIVED,
    NotificationEventType.INVESTOR_INTEREST_EXPRESSED,
    NotificationEventType.FOUNDER_INTEREST_ACCEPTED,
    NotificationEventType.INVESTOR_REQUEST_RECEIVED,
    NotificationEventType.FOUNDER_REQUEST_RESPONDED,
]);
/**
 * Events eligible for push notification
 */
export const PUSH_ELIGIBLE_EVENTS = new Set([
    ...EMAIL_ELIGIBLE_EVENTS,
    NotificationEventType.TASK_ASSIGNED,
    NotificationEventType.TASK_COMMENT_ADDED,
    NotificationEventType.MESSAGE_RECEIVED,
]);
/**
 * Role-aware Deep-Link Resolver
 * Inspects recipient's relationship to the resource rather than purely relying on active session role.
 */
export function resolveActionUrl(params) {
    const { type, recipientRole, contextType, contextId, projectId, taskId, proposalId, conversationId, startupId, isClientOwner, isContractedFreelancer, } = params;
    const normalizedRole = String(recipientRole || "").toLowerCase();
    const effectiveProjectId = projectId || (contextType === "project" ? contextId : undefined);
    const effectiveTaskId = taskId || (contextType === "task" ? contextId : undefined);
    const effectiveProposalId = proposalId || (contextType === "proposal" ? contextId : undefined);
    const effectiveConvId = conversationId || (contextType === "conversation" || contextType === "message" ? contextId : undefined);
    // 1. Messages / Chat
    if (effectiveConvId || type === NotificationEventType.MESSAGE_RECEIVED) {
        return effectiveConvId ? `/messages?conversationId=${effectiveConvId}` : "/messages";
    }
    // 2. Projects & Proposals
    if (effectiveProjectId) {
        const isClient = isClientOwner || normalizedRole === "client" || normalizedRole === "business";
        const baseProjectRoute = isClient
            ? `/business/projects/${effectiveProjectId}`
            : `/dashboard/projects/${effectiveProjectId}`;
        if (type === NotificationEventType.PROPOSAL_RECEIVED && isClient) {
            return `/business/projects/${effectiveProjectId}/proposals`;
        }
        if (type === NotificationEventType.MILESTONE_SUBMITTED || type === NotificationEventType.MILESTONE_APPROVED) {
            return `${baseProjectRoute}?tab=milestones`;
        }
        if (type === NotificationEventType.PROJECT_COMPLETED) {
            return `${baseProjectRoute}?tab=overview`;
        }
        return baseProjectRoute;
    }
    // 3. Standalone Proposals
    if (effectiveProposalId) {
        return normalizedRole === "client"
            ? `/business/proposals/${effectiveProposalId}`
            : `/dashboard/proposals`;
    }
    // 4. Tasks
    if (effectiveTaskId) {
        return normalizedRole === "client"
            ? `/business/tasks/${effectiveTaskId}`
            : `/dashboard/tasks`;
    }
    // 5. Reviews
    if (type === NotificationEventType.REVIEW_RECEIVED) {
        return normalizedRole === "client" ? "/business/reviews" : "/dashboard/reviews";
    }
    // 6. Investor / Founder
    if (type.includes("INVESTOR") || type.includes("FOUNDER") || contextType === "startup") {
        if (normalizedRole === "founder") {
            return "/founder/investor-requests";
        }
        if (normalizedRole === "investor") {
            return startupId ? `/investor/startups/${startupId}` : "/investors";
        }
    }
    // 7. Security / Verification
    if (type === NotificationEventType.VERIFICATION_APPROVED || type === NotificationEventType.VERIFICATION_REJECTED) {
        return normalizedRole === "client" ? "/business/verification" : "/dashboard/verification";
    }
    // Fallback to role dashboard
    return normalizedRole === "client" ? "/business" : "/dashboard";
}
