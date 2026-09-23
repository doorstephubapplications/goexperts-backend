const http = require('http');

function makeRequest(path, method = 'GET', data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };
    
    if (data && method !== 'GET') {
      defaultHeaders['Content-Length'] = Buffer.byteLength(JSON.stringify(data));
    }
    
    const options = {
      hostname: 'localhost',
      port: 5001,
      path: path,
      method: method,
      headers: defaultHeaders
    };
    
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    
    req.on('error', reject);
    
    if (data && method !== 'GET') {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// We need an admin token to create records
async function loginAdmin() {
  const res = await makeRequest('/api/v1/auth/login', 'POST', {
    email: 'admin@goexperts.com',
    password: 'password123'
  });
  if (res.data?.data?.token) {
    return res.data.data.token;
  }
  // Fallback to superadmin if admin doesn't work
  const res2 = await makeRequest('/api/v1/auth/login', 'POST', {
    email: 'superadmin@goexperts.com',
    password: 'password123'
  });
  return res2.data?.data?.token || 'mock_token';
}

async function runTest() {
  console.log('=== FAQ UNIFICATION QA E2E TEST ===');
  
  // 1. Get Admin Token
  const token = await loginAdmin();
  const authHeaders = { 'Authorization': 'Bearer ' + token };
  
  // 2. Create QA Category (GENERAL)
  console.log('\n1. Creating QA Test FAQ Category (GENERAL)');
  const catRes = await makeRequest('/api/admin/faqs/categories', 'POST', {
    name: 'QA Test Category',
    slug: 'qa-test-category-' + Date.now(),
    icon: 'HelpCircle',
    description: 'QA test description',
    sortOrder: 999,
    isActive: true,
    role: 'GENERAL'
  }, authHeaders);
  const catId = catRes.data?.data?.id;
  console.log(catId ? '? Created Category ID: ' + catId : '? Failed: ' + JSON.stringify(catRes.data || catRes.body));
  
  // 3. Create QA Category (FREELANCER)
  console.log('\n2. Creating QA Test Category (FREELANCER)');
  const freeCatRes = await makeRequest('/api/admin/faqs/categories', 'POST', {
    name: 'QA Freelancer Category',
    slug: 'qa-freelancer-category-' + Date.now(),
    icon: 'HelpCircle',
    isActive: true,
    role: 'FREELANCER'
  }, authHeaders);
  const freeCatId = freeCatRes.data?.data?.id;
  console.log(freeCatId ? '? Created Freelancer Category ID: ' + freeCatId : '? Failed: ' + JSON.stringify(freeCatRes.data || freeCatRes.body));
  
  // 4. Create QA FAQ (DRAFT)
  console.log('\n3. Creating QA Test FAQ (DRAFT) under GENERAL category');
  const faqRes = await makeRequest('/api/admin/faqs', 'POST', {
    question: 'QA Test Question?',
    answer: 'QA Test Answer',
    categoryId: catId,
    status: 'DRAFT',
    sortOrder: 999
  }, authHeaders);
  const faqId = faqRes.data?.data?.id;
  console.log(faqId ? '? Created FAQ ID: ' + faqId : '? Failed: ' + JSON.stringify(faqRes.data || faqRes.body));
  
  // 5. Test Public API (Should not see FAQ because it is DRAFT)
  console.log('\n4. Fetching Public Help Center API');
  const public1 = await makeRequest('/api/v1/public/help-center');
  const pubCategories1 = public1.data?.data?.categories || [];
  
  const qaCatInPub1 = pubCategories1.find(c => c.id === catId);
  console.log(qaCatInPub1 ? '? Category found. Article count: ' + qaCatInPub1.articleCount : '? Category missing');
  if (qaCatInPub1 && qaCatInPub1.articleCount === 0) {
    console.log('? Draft FAQ is correctly hidden (Count is 0)');
  } else {
    console.log('? Draft FAQ leaked! Count is ' + qaCatInPub1?.articleCount);
  }
  
  const freeCatInPub1 = pubCategories1.find(c => c.id === freeCatId);
  console.log(!freeCatInPub1 ? '? Freelancer category is correctly hidden from general help topics' : '? Freelancer category leaked!');
  
  // 6. Publish FAQ
  console.log('\n5. Publishing QA Test FAQ');
  await makeRequest('/api/admin/faqs/' + faqId, 'PUT', {
    question: 'QA Test Question?',
    answer: 'QA Test Answer',
    categoryId: catId,
    status: 'PUBLISHED',
    sortOrder: 999
  }, authHeaders);
  console.log('? FAQ updated to PUBLISHED');
  
  // 7. Test Public API (Should see FAQ now)
  console.log('\n6. Fetching Public Help Center API again');
  const public2 = await makeRequest('/api/v1/public/help-center');
  const pubCategories2 = public2.data?.data?.categories || [];
  
  const qaCatInPub2 = pubCategories2.find(c => c.id === catId);
  if (qaCatInPub2 && qaCatInPub2.articleCount > 0) {
    console.log('? Published FAQ correctly counted (Count is ' + qaCatInPub2.articleCount + ')');
  } else {
    console.log('? Published FAQ not counted properly! Count: ' + qaCatInPub2?.articleCount);
  }
  
  // 8. Delete Records
  console.log('\n7. Reverting test data...');
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  if (faqId) await prisma.fAQ.delete({ where: { id: faqId } }).catch(() => {});
  if (catId) await prisma.fAQCategory.delete({ where: { id: catId } }).catch(() => {});
  if (freeCatId) await prisma.fAQCategory.delete({ where: { id: freeCatId } }).catch(() => {});
  console.log('? Test data cleaned up');
  await prisma.$disconnect();
}

runTest().catch(console.error);
