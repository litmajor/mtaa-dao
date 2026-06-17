import { promises as fs } from 'fs';
import path from 'path';

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full);
    } else if (entry.isFile()) {
      try {
        const stat = await fs.stat(full);
        if (stat.size <= 4) {
          await fs.unlink(full);
          console.log('removed tiny file', full);
        }
      } catch (e) {
        console.error('error checking file', full, e);
      }
    }
  }
}

const dist = path.resolve(process.cwd(), 'server', 'dist');
fs.access(dist)
  .then(() => walk(dist))
  .catch(() => console.log('server/dist not found, skipping clean'));
