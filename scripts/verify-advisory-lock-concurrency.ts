import { prisma } from '../src/config/database.js';

interface TestStepResult {
  step: string;
  passed: boolean;
  details: any;
}

async function runAdvisoryLockVerification() {
  console.log('===============================================================');
  console.log('   GO EXPERTS: MySQL GET_LOCK() & CONCURRENCY VERIFICATION     ');
  console.log('===============================================================\n');

  const results: TestStepResult[] = [];

  // ---------------------------------------------------------------------------
  // STEP 1: Verify Connection ID Pinning in Prisma Interactive Transactions
  // ---------------------------------------------------------------------------
  console.log('[TEST 1] Verifying Connection ID Pinning in Prisma Interactive Transactions...');
  try {
    const connCheck = await prisma.$transaction(async (tx) => {
      // 1. Get connection ID before acquiring lock
      const rows1: any = await tx.$queryRaw`SELECT CONNECTION_ID() as connId`;
      const connId1 = Number(rows1[0]?.connId);

      // 2. Acquire advisory lock
      const lockKey = 'verify_pinning_lock_key';
      const lockRows: any = await tx.$queryRaw`SELECT GET_LOCK(${lockKey}, 5) as lockAcquired`;
      const acquired = Number(lockRows[0]?.lockAcquired);

      // 3. Get connection ID while holding lock
      const rows2: any = await tx.$queryRaw`SELECT CONNECTION_ID() as connId`;
      const connId2 = Number(rows2[0]?.connId);

      // 4. Perform an ORM read query
      await tx.user.findFirst({ select: { id: true } });

      // 5. Get connection ID after ORM read query
      const rows3: any = await tx.$queryRaw`SELECT CONNECTION_ID() as connId`;
      const connId3 = Number(rows3[0]?.connId);

      // 6. Release advisory lock
      const releaseRows: any = await tx.$queryRaw`SELECT RELEASE_LOCK(${lockKey}) as lockReleased`;
      const released = Number(releaseRows[0]?.lockReleased);

      // 7. Get connection ID after lock release
      const rows4: any = await tx.$queryRaw`SELECT CONNECTION_ID() as connId`;
      const connId4 = Number(rows4[0]?.connId);

      return {
        connId1,
        connId2,
        connId3,
        connId4,
        acquired,
        released,
        isPinned: connId1 === connId2 && connId2 === connId3 && connId3 === connId4
      };
    }, {
      isolationLevel: 'ReadCommitted',
      timeout: 10000
    });

    const passed = connCheck.isPinned && connCheck.acquired === 1 && connCheck.released === 1;
    results.push({
      step: 'Prisma Connection ID Pinning & Same-Session Release',
      passed,
      details: {
        connectionIds: [connCheck.connId1, connCheck.connId2, connCheck.connId3, connCheck.connId4],
        lockAcquired: connCheck.acquired,
        lockReleased: connCheck.released,
        allSameConnection: connCheck.isPinned
      }
    });

    console.log(`  -> Connection IDs across transaction: [${connCheck.connId1}, ${connCheck.connId2}, ${connCheck.connId3}, ${connCheck.connId4}]`);
    console.log(`  -> Lock Acquired: ${connCheck.acquired}, Released: ${connCheck.released}`);
    console.log(`  -> Pinned to same MySQL session: ${connCheck.isPinned ? 'YES (PASS)' : 'NO (FAIL)'}\n`);
  } catch (err: any) {
    results.push({ step: 'Prisma Connection ID Pinning', passed: false, details: err.message });
    console.error('  -> Failed:', err.message);
  }

  // ---------------------------------------------------------------------------
  // STEP 2: Verify Cross-Connection Mutual Exclusion (Lock Blocking & Ownership)
  // ---------------------------------------------------------------------------
  console.log('[TEST 2] Verifying Cross-Connection Mutual Exclusion (Blocking & Return Codes)...');
  try {
    const testKey = 'verify_mutual_exclusion_test';
    let holderConnId = 0;
    let competitorLockResult = -1;
    let isUsedConnId = 0;

    // We start Transaction 1 which acquires and holds the lock for 1.5 seconds
    const holderPromise = prisma.$transaction(async (tx) => {
      const lockRes: any = await tx.$queryRaw`SELECT GET_LOCK(${testKey}, 5) as lockAcquired`;
      const connRes: any = await tx.$queryRaw`SELECT CONNECTION_ID() as connId`;
      holderConnId = Number(connRes[0]?.connId);

      // Wait 1.5s while holding the lock
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const relRes: any = await tx.$queryRaw`SELECT RELEASE_LOCK(${testKey}) as lockReleased`;
      return { acquired: Number(lockRes[0]?.lockAcquired), released: Number(relRes[0]?.lockReleased) };
    }, { isolationLevel: 'ReadCommitted', timeout: 10000 });

    // Wait 300ms to ensure Transaction 1 holds the lock
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Transaction 2 tries to acquire the same lock with timeout = 0 (immediate return)
    const competitorPromise = prisma.$transaction(async (tx) => {
      // Check which connection holds the lock
      const usedRes: any = await tx.$queryRaw`SELECT IS_USED_LOCK(${testKey}) as usedBy`;
      isUsedConnId = Number(usedRes[0]?.usedBy);

      // Attempt to acquire with 0s timeout -> must return 0 (failed to acquire)
      const tryLock: any = await tx.$queryRaw`SELECT GET_LOCK(${testKey}, 0) as lockAcquired`;
      competitorLockResult = Number(tryLock[0]?.lockAcquired);

      return { competitorLockResult, isUsedConnId };
    }, { isolationLevel: 'ReadCommitted', timeout: 10000 });

    const [holderResult, competitorResult] = await Promise.all([holderPromise, competitorPromise]);

    const passed =
      holderResult.acquired === 1 &&
      holderResult.released === 1 &&
      competitorResult.competitorLockResult === 0 &&
      competitorResult.isUsedConnId === holderConnId;

    results.push({
      step: 'Cross-Connection Mutual Exclusion & IS_USED_LOCK Tracking',
      passed,
      details: {
        holderConnId,
        isUsedConnId: competitorResult.isUsedConnId,
        competitorLockResult: competitorResult.competitorLockResult,
        holderAcquired: holderResult.acquired,
        holderReleased: holderResult.released
      }
    });

    console.log(`  -> Lock Holder Connection ID: ${holderConnId}`);
    console.log(`  -> IS_USED_LOCK confirmed owned by: ${competitorResult.isUsedConnId}`);
    console.log(`  -> Competitor GET_LOCK(timeout=0) result: ${competitorResult.competitorLockResult} (0 = properly blocked)`);
    console.log(`  -> Mutual Exclusion: ${passed ? 'VERIFIED (PASS)' : 'FAILED'}\n`);
  } catch (err: any) {
    results.push({ step: 'Cross-Connection Mutual Exclusion', passed: false, details: err.message });
    console.error('  -> Failed:', err.message);
  }

  // ---------------------------------------------------------------------------
  // STEP 3: Verify Transaction Visibility Under ReadCommitted Isolation
  // ---------------------------------------------------------------------------
  console.log('[TEST 3] Verifying ReadCommitted Snapshot Visibility Post Lock Acquisition...');
  try {
    const timestamp = Date.now();
    const testUserEmail = `visib-check-${timestamp}@goexperts.test`;
    const visibilityKey = `verify_visibility_key_${timestamp}`;

    let worker2SawRecord = false;
    let worker2RecordId: string | null = null;

    // Worker 1: Acquires lock, creates a user, commits transaction (which releases lock)
    const worker1 = async () => {
      return prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT GET_LOCK(${visibilityKey}, 5)`;
        try {
          await new Promise((r) => setTimeout(r, 600)); // Simulate work
          const u = await tx.user.create({
            data: {
              email: testUserEmail,
              fullName: 'Visibility Test User',
              role: 'CLIENT',
              password: 'hashed_test_password_123'
            }
          });
          return u.id;
        } finally {
          await tx.$queryRaw`SELECT RELEASE_LOCK(${visibilityKey})`.catch(() => {});
        }
      }, { isolationLevel: 'ReadCommitted', timeout: 10000 });
    };

    // Worker 2: Starts almost simultaneously, tries to acquire the same lock.
    // Under ReadCommitted, once Worker 1 commits and Worker 2 acquires the lock,
    // Worker 2 MUST see the user created by Worker 1 without stale MVCC caching.
    const worker2 = async () => {
      // Small 100ms delay so Worker 1 acquires lock first
      await new Promise((r) => setTimeout(r, 100));

      return prisma.$transaction(async (tx) => {
        const lockRes: any = await tx.$queryRaw`SELECT GET_LOCK(${visibilityKey}, 10) as lockAcquired`;
        const acquired = Number(lockRes[0]?.lockAcquired);
        if (acquired !== 1) throw new Error('Worker 2 lock timeout');

        try {
          // Immediately query for user created by Worker 1
          const found = await tx.user.findUnique({
            where: { email: testUserEmail }
          });
          if (found) {
            worker2SawRecord = true;
            worker2RecordId = found.id;
          }
          return found;
        } finally {
          await tx.$queryRaw`SELECT RELEASE_LOCK(${visibilityKey})`.catch(() => {});
        }
      }, { isolationLevel: 'ReadCommitted', timeout: 10000 });
    };

    const [createdUserId] = await Promise.all([worker1(), worker2()]);
    const passed = worker2SawRecord && worker2RecordId === createdUserId;

    results.push({
      step: 'ReadCommitted Transaction Visibility Under Lock Serialization',
      passed,
      details: {
        createdUserId,
        worker2RecordId,
        worker2SawRecord
      }
    });

    console.log(`  -> Worker 1 created user: ${createdUserId}`);
    console.log(`  -> Worker 2 read user post-lock: ${worker2RecordId}`);
    console.log(`  -> Stale snapshot avoided (ReadCommitted): ${passed ? 'VERIFIED (PASS)' : 'FAILED'}\n`);

    // Teardown user
    await prisma.user.deleteMany({ where: { email: testUserEmail } });
  } catch (err: any) {
    results.push({ step: 'ReadCommitted Transaction Visibility', passed: false, details: err.message });
    console.error('  -> Failed:', err.message);
  }

  // ---------------------------------------------------------------------------
  // STEP 4: Live Simulation: Concurrent Opposite-Direction Invitations (A -> B vs B -> A)
  // ---------------------------------------------------------------------------
  console.log('[TEST 4] Simulating Simultaneous Opposite-Direction Invitations (A -> B vs B -> A)...');
  try {
    const timestamp = Date.now();
    const userA = await prisma.user.create({
      data: {
        email: `conc-a-${timestamp}@goexperts.test`,
        fullName: 'Concurrent User A',
        role: 'CLIENT',
        password: 'hashed_test_password_123'
      }
    });

    const userB = await prisma.user.create({
      data: {
        email: `conc-b-${timestamp}@goexperts.test`,
        fullName: 'Concurrent User B',
        role: 'FREELANCER',
        password: 'hashed_test_password_123'
      }
    });

    // Helper that executes the exact controller transactional logic for sending invitations
    const sendInvitationTx = async (senderId: string, recipientId: string) => {
      const [u1, u2] = [senderId, recipientId].sort();
      const lockKey = `conn_inv_${u1}_${u2}`;

      return prisma.$transaction(async (tx) => {
        const lockRows: any = await tx.$queryRaw`SELECT GET_LOCK(${lockKey}, 10) as lockAcquired`;
        const acquired = Number(lockRows?.[0]?.lockAcquired);
        if (acquired !== 1) {
          throw new Error('System is busy processing an invitation between these accounts');
        }

        try {
          // Check active connection
          const connInside = await tx.connection.findUnique({
            where: { userOneId_userTwoId: { userOneId: u1, userTwoId: u2 } }
          });
          if (connInside && connInside.status === 'ACTIVE') {
            throw new Error('You are already connected with this user');
          }

          // Check active pending invitations in either direction
          const existing = await tx.connectionInvitation.findFirst({
            where: {
              OR: [
                { senderId: senderId, receiverId: recipientId },
                { senderId: recipientId, receiverId: senderId }
              ],
              status: 'PENDING'
            }
          });
          if (existing) {
            throw new Error('An active invitation between these accounts already exists');
          }

          return await tx.connectionInvitation.create({
            data: {
              senderId: senderId,
              receiverId: recipientId,
              firstMessage: `Hello from ${senderId}`,
              status: 'PENDING'
            }
          });
        } finally {
          await tx.$queryRaw`SELECT RELEASE_LOCK(${lockKey})`.catch(() => {});
        }
      }, {
        isolationLevel: 'ReadCommitted',
        timeout: 15000,
        maxWait: 5000
      });
    };

    // Fire A -> B and B -> A simultaneously
    const reqAtoB = sendInvitationTx(userA.id, userB.id).then(
      (res) => ({ status: 'success', data: res }),
      (err) => ({ status: 'error', message: err.message })
    );

    const reqBtoA = sendInvitationTx(userB.id, userA.id).then(
      (res) => ({ status: 'success', data: res }),
      (err) => ({ status: 'error', message: err.message })
    );

    const [res1, res2] = await Promise.all([reqAtoB, reqBtoA]);

    const successes = [res1, res2].filter((r) => r.status === 'success');
    const errors = [res1, res2].filter((r) => r.status === 'error');

    // Verify database state: Exactly 1 invitation should exist between these two users
    const [u1, u2] = [userA.id, userB.id].sort();
    const invitationsInDb = await prisma.connectionInvitation.findMany({
      where: {
        OR: [
          { senderId: userA.id, receiverId: userB.id },
          { senderId: userB.id, receiverId: userA.id }
        ]
      }
    });

    const passed =
      successes.length === 1 &&
      errors.length === 1 &&
      invitationsInDb.length === 1 &&
      errors[0].message === 'An active invitation between these accounts already exists';

    results.push({
      step: 'Opposite-Direction Simultaneous Invitation Race (A->B vs B->A)',
      passed,
      details: {
        successCount: successes.length,
        errorCount: errors.length,
        errorMessage: errors[0]?.message,
        dbRecordCount: invitationsInDb.length,
        winningInvitationId: invitationsInDb[0]?.id
      }
    });

    console.log(`  -> A -> B Result: ${res1.status === 'success' ? 'WON (Created)' : 'LOST (' + res1.message + ')'}`);
    console.log(`  -> B -> A Result: ${res2.status === 'success' ? 'WON (Created)' : 'LOST (' + res2.message + ')'}`);
    console.log(`  -> Database total invitations: ${invitationsInDb.length} (Expected: exactly 1)`);
    console.log(`  -> Opposite-Direction Race Serialization: ${passed ? 'VERIFIED (PASS)' : 'FAILED'}\n`);

    // Clean up
    await prisma.connectionInvitation.deleteMany({
      where: {
        OR: [
          { senderId: userA.id, receiverId: userB.id },
          { senderId: userB.id, receiverId: userA.id }
        ]
      }
    });
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
  } catch (err: any) {
    results.push({ step: 'Opposite-Direction Invitation Race', passed: false, details: err.message });
    console.error('  -> Failed:', err.message);
  }

  // ---------------------------------------------------------------------------
  // STEP 5: Live Simulation: Concurrent Invitation Acceptance Race (5 Parallel Accepts)
  // ---------------------------------------------------------------------------
  console.log('[TEST 5] Simulating Concurrent Invitation Acceptance Race (5 Parallel Accepts)...');
  try {
    const timestamp = Date.now();
    const sender = await prisma.user.create({
      data: {
        email: `acc-sender-${timestamp}@goexperts.test`,
        fullName: 'Accept Test Sender',
        role: 'CLIENT',
        password: 'hashed_test_password_123'
      }
    });

    const receiver = await prisma.user.create({
      data: {
        email: `acc-recv-${timestamp}@goexperts.test`,
        fullName: 'Accept Test Receiver',
        role: 'STARTUP',
        password: 'hashed_test_password_123'
      }
    });

    const invitation = await prisma.connectionInvitation.create({
      data: {
        senderId: sender.id,
        receiverId: receiver.id,
        firstMessage: 'Let us connect and discuss our startup!',
        status: 'PENDING'
      }
    });

    // Helper that executes the exact controller transactional logic for acceptInvitation
    const acceptInvitationTx = async (invId: string) => {
      const [userOneId, userTwoId] = [sender.id, receiver.id].sort();
      const lockKey = `conn_accept_${userOneId}_${userTwoId}`;

      return prisma.$transaction(async (tx) => {
        // 1. Explicitly acquire connection-scoped advisory lock
        const lockRows: any = await tx.$queryRaw`SELECT GET_LOCK(${lockKey}, 10) as lockAcquired`;
        const acquired = Number(lockRows?.[0]?.lockAcquired);
        if (acquired !== 1) {
          throw new Error('System is busy processing this invitation');
        }

        try {
          // 2. Atomic conditional update
          const updateResult = await tx.connectionInvitation.updateMany({
            where: {
              id: invId,
              status: 'PENDING'
            },
            data: {
              status: 'ACCEPTED',
              acceptedAt: new Date()
            }
          });

          if (updateResult.count === 0) {
            throw new Error('Invitation is already accepted');
          }

          const updatedInv = await tx.connectionInvitation.findUniqueOrThrow({
            where: { id: invId }
          });

          await tx.connection.upsert({
            where: {
              userOneId_userTwoId: { userOneId, userTwoId }
            },
            update: { status: 'ACTIVE' },
            create: {
              userOneId,
              userTwoId,
              status: 'ACTIVE'
            }
          });

          let conv = await tx.conversation.findFirst({
            where: {
              OR: [
                { userA: userOneId, userB: userTwoId },
                { userA: userTwoId, userB: userOneId }
              ]
            }
          });

          if (!conv) {
            conv = await tx.conversation.create({
              data: {
                name: 'Chat',
                role: sender.role,
                status: 'active',
                userA: userOneId,
                userB: userTwoId,
                msg: invitation.firstMessage || 'Connected on Go Experts',
                time: new Date().toISOString()
              }
            });

            if (invitation.firstMessage) {
              await tx.message.create({
                data: {
                  conversationId: conv.id,
                  from: sender.fullName,
                  senderId: sender.id,
                  text: invitation.firstMessage,
                  time: new Date().toISOString()
                }
              });
            }
          }

          return { updated: updatedInv, conversation: conv };
        } finally {
          await tx.$queryRaw`SELECT RELEASE_LOCK(${lockKey})`.catch(() => {});
        }
      }, {
        isolationLevel: 'ReadCommitted',
        timeout: 15000,
        maxWait: 5000
      });
    };

    // Launch 5 parallel accept attempts simultaneously
    const acceptAttempts = [1, 2, 3, 4, 5].map((idx) =>
      acceptInvitationTx(invitation.id).then(
        (data) => ({ worker: idx, status: 'success', data }),
        (err) => ({ worker: idx, status: 'rejected', message: err.message })
      )
    );

    const acceptResults = await Promise.all(acceptAttempts);

    const acceptSuccesses = acceptResults.filter((r) => r.status === 'success');
    const acceptRejections = acceptResults.filter((r) => r.status === 'rejected');

    // DB Verification
    const [uOne, uTwo] = [sender.id, receiver.id].sort();
    const finalConnections = await prisma.connection.count({
      where: { userOneId: uOne, userTwoId: uTwo, status: 'ACTIVE' }
    });
    const finalConversations = await prisma.conversation.count({
      where: {
        OR: [
          { userA: uOne, userB: uTwo },
          { userA: uTwo, userB: uOne }
        ]
      }
    });
    const finalMessages = await prisma.message.count({
      where: { senderId: sender.id, text: invitation.firstMessage }
    });
    const finalInv = await prisma.connectionInvitation.findUnique({
      where: { id: invitation.id }
    });

    const passed =
      acceptSuccesses.length === 1 &&
      acceptRejections.length === 4 &&
      finalConnections === 1 &&
      finalConversations === 1 &&
      finalMessages === 1 &&
      finalInv?.status === 'ACCEPTED';

    results.push({
      step: '5-Worker Concurrent Invitation Acceptance Race',
      passed,
      details: {
        successes: acceptSuccesses.length,
        rejections: acceptRejections.length,
        connectionsInDb: finalConnections,
        conversationsInDb: finalConversations,
        initialMessagesInDb: finalMessages,
        finalInvitationStatus: finalInv?.status
      }
    });

    console.log(`  -> 5 Concurrent Accepts: ${acceptSuccesses.length} WON, ${acceptRejections.length} SAFELY REJECTED`);
    console.log(`  -> Active Connections created: ${finalConnections} (Expected: 1)`);
    console.log(`  -> Conversations created: ${finalConversations} (Expected: 1)`);
    console.log(`  -> Initial Messages created: ${finalMessages} (Expected: 1)`);
    console.log(`  -> Atomic Acceptance Serialization: ${passed ? 'VERIFIED (PASS)' : 'FAILED'}\n`);

    // Teardown
    await prisma.message.deleteMany({ where: { senderId: sender.id } });
    await prisma.conversation.deleteMany({
      where: {
        OR: [
          { userA: uOne, userB: uTwo },
          { userA: uTwo, userB: uOne }
        ]
      }
    });
    await prisma.connection.deleteMany({
      where: { userOneId: uOne, userTwoId: uTwo }
    });
    await prisma.connectionInvitation.deleteMany({
      where: { id: invitation.id }
    });
    await prisma.user.deleteMany({ where: { id: { in: [sender.id, receiver.id] } } });
  } catch (err: any) {
    results.push({ step: '5-Worker Concurrent Acceptance Race', passed: false, details: err.message });
    console.error('  -> Failed:', err.message);
  }

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('===============================================================');
  console.log('                 FINAL TEST EVIDENCE SUMMARY                   ');
  console.log('===============================================================');
  const allPassed = results.every((r) => r.passed);
  results.forEach((r, idx) => {
    console.log(`${idx + 1}. [${r.passed ? 'PASS' : 'FAIL'}] ${r.step}`);
  });
  console.log('---------------------------------------------------------------');
  console.log(`Overall Result: ${allPassed ? 'ALL CONCURRENCY GUARANTEES VERIFIED' : 'TESTS FAILED'}`);
  console.log('===============================================================\n');

  await prisma.$disconnect();
  return { allPassed, results };
}

runAdvisoryLockVerification().catch(async (e) => {
  console.error('Fatal test error:', e);
  await prisma.$disconnect();
  process.exit(1);
});
