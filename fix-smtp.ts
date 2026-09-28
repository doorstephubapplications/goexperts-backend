import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const channel = await prisma.communicationChannel.findFirst({
    where: { name: 'email', status: 'active' }
  });

  if (channel) {
    console.log('Found active email channel, updating config to use .env values...');
    
    // We can either delete it so it falls back to .env, or update it with .env values
    // Let's just disable it so it falls back to .env
    await prisma.communicationChannel.update({
      where: { id: channel.id },
      data: { status: 'inactive' }
    });
    
    console.log('Email channel deactivated. The system will now use the .env credentials.');
  } else {
    console.log('No active email channel found in DB. The system is already using .env credentials.');
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
