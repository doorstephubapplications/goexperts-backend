import { prisma } from '../../config/database.js';
import { queryEasebuzzTransactionStatus } from '../../modules/mobile/payments/gateways/easebuzz.gateway.js';
import { completePaymentFromWebhook } from '../../modules/mobile/payments/payments.service.js';

export interface ReconciliationOptions {
  thresholdMinutes?: number;
  batchSize?: number;
  force?: boolean;
}

export interface ReconcileResult {
  paymentId: string;
  previousStatus: string;
  status: string;
  gateway?: string;
  gatewayStatus?: string;
  fulfilled?: boolean;
  terminal?: boolean;
  skipped?: boolean;
  preservedPending?: boolean;
  stillPending?: boolean;
  reason?: string;
  error?: string;
}

export interface BatchReconciliationSummary {
  processed: number;
  completed: number;
  failed: number;
  stillPending: number;
  preservedPending: number;
  skipped: number;
  errors: number;
  results: ReconcileResult[];
}

/**
 * Safely masks a transaction ID for sanitized logging.
 */
export function maskTxnId(txnId?: string | null): string {
  if (!txnId) return '[NONE]';
  if (txnId.length <= 8) return '***';
  return `${txnId.slice(0, 7)}...[MASKED]...${txnId.slice(-5)}`;
}

/**
 * Reconciles a single payment record by inspecting the authoritative gateway state.
 */
export async function reconcilePaymentById(
  paymentId: string,
  options: ReconciliationOptions = {}
): Promise<ReconcileResult> {
  const thresholdMinutes = options.thresholdMinutes ?? parseInt(process.env.PENDING_PAYMENT_RECONCILE_AFTER_MINUTES || '30', 10);
  const force = options.force ?? false;

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment) {
    throw new Error(`PAYMENT_NOT_FOUND: ${paymentId}`);
  }

  // Idempotency: If already in a terminal state, never re-process
  if (payment.status !== 'pending') {
    return {
      paymentId: payment.id,
      previousStatus: payment.status,
      status: payment.status,
      gateway: payment.gateway,
      skipped: true,
      reason: 'ALREADY_TERMINAL',
    };
  }

  // Age threshold check: do not reconcile payments younger than threshold unless forced
  const ageMs = Date.now() - payment.createdAt.getTime();
  const thresholdMs = thresholdMinutes * 60 * 1000;
  if (!force && ageMs < thresholdMs) {
    return {
      paymentId: payment.id,
      previousStatus: payment.status,
      status: 'pending',
      gateway: payment.gateway,
      skipped: true,
      reason: 'BELOW_AGE_THRESHOLD',
    };
  }

  const maskedTxn = maskTxnId(payment.transactionId);

  // Gateway: Easebuzz
  if (payment.gateway === 'easebuzz') {
    if (!payment.transactionId) {
      return {
        paymentId: payment.id,
        previousStatus: 'pending',
        status: 'pending',
        gateway: 'easebuzz',
        skipped: true,
        reason: 'MISSING_TRANSACTION_ID',
      };
    }

    const queryResult = await queryEasebuzzTransactionStatus(payment.transactionId);

    // Case 1: Gateway Unreachable / Network Error / 5xx
    // Financial Safety Rule: NEVER mark failed on gateway outage; preserve pending
    if (!queryResult.success) {
      console.warn(
        `[RECONCILIATION] Gateway temporarily unavailable for txn ${maskedTxn}: ${queryResult.error}. Preserving pending status.`
      );
      return {
        paymentId: payment.id,
        previousStatus: 'pending',
        status: 'pending',
        gateway: 'easebuzz',
        preservedPending: true,
        reason: 'GATEWAY_UNAVAILABLE',
        error: queryResult.error,
      };
    }

    const gatewayStatus = String(queryResult.gatewayStatus || '').toLowerCase().trim();

    // Case 2: Gateway SUCCESS discovered during reconciliation
    // Must route through the identical, idempotent fulfillment path as a verified webhook
    if (gatewayStatus === 'success' || gatewayStatus === 'successful') {
      console.log(
        `[RECONCILIATION] Authoritative SUCCESS discovered for txn ${maskedTxn}. Invoking idempotent fulfillment...`
      );
      await completePaymentFromWebhook(payment.transactionId, (payment as any).purpose || '');
      return {
        paymentId: payment.id,
        previousStatus: 'pending',
        status: 'completed',
        gateway: 'easebuzz',
        gatewayStatus: queryResult.gatewayStatus,
        fulfilled: true,
        terminal: true,
      };
    }

    // Case 3: Gateway STILL PENDING
    if (gatewayStatus === 'pending') {
      console.log(`[RECONCILIATION] Txn ${maskedTxn} is still pending at gateway.`);
      return {
        paymentId: payment.id,
        previousStatus: 'pending',
        status: 'pending',
        gateway: 'easebuzz',
        gatewayStatus: 'pending',
        stillPending: true,
      };
    }

    // Case 4: Gateway BOUNCED / USER_CANCELLED / FAILED / DROPPED / NOT_FOUND
    // Authoritatively non-successful terminal state
    const terminalFailureStatuses = ['bounced', 'usercancelled', 'failed', 'dropped', 'not_found'];
    if (terminalFailureStatuses.includes(gatewayStatus)) {
      // Atomic row guard: update only if still pending
      const updateResult = await prisma.payment.updateMany({
        where: { id: payment.id, status: 'pending' },
        data: { status: 'failed' },
      });

      if (updateResult.count === 0) {
        // Concurrently updated by another process/webhook
        const current = await prisma.payment.findUnique({ where: { id: payment.id } });
        return {
          paymentId: payment.id,
          previousStatus: 'pending',
          status: current?.status || 'unknown',
          gateway: 'easebuzz',
          skipped: true,
          reason: 'CONCURRENTLY_UPDATED',
        };
      }

      console.log(
        `[RECONCILIATION] Txn ${maskedTxn} authoritatively transitioned to 'failed' (Gateway status: ${gatewayStatus}, reason: ${queryResult.errorMessage || 'none'}). Zero unearned fulfillment.`
      );

      return {
        paymentId: payment.id,
        previousStatus: 'pending',
        status: 'failed',
        gateway: 'easebuzz',
        gatewayStatus: queryResult.gatewayStatus,
        terminal: true,
        reason: queryResult.errorMessage || gatewayStatus,
      };
    }

    // Case 5: Unrecognized gateway response -> Conservative safety guard
    console.warn(`[RECONCILIATION] Unrecognized gateway status for txn ${maskedTxn}: ${gatewayStatus}. Preserving pending.`);
    return {
      paymentId: payment.id,
      previousStatus: 'pending',
      status: 'pending',
      gateway: 'easebuzz',
      preservedPending: true,
      reason: `UNRECOGNIZED_GATEWAY_STATUS_${gatewayStatus}`,
    };
  }

  // Non-Easebuzz gateways without implemented query -> conservative no-op
  return {
    paymentId: payment.id,
    previousStatus: 'pending',
    status: 'pending',
    gateway: payment.gateway,
    skipped: true,
    reason: `RECONCILIATION_NOT_SUPPORTED_FOR_${payment.gateway.toUpperCase()}`,
  };
}

/**
 * Scans and reconciles all stale pending payments older than the configured threshold.
 */
export async function reconcileStalePendingPayments(
  options: ReconciliationOptions = {}
): Promise<BatchReconciliationSummary> {
  const thresholdMinutes = options.thresholdMinutes ?? parseInt(process.env.PENDING_PAYMENT_RECONCILE_AFTER_MINUTES || '30', 10);
  const batchSize = options.batchSize ?? parseInt(process.env.PAYMENT_RECONCILE_BATCH_SIZE || '25', 10);

  const cutoffDate = new Date(Date.now() - thresholdMinutes * 60 * 1000);

  const stalePayments = await prisma.payment.findMany({
    where: {
      status: 'pending',
      createdAt: { lte: cutoffDate },
    },
    orderBy: { createdAt: 'asc' },
    take: batchSize,
  });

  const summary: BatchReconciliationSummary = {
    processed: stalePayments.length,
    completed: 0,
    failed: 0,
    stillPending: 0,
    preservedPending: 0,
    skipped: 0,
    errors: 0,
    results: [],
  };

  for (const payment of stalePayments) {
    try {
      const result = await reconcilePaymentById(payment.id, { thresholdMinutes, force: true });
      summary.results.push(result);

      if (result.status === 'completed') summary.completed++;
      else if (result.status === 'failed') summary.failed++;
      else if (result.stillPending) summary.stillPending++;
      else if (result.preservedPending) summary.preservedPending++;
      else if (result.skipped) summary.skipped++;
    } catch (err: any) {
      summary.errors++;
      console.error(`[RECONCILIATION] Error reconciling payment ${payment.id}:`, err);
      summary.results.push({
        paymentId: payment.id,
        previousStatus: 'pending',
        status: 'pending',
        error: err?.message || 'UNKNOWN_ERROR',
      });
    }
  }

  if (summary.processed > 0) {
    console.log(
      `[RECONCILIATION BATCH COMPLETE] Processed: ${summary.processed}, Completed: ${summary.completed}, Failed: ${summary.failed}, Still Pending: ${summary.stillPending}, Preserved Pending: ${summary.preservedPending}, Errors: ${summary.errors}`
    );
  }

  return summary;
}
