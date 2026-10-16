import fs from 'fs';
import path from 'path';
import multer from 'multer';

const receiptsStorage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    const uploadDir = path.join(process.cwd(), 'attached_assets', 'payment-receipts');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    callback(null, uploadDir);
  },
  filename: (_req, file, callback) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const safe = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    callback(null, `${unique}-${safe}`);
  },
});

const receiptsFileFilter: multer.Options['fileFilter'] = (_req, file, callback) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!allowed.includes(file.mimetype)) return callback(new Error('Invalid file type'));
  callback(null, true);
};

export const paymentReceiptUpload = multer({
  storage: receiptsStorage,
  fileFilter: receiptsFileFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});
