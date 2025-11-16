import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  console.log('Starting database migrations...');
  console.log(`Database URL: ${process.env.DATABASE_URL.split('@')[1]}`);

  try {
    const client = postgres(process.env.DATABASE_URL, { max: 1 });
    const db = drizzle(client);

    console.log('Running migrations...');
    await migrate(db, { migrationsFolder: './migrations' });

    console.log('✅ Migrations completed successfully');
    await client.end();
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
