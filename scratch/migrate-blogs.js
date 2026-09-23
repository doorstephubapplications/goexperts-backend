import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const slugify = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
async function main() {
  const blogs = await prisma.blog.findMany();
  for (const blog of blogs) {
    let candidate = slugify(blog.title) || 'blog-' + blog.id.slice(0, 8);
    let counter = 1;
    while (await prisma.blog.findFirst({ where: { slug: candidate, id: { not: blog.id } } })) {
      counter++;
      candidate = slugify(blog.title) + '-' + counter;
    }
    let status = blog.status === 'active' ? 'PUBLISHED' : (blog.status === 'draft' ? 'DRAFT' : blog.status);
    await prisma.blog.update({
      where: { id: blog.id },
      data: { slug: candidate, status, publishedAt: blog.publishedAt || blog.publishDate || blog.createdAt }
    });
    console.log('Updated', candidate);
  }
}
main().finally(() => prisma.$disconnect());
