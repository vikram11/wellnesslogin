const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();
const sql = fs.readFileSync('/app/create_daily_email_schedule.sql', 'utf8');

prisma.$connect()
  .then(() => prisma.$executeRawUnsafe(sql))
  .then(() => {
    console.log('Table created successfully');
    return prisma.$disconnect();
  })
  .catch((e) => {
    console.error('Error:', e.message);
    return prisma.$disconnect();
  });