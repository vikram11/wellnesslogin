const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

p.$connect()
  .then(() =>
    p.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Notification" (
      id VARCHAR NOT NULL DEFAULT gen_random_uuid(),
      label VARCHAR NOT NULL,
      time VARCHAR NOT NULL,
      type VARCHAR NOT NULL DEFAULT 'custom',
      enabled BOOLEAN NOT NULL DEFAULT true,
      days_of_week VARCHAR NOT NULL DEFAULT '[1,2,3,4,5,6,7]',
      created_at TIMESTAMP NOT NULL DEFAULT now(),
      updated_at TIMESTAMP NOT NULL DEFAULT now(),
      PRIMARY KEY (id)
    )`)
  )
  .then(() => {
    console.log('Notification table created');
    return p.$disconnect();
  })
  .catch((e) => {
    console.error('Error:', e.message);
    return p.$disconnect();
  });