import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function runTest() {
  console.log('--- STARTING QA TEST ---');
  
  const now = new Date();
  const scheduledTime = new Date(now.getTime() + 5000);
  
  const testBlog = await prisma.blog.create({
    data: {
      title: 'QA Scheduled Publishing Test',
      slug: 'qa-scheduled-publishing-test',
      description: '<p>This is a test post.</p>',
      category: 'General',
      author: 'QA Bot',
      status: 'SCHEDULED',
      scheduledAt: scheduledTime
    }
  });
  
  console.log('1. Created Blog:', testBlog.slug, 'scheduled at', scheduledTime.toISOString());
  
  const publicCheck1 = await prisma.blog.findFirst({
    where: { 
      slug: testBlog.slug, 
      status: 'PUBLISHED',
      publishedAt: { lte: new Date() }
    }
  });
  console.log('2. Before schedule - is it public?', publicCheck1 ? 'YES (FAIL)' : 'NO (PASS)');
  
  console.log('3. Waiting 35 seconds for scheduler ticker...');
  await new Promise(r => setTimeout(r, 35000));
  
  const updatedBlog = await prisma.blog.findUnique({ where: { id: testBlog.id } });
  console.log('4. After scheduler - Status:', updatedBlog?.status);
  
  const publicCheck2 = await prisma.blog.findFirst({
    where: { 
      slug: testBlog.slug, 
      status: 'PUBLISHED',
      publishedAt: { lte: new Date() }
    }
  });
  console.log('5. After schedule - is it public?', publicCheck2 ? 'YES (PASS)' : 'NO (FAIL)');
  
  await prisma.blog.delete({ where: { id: testBlog.id } });
  console.log('6. Cleaned up QA record.');
  
  console.log('--- QA TEST COMPLETE ---');
}

runTest().catch(console.error).finally(() => process.exit(0));
