import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';

async function seedDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  console.log('🌱 Starting database seeding...');

  try {
    const client = postgres(process.env.DATABASE_URL);
    const db = drizzle(client);

    // Add your seed data here
    // Example:
    // await db.insert(users).values([
    //   { id: 1, name: 'Admin', email: 'admin@mtaadao.org' },
    // ]);

    console.log('✅ Database seeding completed successfully');
    await client.end();
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seedDatabase();
