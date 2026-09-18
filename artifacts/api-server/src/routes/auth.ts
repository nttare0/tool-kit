import { Router, type IRouter, type Request } from "express";
import {
  currentAdmin,
  hasAdmin,
  loginAdmin,
  logoutAdmin,
  setupAdmin,
} from "../lib/auth";

const router: IRouter = Router();
const failedLogins = new Map<string, { count: number; resetAt: number }>();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 8;

function loginKey(request: Request) {
  return request.ip || "unknown";
}

function isRateLimited(key: string) {
  const attempt = failedLogins.get(key);
  if (!attempt || attempt.resetAt <= Date.now()) {
    failedLogins.delete(key);
    return false;
  }
  return attempt.count >= MAX_LOGIN_ATTEMPTS;
}

function recordFailedLogin(key: string) {
  const current = failedLogins.get(key);
  if (!current || current.resetAt <= Date.now()) {
    failedLogins.set(key, { count: 1, resetAt: Date.now() + LOGIN_WINDOW_MS });
    return;
  }
  current.count += 1;
}

router.get("/auth/status", (req, res) => {
  const admin = currentAdmin(req);
  res.json({
    configured: hasAdmin(),
    authenticated: Boolean(admin),
    admin: admin ? { email: admin.email } : null,
  });
});

router.post("/auth/setup", (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const password =
    typeof req.body?.password === "string" ? req.body.password : "";
  if (!email.includes("@") || password.length < 8) {
    res.status(400).json({ error: "Use an email and a password with at least 8 characters." });
    return;
  }
  if (!setupAdmin(email, password)) {
    res.status(409).json({ error: "An admin account already exists." });
    return;
  }
  loginAdmin(email, password, res);
  res.status(201).json({ authenticated: true, admin: { email } });
});

router.post("/auth/login", (req, res) => {
  const key = loginKey(req);
  if (isRateLimited(key)) {
    res.setHeader("Retry-After", String(Math.ceil((failedLogins.get(key)!.resetAt - Date.now()) / 1000)));
    res.status(429).json({ error: "Too many login attempts. Try again later." });
    return;
  }
  const email = typeof req.body?.email === "string" ? req.body.email : "";
  const password =
    typeof req.body?.password === "string" ? req.body.password : "";
  if (!loginAdmin(email, password, res)) {
    recordFailedLogin(key);
    res.status(401).json({ error: "Email or password is incorrect." });
    return;
  }
  failedLogins.delete(key);
  res.json({ authenticated: true });
});

router.post("/auth/logout", (req, res) => {
  logoutAdmin(req, res);
  res.status(204).end();
});

export default router;