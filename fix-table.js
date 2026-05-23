const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

p.$connect()
  .then(() => p.$executeRawUnsafe('DROP TABLE IF EXISTS "DailyEmailSchedule"'))
  .then(() =>
    p.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "DailyEmailSchedule" (
      id VARCHAR NOT NULL DEFAULT gen_random_uuid(),
      enabled BOOLEAN NOT NULL DEFAULT false,
      send_time VARCHAR NOT NULL DEFAULT '08:00',
      recipient_ids TEXT NOT NULL DEFAULT '[]',
      created_at TIMESTAMP NOT NULL DEFAULT now(),
      updated_at TIMESTAMP NOT NULL DEFAULT now(),
      PRIMARY KEY (id)
    )`)
  )
  .then(() => p.dailyEmailSchedule.findFirst())
  .then((r) => {
    console.log(JSON.stringify(r, null, 2));
    return p.$disconnect();
  })
  .catch((e) => {
    console.error('Error:', e.message);
    return p.$disconnect();
  });