
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import PDFDocument from 'pdfkit';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function tryWkhtmltopdf(htmlPath, outPath) {
  try {
    // Check availability
    await execFileAsync('wkhtmltopdf', ['--version']);
  } catch (err) {
    return false;
  }

  const args = [
    '--enable-local-file-access',
    '--print-media-type',
    '--margin-top', '20mm',
    '--margin-right', '15mm',
    '--margin-bottom', '20mm',
    '--margin-left', '15mm',
    `file://${htmlPath}`,
    outPath
  ];

  try {
    await execFileAsync('wkhtmltopdf', args, { timeout: 120000 });
    return true;
  } catch (err) {
    console.warn('wkhtmltopdf failed:', err?.message || err);
    return false;
  }
}

function stripHtmlToText(html) {
  // Very small, safe HTML -> text conversion for fallback PDF output
  // Remove scripts/styles
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  // Replace headings with newlines
  text = text.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n\n$1\n\n');
  text = text.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n\n$1\n');
  text = text.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n$1\n');
  // Replace paragraphs and breaks
  text = text.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
  text = text.replace(/<br\s*\/?>(\s*)/gi, '\n');
  // Remove remaining tags
  text = text.replace(/<[^>]+>/g, '');
  // Decode common entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  // Collapse multiple spaces/newlines
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

async function fallbackPdf(htmlPath, outPath) {
  const html = await fs.promises.readFile(htmlPath, 'utf-8');
  const text = stripHtmlToText(html);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 36 });
    const stream = fs.createWriteStream(outPath);
    doc.pipe(stream);

    // Basic styling
    doc.fontSize(12).fillColor('black');
    const paragraphs = text.split('\n\n');
    for (const p of paragraphs) {
      const trimmed = p.trim();
      if (!trimmed) continue;
      // Heuristic: treat short lines in all caps as headings
      if (trimmed.length < 120 && /[A-Z][A-Z\s\d]{4,}/.test(trimmed)) {
        doc.moveDown(0.5);
        doc.fontSize(16).text(trimmed, { paragraphGap: 6 });
        doc.fontSize(12);
      } else {
        doc.text(trimmed, { paragraphGap: 6, lineGap: 4 });
      }
      doc.moveDown(0.5);
    }

    doc.end();
    stream.on('finish', () => resolve(true));
    stream.on('error', reject);
  });
}

async function generatePDF() {
  console.log('🚀 Starting PDF generation (lighter path)...');

  const htmlPath = join(__dirname, '../client/public/whitepaper.html');
  const outPath = join(__dirname, '../client/public/MtaaDAO-Whitepaper.pdf');

  // Try wkhtmltopdf first (lightweight native binary when available)
  const ok = await tryWkhtmltopdf(htmlPath, outPath);
  if (ok) {
    console.log('✅ PDF generated with wkhtmltopdf at client/public/MtaaDAO-Whitepaper.pdf');
    return;
  }

  console.log('ℹ️  Falling back to pdfkit text-based renderer (less fidelity)');
  await fallbackPdf(htmlPath, outPath);
  console.log('✅ PDF generated (fallback) at client/public/MtaaDAO-Whitepaper.pdf');
}

generatePDF().catch(err => {
  console.error('❌ Failed to generate whitepaper PDF:', err);
  process.exitCode = 1;
});
