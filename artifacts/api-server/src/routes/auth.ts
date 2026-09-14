import { Router, type IRouter } from "express";
import {
  currentAdmin,
  hasAdmin,
  loginAdmin,
  logoutAdmin,
  setupAdmin,
} from "../lib/auth";

const router: IRouter = Router();

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
  const email = typeof req.body?.email === "string" ? req.body.email : "";
  const password =
    typeof req.body?.password === "string" ? req.body.password : "";
  if (!loginAdmin(email, password, res)) {
    res.status(401).json({ error: "Email or password is incorrect." });
    return;
  }
  res.json({ authenticated: true });
});

router.post("/auth/logout", (req, res) => {
  logoutAdmin(req, res);
  res.status(204).end();
});

export default router;