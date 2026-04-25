const { PrismaClient } = require('@prisma/client');
const { NotFoundError } = require('../utils/errors');

const prisma = new PrismaClient();

async function findAll() {
  return prisma.client.findMany({ orderBy: { createdAt: 'desc' } });
}

async function findById(id) {
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) throw new NotFoundError('Client');
  return client;
}

async function create(data) {
  return prisma.client.create({
    data: {
      name: data.name,
      hourlyRate: data.hourlyRate,
      jiraProjectKey: data.jiraProjectKey ?? null,
      billingEmail: data.billingEmail ?? null,
    },
  });
}

async function update(id, data) {
  await findById(id);
  return prisma.client.update({
    where: { id },
    data: {
      ...(data.name != null && { name: data.name }),
      ...(data.hourlyRate != null && { hourlyRate: data.hourlyRate }),
      ...(data.jiraProjectKey !== undefined && { jiraProjectKey: data.jiraProjectKey || null }),
      ...(data.billingEmail !== undefined && { billingEmail: data.billingEmail || null }),
    },
  });
}

async function remove(id) {
  await findById(id);
  await prisma.client.delete({ where: { id } });
  return { deleted: true };
}

module.exports = { findAll, findById, create, update, remove };
