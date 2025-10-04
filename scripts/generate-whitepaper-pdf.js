
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function generatePDF() {
  console.log('🚀 Starting PDF generation...');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    const htmlPath = join(__dirname, '../client/public/whitepaper.html');
    
    console.log('📄 Loading HTML file...');
    await page.goto(`file://${htmlPath}`, { 
      waitUntil: 'networkidle0' 
    });
    
    console.log('📝 Generating PDF...');
    await page.pdf({
      path: join(__dirname, '../client/public/MtaaDAO-Whitepaper.pdf'),
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      }
    });
    
    console.log('✅ PDF generated successfully at client/public/MtaaDAO-Whitepaper.pdf');
  } catch (error) {
    console.error('❌ Error generating PDF:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

generatePDF().catch(console.error);
