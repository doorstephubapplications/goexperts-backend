import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';

const prisma = new PrismaClient();
const API_BASE = "http://localhost:5001/api/v2"; 
const JWT_SECRET = process.env.JWT_SECRET || "dev_jwt_secret_key_change_me_in_production";

async function generateToken(user: any) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
}

async function runTests() {
  console.log("Starting Backend E2E Tests Phase 6B...");
  const timestamp = Date.now();
  
  // 1. Create Test Users
  console.log("Creating test users...");
  const passwordHash = await bcrypt.hash("TestPassword123!", 10);
  
  const client = await prisma.user.create({
    data: {
      email: `e2e-client-${timestamp}@example.test`,
      password: passwordHash,
      fullName: "E2E Client",
      role: "CLIENT",
      status: "ACTIVE"
    }
  });

  const founder = await prisma.user.create({
    data: {
      email: `e2e-founder-${timestamp}@example.test`,
      password: passwordHash,
      fullName: "E2E Founder",
      role: "FOUNDER",
      status: "ACTIVE"
    }
  });

  const freelancer = await prisma.user.create({
    data: {
      email: `e2e-freelancer-${timestamp}@example.test`,
      password: passwordHash,
      fullName: "E2E Freelancer",
      role: "FREELANCER",
      status: "ACTIVE"
    }
  });

  const investor = await prisma.user.create({
    data: {
      email: `e2e-investor-${timestamp}@example.test`,
      password: passwordHash,
      fullName: "E2E Investor",
      role: "INVESTOR",
      status: "ACTIVE"
    }
  });

  const clientToken = await generateToken(client);
  const founderToken = await generateToken(founder);
  const freelancerToken = await generateToken(freelancer);
  const investorToken = await generateToken(investor);

  const fetchApi = async (path: string, token: string, options: any = {}) => {
    let res = await fetch(`http://localhost:5001/api/v2${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    if (res.status === 404) {
      res = await fetch(`http://localhost:5001/api${path}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...(options.headers || {})
        }
      });
    }
    return res;
  };

  const results: any[] = [];
  
  // TEST 1 — CLIENT → FOUNDER FIRST MESSAGE
  console.log("Running Test 1: Client -> Founder First Message");
  let res1 = await fetchApi("/messages/conversations", clientToken, {
    method: "POST",
    body: JSON.stringify({
      recipientId: founder.id,
      initialMessage: "Hello Founder",
      contextType: "STARTUP"
    })
  });
  
  let json1 = await res1.json();
  let pass1 = json1.message === "Connection request sent" || json1.data?.status === "PENDING";
  
  let inv1 = await prisma.connectionInvitation.findFirst({
    where: { senderId: client.id, receiverId: founder.id }
  });
  let activeConn1 = await prisma.connection.findFirst({
    where: { OR: [{ userOneId: client.id, userTwoId: founder.id }, { userOneId: founder.id, userTwoId: client.id }] }
  });
  
  results.push({ test: "Test 1: Client -> Founder First Message", pass: pass1 && inv1 && inv1.status === "PENDING" && !activeConn1, data: json1, invId: inv1?.id });

  // TEST 2 — FOUNDER ACCEPTS
  console.log("Running Test 2: Founder Accepts");
  let pass2 = false;
  if (inv1) {
    let res2 = await fetchApi(`/connections/invitations/${inv1.id}/accept`, founderToken, { method: "PATCH" });
    let json2 = await res2.json();
    
    let inv2 = await prisma.connectionInvitation.findUnique({ where: { id: inv1.id } });
    let activeConn2 = await prisma.connection.findFirst({
      where: { OR: [{ userOneId: client.id, userTwoId: founder.id }, { userOneId: founder.id, userTwoId: client.id }] }
    });
    let conv2 = await prisma.conversation.findFirst({
      where: {
        OR: [
          { userA: client.id, userB: founder.id },
          { userA: founder.id, userB: client.id }
        ]
      }
    });
    
    pass2 = inv2?.status === "ACCEPTED" && !!activeConn2 && !!conv2;
    results.push({ test: "Test 2: Founder Accepts", pass: pass2, data: json2 });
  }

  // REPEATED ACCEPT
  console.log("Running Repeated Accept");
  if (inv1) {
    let repAccRes = await fetchApi(`/connections/invitations/${inv1.id}/accept`, founderToken, { method: "PATCH" });
    let repAccJson = await repAccRes.json();
    
    let activeConnCount = await prisma.connection.count({
      where: { OR: [{ userOneId: client.id, userTwoId: founder.id }, { userOneId: founder.id, userTwoId: client.id }] }
    });
    let convCount = await prisma.conversation.count({
      where: {
        OR: [
          { userA: client.id, userB: founder.id },
          { userA: founder.id, userB: client.id }
        ]
      }
    });
    
    results.push({ test: "Repeated Accept", pass: activeConnCount === 1 && convCount === 1, data: repAccJson });
  }

  // TEST 3 — ALREADY CONNECTED CHAT
  console.log("Running Test 3: Already Connected Chat");
  let res3 = await fetchApi("/messages/conversations", clientToken, {
    method: "POST",
    body: JSON.stringify({
      recipientId: founder.id,
      initialMessage: "Second message",
      contextType: "STARTUP"
    })
  });
  let json3 = await res3.json();
  let duplicateInv = await prisma.connectionInvitation.count({
    where: { senderId: client.id, receiverId: founder.id }
  });
  let duplicateConn = await prisma.connection.count({
    where: { OR: [{ userOneId: client.id, userTwoId: founder.id }, { userOneId: founder.id, userTwoId: client.id }] }
  });
  let pass3 = duplicateInv === 1 && duplicateConn === 1 && !!json3.message?.id;
  results.push({ test: "Test 3: Already Connected Chat", pass: pass3, data: json3 });

  // TEST 4 — FREELANCER → INVESTOR
  console.log("Running Test 4: Freelancer -> Investor First Message");
  let res4 = await fetchApi("/messages/conversations", freelancerToken, {
    method: "POST",
    body: JSON.stringify({
      recipientId: investor.id,
      initialMessage: "Hello Investor",
      contextType: "INVESTOR"
    })
  });
  let json4 = await res4.json();
  let inv4 = await prisma.connectionInvitation.findFirst({
    where: { senderId: freelancer.id, receiverId: investor.id }
  });
  let activeConn4 = await prisma.connection.findFirst({
    where: { OR: [{ userOneId: freelancer.id, userTwoId: investor.id }, { userOneId: investor.id, userTwoId: freelancer.id }] }
  });
  let pass4 = json4.message === "Connection request sent" && inv4?.status === "PENDING" && !activeConn4;
  results.push({ test: "Test 4: Freelancer -> Investor First Message", pass: pass4, data: json4, invId: inv4?.id });

  // TEST 5 — INVESTOR REJECTS
  console.log("Running Test 5: Investor Rejects");
  let pass5 = false;
  if (inv4) {
    let res5 = await fetchApi(`/connections/invitations/${inv4.id}/reject`, investorToken, { method: "PATCH" });
    let json5 = await res5.json();
    let inv5 = await prisma.connectionInvitation.findUnique({ where: { id: inv4.id } });
    let activeConn5 = await prisma.connection.findFirst({
      where: { OR: [{ userOneId: freelancer.id, userTwoId: investor.id }, { userOneId: investor.id, userTwoId: freelancer.id }] }
    });
    pass5 = inv5?.status === "REJECTED" && !activeConn5;
    results.push({ test: "Test 5: Investor Rejects", pass: pass5, data: json5 });
  }

  // REPEATED REJECT
  console.log("Running Repeated Reject");
  if (inv4) {
    let repRejRes = await fetchApi(`/connections/invitations/${inv4.id}/reject`, investorToken, { method: "PATCH" });
    let repRejJson = await repRejRes.json();
    let invRepRej = await prisma.connectionInvitation.findUnique({ where: { id: inv4.id } });
    results.push({ test: "Repeated Reject", pass: invRepRej?.status === "REJECTED", data: repRejJson });
  }

  // TEST 6 — INVESTOR → FREELANCER
  console.log("Running Test 6: Investor -> Freelancer");
  let res6 = await fetchApi("/messages/conversations", investorToken, {
    method: "POST",
    body: JSON.stringify({
      recipientId: freelancer.id,
      initialMessage: "Hello Freelancer",
      contextType: "FREELANCER"
    })
  });
  let json6 = await res6.json();
  let inv6 = await prisma.connectionInvitation.findFirst({
    where: { senderId: investor.id, receiverId: freelancer.id }
  });
  let pass6 = json6.message === "Connection invitation already exists or was rejected";
  results.push({ test: "Test 6: Investor -> Freelancer (Re-request rule expects failure)", pass: pass6, data: json6 });

  // TEST 7 — READ TRACKING
  console.log("Running Test 7 & 8: Read Tracking and Unread Count");
  const msgId = json3.message?.id;
  let pass7 = false;
  let pass8 = false;
  
  // AUTHORIZATION CHECKS
  let authTests = [];
  
  if (msgId) {
    // Check initial unread count
    let getUnread = await fetchApi("/messages/conversations", founderToken);
    let unreadData1 = await getUnread.json();
    let convUnread = (unreadData1.rows || []).find((c: any) => c.id === json3.conversation.id);
    let initialUnreadCount = convUnread?.unread || 0;

    // Msg Auth C & E: Investor tries to mark Client's message read (Unrelated convo)
    let authResMsg1 = await fetchApi(`/messages/${msgId}/read`, investorToken, { method: "PATCH" });
    authTests.push({ test: "E. User A cannot mark unrelated message read", pass: authResMsg1.status === 403 || authResMsg1.status === 404, status: authResMsg1.status });

    // Msg Auth D: Sender (Client) tries to mark own message read
    let authResMsg2 = await fetchApi(`/messages/${msgId}/read`, clientToken, { method: "PATCH" });
    authTests.push({ test: "D. Sender cannot mark own message read", pass: authResMsg2.status === 403 || authResMsg2.status === 400 || authResMsg2.status === 404, status: authResMsg2.status });

    // Valid Read
    let res7 = await fetchApi(`/messages/${msgId}/read`, founderToken, { method: "PATCH" });
    let json7 = await res7.json();
    
    let dbMsg = await prisma.message.findUnique({ where: { id: msgId } });
    pass7 = dbMsg?.readAt !== null;
    results.push({ test: "Test 7: Read Tracking", pass: pass7, data: json7 });

    let getUnread2 = await fetchApi("/messages/conversations", founderToken);
    let unreadData2 = await getUnread2.json();
    let convUnread2 = (unreadData2.rows || []).find((c: any) => c.id === json3.conversation.id);
    let finalUnreadCount = convUnread2?.unread || 0;
    
    pass8 = initialUnreadCount > 0 && finalUnreadCount === 0;
    results.push({ test: "Test 8: Unread Count Source of Truth", pass: pass8, initialUnreadCount, finalUnreadCount });
  } else {
    results.push({ test: "Test 7 & 8: Read Tracking", pass: false, data: "Could not find msgId from Test 3" });
  }

  // Conversation Auth
  console.log("Running Conversation Auth Checks");
  if (json3.conversation?.id) {
    let authResConv = await fetchApi(`/conversations/${json3.conversation.id}/messages`, investorToken);
    authTests.push({ test: "B. Non-participant cannot access conversation", pass: authResConv.status === 403 || authResConv.status === 404, status: authResConv.status });
  }

  // Invitation Auth
  if (inv1) {
    let authRes1 = await fetchApi(`/connections/invitations/${inv1.id}/accept`, freelancerToken, { method: "PATCH" });
    authTests.push({ test: "A. User A cannot accept User B's invitation", pass: authRes1.status === 403 || authRes1.status === 404, status: authRes1.status });
  }
  if (inv4) {
    let authRes2 = await fetchApi(`/connections/invitations/${inv4.id}/reject`, clientToken, { method: "PATCH" });
    authTests.push({ test: "B. User A cannot reject User B's invitation", pass: authRes2.status === 403 || authRes2.status === 404, status: authRes2.status });
  }

  // OUTPUT JSON
  console.log("\n==================== JSON OUTPUT ====================");
  console.log(JSON.stringify({ results, authTests }, null, 2));
  console.log("=====================================================\n");
  
  // Cleanup
  console.log("Cleaning up test users...");
  await prisma.message.deleteMany({ where: { senderId: { in: [client.id, founder.id, freelancer.id, investor.id] } } });
  await prisma.conversation.deleteMany({ where: { userA: { in: [client.id, founder.id, freelancer.id, investor.id] } } });
  await prisma.connectionInvitation.deleteMany({ where: { senderId: { in: [client.id, founder.id, freelancer.id, investor.id] } } });
  await prisma.connection.deleteMany({ where: { userOneId: { in: [client.id, founder.id, freelancer.id, investor.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [client.id, founder.id, freelancer.id, investor.id] } } });
  console.log("Cleanup done.");

  process.exit(0);
}

runTests().catch(e => {
  console.error("Test failed", e);
  process.exit(1);
});
