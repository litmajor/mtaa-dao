
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = './backups';

// Ensure backup directory exists
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

async function backupDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found');
    process.exit(1);
  }

  const backupFile = path.join(backupDir, `database_backup_${timestamp}.sql`);
  
  return new Promise((resolve, reject) => {
    exec(`pg_dump "${databaseUrl}" > "${backupFile}"`, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Database backup failed:', error);
        reject(error);
      } else {
        console.log(`✅ Database backup created: ${backupFile}`);
        resolve(backupFile);
      }
    });
  });
}

async function backupFiles() {
  const backupFile = path.join(backupDir, `files_backup_${timestamp}.tar.gz`);
  
  return new Promise((resolve, reject) => {
    exec(`tar -czf "${backupFile}" --exclude=node_modules --exclude=.git --exclude=logs --exclude=backups .`, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Files backup failed:', error);
        reject(error);
      } else {
        console.log(`✅ Files backup created: ${backupFile}`);
        resolve(backupFile);
      }
    });
  });
}

async function main() {
  try {
    console.log('🔄 Starting backup process...');
    
    await Promise.all([
      backupDatabase(),
      backupFiles()
    ]);
    
    console.log('✅ Backup process completed successfully');
  } catch (error) {
    console.error('❌ Backup process failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { backupDatabase, backupFiles };
