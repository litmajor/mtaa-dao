import path from "path";
import fs from "fs/promises";
import express from "express";
import { createServer as createViteServer } from "vite";
import { fileURLToPath } from "url";
import { type Server } from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const clientIndexPath = path.resolve(__dirname, "../client/index.html");

async function start() {
  const app = express();
  const server = app.listen(5173, () => {
    console.log("🚨 Diagnostic server running on http://localhost:5173");
  });

  const vite = await createViteServer({
    root: path.resolve(__dirname, "../client"),
    server: { middlewareMode: true, hmr: { server } },
    appType: "custom",
  });

  app.use((req, res, next) => {
    console.log(`[REQ] ${req.method} ${req.url}`);
    next();
  });

  app.use(vite.middlewares);

  app.get("*", async (req, res, next) => {
    try {
      console.log(`[SPA ROUTE] Serving index.html for ${req.url}`);
      const template = await fs.readFile(clientIndexPath, "utf-8");
      const transformed = await vite.transformIndexHtml(req.url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(transformed);
    } catch (err) {
      console.error("❌ Error serving index.html:", err);
      vite.ssrFixStacktrace(err as Error);
      next(err);
    }
  });

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("🔥 Server error:", err);
    res.status(500).json({ message: err.message });
  });
}
start().catch((err) => {
  console.error("❌ Fatal error starting diagnostic server:", err);
  process.exit(1);
});

export async function setupVite(app: express.Express, server: Server) {
  const vite = await createViteServer({
    root: path.resolve(__dirname, "../client"),
    server: { middlewareMode: true, hmr: { server } },
    appType: "custom",
  });
    app.use(vite.middlewares);
    app.get("*", async (req, res, next) => {
        try {
            console.log(`[SPA ROUTE] Serving index.html for ${req.url}`);
            const template = await fs.readFile(clientIndexPath, "utf-8");
            const transformed = await vite.transformIndexHtml(req.url, template);
            res.status(200).set({ "Content-Type": "text/html" }).end(transformed);
        }
        catch (err) {
            console.error("❌ Error serving index.html:", err);
            vite.ssrFixStacktrace(err as Error);
            next(err);
        }       
    });

    app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        console.error("🔥 Server error:", err);
        res.status(500).json({ message: err.message });
    });
}

export function serveStatic(app: express.Express) {
  app.use(express.static(path.resolve(__dirname, "../client")));
  app.get("*", (req, res) => {
    res.sendFile(path.resolve(__dirname, "../client/index.html"));
    });
}
export function log(message: string) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
}

export default { setupVite, serveStatic, log };

