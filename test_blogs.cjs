const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const allBlogs = await prisma.blog.findMany({
    where: { status: 'active', deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  console.log('Total active blogs in DB:', allBlogs.length);

  const now = new Date();
  console.log('Server NOW:', now.toISOString(), now.toString());

  const visibleBlogs = allBlogs.filter((blog) => {
    if (!blog.publishDate) {
       console.log('Blog', blog.title, 'has no publishDate -> Visible');
       return true;
    }
    const pDate = new Date(blog.publishDate);
    if (blog.publishTime) {
      const parts = blog.publishTime.split(':');
      if (parts.length >= 2) {
        const hours = parseInt(parts[0], 10);
        const minutes = parseInt(parts[1], 10);
        if (!isNaN(hours) && !isNaN(minutes)) {
          pDate.setHours(hours, minutes, 0, 0);
        }
      }
    }
    console.log('Blog:', blog.title, '| pDate:', pDate.toISOString(), '| Visible?', pDate <= now);
    return pDate <= now;
  });

  console.log('Visible blogs:', visibleBlogs.length);
}

main().catch(console.error).finally(() => prisma.$disconnect());
