import express, { type Express, type Request, type Response } from "express";
import path from "path";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/api", router);

// ---------------------------------------------------------------------------
// Serve the built FraudGuard frontend in production so that the single
// Express process handles both /api routes AND the SPA.  This eliminates
// the need for a separate Vite preview server (which cannot proxy POST
// requests to /api/*, causing 405 errors on CV uploads etc.).
// ---------------------------------------------------------------------------
const frontendDist = path.resolve(__dirname, "..", "..", "fraudapp", "dist");

// Static assets (JS, CSS, images, fonts …)
app.use(express.static(frontendDist, { index: false }));

// SPA fallback — every non-API GET that didn't match a static file serves
// index.html so that client-side routing (React Router) takes over.
app.get("/{*splat}", (_req: Request, res: Response) => {
  res.sendFile(path.join(frontendDist, "index.html"), (err) => {
    if (err) {
      // If the frontend hasn't been built yet, return a helpful message
      // instead of crashing.
      res.status(404).send("Frontend not built. Run: pnpm --filter @workspace/fraudapp build");
    }
  });
});

export default app;
