import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function seed() {
  console.log("Starting seeding referral campaign and rules...");

  // Create a default campaign
  const campaign = await prisma.referralCampaign.create({
    data: {
      name: "Standard Industry Referral Program",
      status: "ACTIVE",
      rewardType: "CASH", 
    }
  });

  const industries = [
    "Technology",
    "Healthcare",
    "Finance",
    "Education",
    "Real Estate",
    "E-commerce",
    "Marketing",
    "Design"
  ];
  
  // Seed industry-level rules
  for (const industry of industries) {
    await prisma.referralRule.create({
      data: {
        campaignId: campaign.id,
        referrerRole: "ANY",
        referredRole: "ANY",
        qualification: "ACCOUNT_ACTIVATION", // Example qualification event
        rewardAmount: 100.0, // Example reward amount
        rewardType: "CASH",
        industry: industry,
      }
    });
  }
  
  console.log("Successfully seeded Industry Level Referral Campaign and Rules!");
}

seed().catch(e => {
  console.error("Error during seeding:", e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
