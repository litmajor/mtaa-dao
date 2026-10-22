import express, { type Express, type Router } from "express";
import path from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
import fs from "fs";
import compression from 'compression';
import type { Server } from "http";
import { nanoid } from "nanoid";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Router, server: Server) {
  console.log('[STARTUP] setupVite: importing Vite');
  const { createServer: createViteServer, createLogger } = await import('vite');
  console.log('[STARTUP] setupVite: importing Vite config');
  const { default: viteConfig } = await import('../vite.config.js');
  const viteLogger = createLogger();

  console.log('[STARTUP] setupVite: creating middleware server');
  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
      },
    },
    server: {
      middlewareMode: true,
      hmr: {
        server,
      },
    },
    appType: 'custom',
  });

  console.log('[STARTUP] setupVite: middleware server ready; mounting middleware');
  app.use(vite.middlewares);

  app.use('*', async (req, res, next) => {
    const url = req.originalUrl;
    const pathname = url.split('?')[0];
    if (pathname === '/api' || pathname.startsWith('/api/')) {
      return next();
    }

    try {
      const clientTemplate = path.resolve(__dirname, '../client/index.html');
      let template = await fs.promises.readFile(clientTemplate, 'utf-8');

      // Add cache-busting query param
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );

      const html = await vite.transformIndexHtml(url, template);
      res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
  console.log('[STARTUP] setupVite: complete');
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "../../dist/public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `❌ Could not find the build directory: ${distPath}, make sure to run 'npm run build' first`
    );
  }
  // Compression for static assets
  app.use(compression());

  // Serve hashed build assets (Vite outputs into `assets/`) with long immutable cache
  const assetsPath = path.join(distPath, 'assets');
  if (fs.existsSync(assetsPath)) {
    app.use('/assets', express.static(assetsPath, {
      maxAge: '1y', // Cache assets for 1 year
      immutable: true,
      etag: true,
      lastModified: true,
    }));
  }

  // Serve remaining files (including favicons, manifests) with a shorter cache
  app.use(express.static(distPath, {
    maxAge: '1h',
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
      } else if (filePath.match(/\.(png|jpg|jpeg|webp|ico|json|webmanifest)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour
      }
    }
  }));

  // SPA fallback - exclude API routes so missing server routes return proper 404s
  app.use((req, res, next) => {
    const url = req.originalUrl || req.url || '';
    if (url.startsWith('/api') || url.startsWith('/_next') || url.startsWith('/assets')) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(distPath, 'index.html'), (err) => {
      if (err) return next(err);
    });
  });
}
