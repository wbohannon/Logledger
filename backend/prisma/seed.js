const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.client.findFirst();
  if (existing) return;
  await prisma.client.create({
    data: {
      name: 'Default Client',
      hourlyRate: 75,
    },
  });
  console.log('Seeded Default Client');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
