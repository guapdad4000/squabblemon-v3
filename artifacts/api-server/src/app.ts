import express, { type Express, type RequestHandler } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";

function productionAuthMiddleware(): RequestHandler {
  return clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  }));
}

export function createApp(
  authMiddleware: RequestHandler = productionAuthMiddleware(),
): Express {
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
  app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
  app.use(
    cors((req, callback) => {
    const origin = req.header("origin");
    let allowed = !origin;
    if (origin) {
      try {
        allowed = new URL(origin).host === getClerkProxyHost(req);
      } catch {
        allowed = false;
      }
    }
    callback(null, {
      credentials: true,
      origin: allowed && origin ? origin : false,
    });
    }),
  );
  const requireSameOrigin: RequestHandler = (req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      next();
      return;
    }
    const origin = req.header("origin");
    if (!origin) {
      next();
      return;
    }
    try {
      if (new URL(origin).host === getClerkProxyHost(req)) {
        next();
        return;
      }
    } catch {
      // Invalid origins are rejected below.
    }
    res.status(403).json({ error: "Cross-origin mutation rejected" });
  };
  app.use(requireSameOrigin);
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(authMiddleware);

  app.use("/api", router);
  return app;
}

const app = createApp();
export default app;
