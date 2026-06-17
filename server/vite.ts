import express, { type Express } from "express";
import path from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
import fs from "fs";
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

export async function setupVite(app: Express, server: Server) {
  // Dynamically import Vite and the config only when running in dev.
  const { createServer: createViteServer, createLogger } = await import('vite');
  const viteConfig = (await import('../vite.config.js'))?.default || (await import('../vite.config.js'));
  const viteLogger = createLogger();

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg: any, options: any) => {
        viteLogger.error(msg, options);
        process.exit(1);
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

  app.use(vite.middlewares);

  app.use('*', async (req, res, next) => {
    const url = req.originalUrl;

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
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "../../dist/public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `❌ Could not find the build directory: ${distPath}, make sure to run 'npm run build' first`
    );
  }

  // Serve static files with caching
  app.use(express.static(distPath, {
    maxAge: '1y', // Cache assets for 1 year
    immutable: true, // Assets are immutable (have hash in filename)
    etag: true, // Enable ETag for conditional requests
    lastModified: true,
    setHeaders: (res, path) => {
      // Don't cache HTML files as aggressively
      if (path.endsWith('.html')) {
        res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
      }
    }
  }));

  // Fallback for React Router SPA
  app.use("*", (_req, res) => {
    // Don't cache the main HTML file
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(distPath, "index.html"));
  });
}
