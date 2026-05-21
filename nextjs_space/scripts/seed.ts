import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with health log data...');

  // BP Readings from the Health Log
  const bpReadings = [
    { date: new Date('2026-05-11T08:00:00'), systolic: 175, diastolic: 72, pulse: null, context: 'morning', notes: 'First recording' },
    { date: new Date('2026-05-11T20:00:00'), systolic: 151, diastolic: 73, pulse: null, context: 'evening', notes: '' },
    { date: new Date('2026-05-13T08:00:00'), systolic: 178, diastolic: 84, pulse: null, context: 'morning', notes: 'Elevated; possibly triggered med change discussion' },
    { date: new Date('2026-05-15T08:00:00'), systolic: 120, diastolic: 55, pulse: null, context: 'post-appointment', notes: 'Post-appointment; post-Nifedipine?' },
    { date: new Date('2026-05-18T06:30:00'), systolic: 124, diastolic: 63, pulse: 71, context: 'pre-meds', notes: 'Self-reported, pre-meds. Feeling okay.' },
    { date: new Date('2026-05-18T08:37:00'), systolic: 132, diastolic: 63, pulse: 67, context: 'post-meds', notes: 'Post-meds. ~1 hr after Carvedilol + Nifedipine.' },
    { date: new Date('2026-05-18T13:30:00'), systolic: 126, diastolic: 58, pulse: 69, context: 'post-lunch', notes: 'Post-lunch (dal + yogurt). Nice stable numbers.' },
    { date: new Date('2026-05-18T17:50:00'), systolic: 123, diastolic: 60, pulse: 73, context: 'evening', notes: 'Evening reading.' },
    { date: new Date('2026-05-18T19:38:00'), systolic: 128, diastolic: 58, pulse: 69, context: 'pre-dinner', notes: 'Before light dinner and PM meds.' },
    { date: new Date('2026-05-19T06:05:00'), systolic: 135, diastolic: 67, pulse: 73, context: 'pre-meds', notes: 'After waking, post-bathroom, pre-meds. Slept well.' },
    { date: new Date('2026-05-20T07:30:00'), systolic: 140, diastolic: 66, pulse: 78, context: 'pre-meds', notes: 'Pre-meds morning reading. AM meds not yet taken.' },
    { date: new Date('2026-05-20T10:37:00'), systolic: 142, diastolic: 62, pulse: 74, context: 'post-meds', notes: '~2h post-meds. Textbook Carvedilol/Nifedipine response.' },
  ];

  for (const bp of bpReadings) {
    await prisma.bpReading.upsert({
      where: { id: `seed-bp-${bp.date.toISOString()}` },
      update: bp,
      create: { id: `seed-bp-${bp.date.toISOString()}`, ...bp },
    });
  }
  console.log(`Seeded ${bpReadings.length} BP readings`);

  // Current Medications
  const medications = [
    { name: 'Carvedilol', dosage: '12.5 mg', timeSlot: 'AM', notes: 'Blood pressure', isActive: true },
    { name: 'Nifedipine ER', dosage: '30 mg', timeSlot: 'AM', notes: 'Extended release. Replaced Valsartan 160mg ~May 14', isActive: true, startDate: new Date('2026-05-14') },
    { name: 'Miralax', dosage: 'PRN', timeSlot: 'AM', notes: 'As needed', isActive: true },
    { name: 'B-Complex', dosage: '1 tab', timeSlot: 'AM', notes: 'Supplement — added May 18', isActive: true, startDate: new Date('2026-05-18') },
    { name: 'Iron', dosage: '65 mg', timeSlot: 'AM', notes: 'Supplement — added May 18', isActive: true, startDate: new Date('2026-05-18') },
    { name: 'Methylprednisolone', dosage: '6 mg', timeSlot: 'MID', notes: '', isActive: true },
    { name: 'Pantoprazole', dosage: '40 mg', timeSlot: 'MID', notes: '', isActive: true },
    { name: 'Vitamin D', dosage: '5000 IU', timeSlot: 'MID', notes: '', isActive: true },
    { name: 'Probiotic', dosage: '1 cap', timeSlot: 'MID', notes: '', isActive: true },
    { name: 'Actemra', dosage: 'Weekly injection (Tuesdays)', timeSlot: 'AM', notes: 'Subcutaneous injection, weekly on Tuesdays', isActive: true },
    { name: 'Multivitamin', dosage: '1 tab', timeSlot: 'MID', notes: '', isActive: true },
    { name: 'Tums', dosage: '1000 mg', timeSlot: 'MID', notes: 'As needed', isActive: true },
    { name: 'Potassium + Magnesium', dosage: '1000mg K + 200mg Mg', timeSlot: 'MID', notes: 'Supplement — added May 18', isActive: true, startDate: new Date('2026-05-18') },
    { name: 'Carvedilol', dosage: '12.5 mg', timeSlot: 'PM', notes: '', isActive: true },
    { name: 'Nifedipine ER', dosage: '30 mg', timeSlot: 'PM', notes: 'Extended release. Same protocol as AM', isActive: true, startDate: new Date('2026-05-14') },
    // Discontinued
    { name: 'Valsartan', dosage: '160 mg', timeSlot: 'AM', notes: 'Discontinued ~May 14, replaced by Nifedipine', isActive: false, endDate: new Date('2026-05-14') },
    { name: 'Valsartan', dosage: '160 mg', timeSlot: 'PM', notes: 'Discontinued ~May 14', isActive: false, endDate: new Date('2026-05-14') },
  ];

  for (const med of medications) {
    const seedId = `seed-med-${med.name}-${med.timeSlot}-${med.isActive}`;
    await prisma.medication.upsert({
      where: { id: seedId },
      update: { ...med },
      create: { id: seedId, ...med },
    });
  }
  console.log(`Seeded ${medications.length} medications`);

  // Medication Logs
  const medLogs = [
    { date: new Date('2026-05-11'), timeSlot: 'AM', medications: JSON.stringify(['Carvedilol', 'Valsartan', 'Miralax']), compliance: true, notes: '' },
    { date: new Date('2026-05-11'), timeSlot: 'MID', medications: JSON.stringify(['Methylprednisolone', 'Pantoprazole', 'Vit D', 'Probiotic', 'Actemra', 'MVI']), compliance: true, notes: '' },
    { date: new Date('2026-05-11'), timeSlot: 'PM', medications: JSON.stringify(['Carvedilol', 'Valsartan']), compliance: true, notes: '' },
    { date: new Date('2026-05-12'), timeSlot: 'AM', medications: JSON.stringify(['Carvedilol', 'Valsartan', 'Miralax']), compliance: true, notes: '' },
    { date: new Date('2026-05-12'), timeSlot: 'MID', medications: JSON.stringify(['All midday meds']), compliance: true, notes: '' },
    { date: new Date('2026-05-12'), timeSlot: 'PM', medications: JSON.stringify(['Carvedilol', 'Valsartan']), compliance: true, notes: '' },
    { date: new Date('2026-05-18T07:30:00'), timeSlot: 'AM', medications: JSON.stringify(['Carvedilol 12.5mg', 'Nifedipine 30mg ER', 'B-Complex', 'Iron 65mg']), compliance: true, notes: '' },
    { date: new Date('2026-05-18T13:00:00'), timeSlot: 'MID', medications: JSON.stringify(['Methylprednisolone', 'Pantoprazole', 'Vit D', 'Probiotic', 'Actemra', 'MVI', 'Tums', 'Potassium 1000mg', 'Magnesium 200mg']), compliance: true, notes: '' },
    { date: new Date('2026-05-18T20:45:00'), timeSlot: 'PM', medications: JSON.stringify(['Carvedilol 12.5mg', 'Nifedipine 30mg ER']), compliance: true, notes: '' },
    { date: new Date('2026-05-19T14:00:00'), timeSlot: 'MID', medications: JSON.stringify(['Methylprednisolone', 'Pantoprazole', 'Vit D', 'Probiotic', 'Actemra', 'MVI', 'Potassium 1000mg', 'Magnesium 200mg']), compliance: true, notes: '' },
    { date: new Date('2026-05-20T08:30:00'), timeSlot: 'AM', medications: JSON.stringify(['Carvedilol 12.5mg', 'Nifedipine 30mg ER']), compliance: true, notes: '' },
  ];

  for (const log of medLogs) {
    const seedId = `seed-medlog-${log.date.toISOString()}-${log.timeSlot}`;
    await prisma.medicationLog.upsert({
      where: { id: seedId },
      update: log,
      create: { id: seedId, ...log },
    });
  }
  console.log(`Seeded ${medLogs.length} medication logs`);

  // Observations
  const observations = [
    { date: new Date('2026-05-12'), category: 'symptom', description: 'Back pain 7/10', severity: 7 },
    { date: new Date('2026-05-12'), category: 'appointment', description: 'Blood work ("Tues - Blood")', severity: null },
    { date: new Date('2026-05-14'), category: 'medication_change', description: 'Transition from Valsartan 160mg to Nifedipine', severity: null },
    { date: new Date('2026-05-14'), category: 'activity', description: 'Gardening — planted', severity: null },
    { date: new Date('2026-05-15'), category: 'appointment', description: 'GI follow-up with Dr. Pandolfi', severity: null },
    { date: new Date('2026-05-15'), category: 'bp_note', description: 'Reading dropped to 120/55 — monitor for hypotension', severity: null },
    { date: new Date('2026-05-18'), category: 'protocol', description: 'Escalation rule: If BP stays in 140s 1-2 hrs after Carvedilol + Nifedipine 30mg ER, add Valsartan 40mg as rescue dose and monitor until BP drops to ~120s.', severity: null },
  ];

  for (const obs of observations) {
    const seedId = `seed-obs-${obs.date.toISOString()}-${obs.category}-${obs.description.substring(0, 20)}`;
    await prisma.observation.upsert({
      where: { id: seedId },
      update: obs,
      create: { id: seedId, ...obs },
    });
  }
  console.log(`Seeded ${observations.length} observations`);

  // Daily Notes
  const dailyNotes = [
    { date: new Date('2026-05-11'), note: 'First day of the tracking week on this chart.' },
    { date: new Date('2026-05-13'), note: 'Elevated BP reading may have prompted discussion about switching from Valsartan to Nifedipine.' },
    { date: new Date('2026-05-14'), note: 'Planted in garden — active, engaged day. Medication change to Nifedipine likely initiated.' },
    { date: new Date('2026-05-16'), note: 'End of tracking week on original chart.' },
    { date: new Date('2026-05-18'), note: 'Good appetite and restful day.' },
    { date: new Date('2026-05-19'), note: 'Woke up at 05:30. Slept well.' },
  ];

  for (const dn of dailyNotes) {
    const seedId = `seed-note-${dn.date.toISOString()}`;
    await prisma.dailyNote.upsert({
      where: { id: seedId },
      update: dn,
      create: { id: seedId, ...dn },
    });
  }
  console.log(`Seeded ${dailyNotes.length} daily notes`);

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
