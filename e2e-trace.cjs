const http = require('http');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('1. Fetching published job...');
  const job = await prisma.jobOpening.findFirst({ where: { status: 'published' } });
  if (!job) throw new Error('No published job found');
  console.log('Found Job:', job.slug, job.id);

  console.log('2. Mocking Resume Upload API behavior (we know it uses multer)...');
  const resumeUrl = '/uploads/general/unknown/dummy-resume.pdf';

  console.log('3. Submitting application...');
  const payload = {
    jobId: job.id,
    firstName: 'Trace',
    lastName: 'User',
    email: 'trace@example.com',
    phone: '0987654321',
    currentLocation: 'San Francisco, CA',
    experienceYears: 5,
    resumeUrl: resumeUrl,
    resumeFileName: 'dummy-resume.pdf'
  };

  const postData = JSON.stringify(payload);
  
  const options = {
    hostname: 'localhost',
    port: 5001,
    path: '/api/v1/public/jobs/' + job.id + '/apply',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = http.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', async () => {
      console.log('Apply API Status:', res.statusCode);
      console.log('Apply API Response:', body);
      
      const json = JSON.parse(body);
      if(!json.success) {
        console.error('API failed');
        process.exit(1);
      }

      console.log('4. Verifying in DB...');
      const appNumber = json.data?.applicationNumber || json.applicationNumber || json.referenceNumber || json.data?.referenceNumber;
      if (!appNumber) {
        console.error('No application number returned');
        console.log(json);
        process.exit(1);
      }
      const app = await prisma.careerApplication.findFirst({ where: { applicationNumber: appNumber } });
      console.log('DB Application Found:', !!app, app?.applicationNumber);
      process.exit(0);
    });
  });

  req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
    process.exit(1);
  });

  req.write(postData);
  req.end();
}

run().catch(e => { console.error(e); process.exit(1); });
