const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.$connect()
  .then(() => p.dailyEmailSchedule.findFirst())
  .then(r => { console.log(JSON.stringify(r)); return p.$disconnect(); })
  .catch(e => { console.error(e.message); return p.$disconnect(); });