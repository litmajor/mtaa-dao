import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

const DOCS_BASE_URL = 'https://mtaadao.com/docs-site';

interface PageEntry {
  path: string;
  lastmod: string;
}

function getAllPages(dir: string, basePath = ''): PageEntry[] {
  const pages: PageEntry[] = [];
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    const relativePath = basePath ? `${basePath}/${file}` : file;

    // Skip hidden files, directories, and non-markdown files
    if (file.startsWith('.') || file.startsWith('_')) return;

    if (stat.isDirectory()) {
      // Recursively get pages from subdirectories
      pages.push(...getAllPages(filePath, relativePath));
    } else if (file.endsWith('.mdx') || file.endsWith('.md')) {
      // Convert file path to URL path
      let urlPath = relativePath
        .replace(/\.mdx?$/, '') // Remove extension
        .replace(/\/index$/, ''); // Remove /index suffix

      pages.push({
        path: urlPath,
        lastmod: new Date(stat.mtime).toISOString().split('T')[0]
      });
    }
  });

  return pages;
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const pagesDir = path.join(process.cwd(), 'pages');
  const pages = getAllPages(pagesDir);

  // Sort pages by path
  pages.sort((a, b) => a.path.localeCompare(b.path));

  // Generate XML
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  pages.forEach(page => {
    const url = page.path ? `${DOCS_BASE_URL}/${page.path}` : DOCS_BASE_URL;
    const priority = page.path === '' ? '0.9' : '0.7';
    
    xml += '  <url>\n';
    xml += `    <loc>${url}</loc>\n`;
    xml += `    <lastmod>${page.lastmod}</lastmod>\n`;
    xml += '    <changefreq>monthly</changefreq>\n';
    xml += `    <priority>${priority}</priority>\n`;
    xml += '  </url>\n';
  });

  xml += '</urlset>';

  res.setHeader('Content-Type', 'application/xml');
  res.write(xml);
  res.end();
}
