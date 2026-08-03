import fs from 'fs';
import path from 'path';

const root = process.cwd();
const distDir = path.resolve(root, 'server', 'dist');
const assets = [
  {
    source: path.resolve(root, 'server', 'services', 'tokens.config.json'),
    target: path.resolve(distDir, 'tokens.config.json'),
    required: true,
  },
  {
    source: path.resolve(root, 'server', 'exchanges.config.json'),
    target: path.resolve(distDir, 'exchanges.config.json'),
    required: false,
  },
  {
    source: path.resolve(root, 'server', 'assets.override.json'),
    target: path.resolve(distDir, 'assets.override.json'),
    required: false,
  },
];

async function copyFile(source, target) {
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  await fs.promises.copyFile(source, target);
}

async function main() {
  if (!fs.existsSync(distDir)) {
    throw new Error(`Build output directory not found: ${distDir}`);
  }

  const copied = [];
  const skipped = [];

  for (const asset of assets) {
    if (!fs.existsSync(asset.source)) {
      if (asset.required) {
        throw new Error(`Required runtime asset is missing: ${asset.source}`);
      }
      skipped.push(asset.source);
      continue;
    }

    await copyFile(asset.source, asset.target);
    copied.push(asset.source);
  }

  console.log(`Copied runtime assets to ${distDir}:`);
  for (const file of copied) {
    console.log(`  - ${path.relative(root, file)}`);
  }
  if (skipped.length > 0) {
    console.log(`Skipped optional assets (not present):`);
    for (const file of skipped) {
      console.log(`  - ${path.relative(root, file)}`);
    }
  }
}

main().catch((error) => {
  console.error('Failed to copy backend runtime assets:', error);
  process.exit(1);
});