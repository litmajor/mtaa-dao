import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import {setupVite, serveStatic, log } from "./vite"; // ← fix here
import path from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));


const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const reqPath = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (reqPath.startsWith("/api")) {
      let logLine = `${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) logLine = logLine.slice(0, 79) + "…";
      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    await registerRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
      throw err;
    });

    const port = Number(process.env.PORT) || 4000;
    const server = app.listen(port, "0.0.0.0", () => {
      log(`🚀 Server running on http://localhost:${port}`);
    });

    const isDev = process.env.NODE_ENV !== "production";
    if (isDev) {
      await setupVite(app, server); // ← dev inject
    } else {
      serveStatic(app);
      app.get("*", (_, res) => {
        res.sendFile(path.join(__dirname, "../../dist/public", "index.html"));
      });
    }
  } catch (err) {
    console.error("Fatal server error:", err);
    process.exit(1); 
  }
})();
