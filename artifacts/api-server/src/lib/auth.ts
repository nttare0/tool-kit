import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { get, run } from "./sqlite";

const SESSION_COOKIE = "toolstack_session";
const SESSION_DAYS = 30;
const sessionSecret =
  process.env.SESSION_SECRET || "toolstack-development-session-secret";

type AdminRow = {
  id: number;
  email: string;
  password_hash: string;
  password_salt: string;
};

function signSession(id: string) {
  return crypto
    .createHmac("sha256", sessionSecret)
    .update(id)
    .digest("base64url");
}

function encodeSession(id: string) {
  return `${id}.${signSession(id)}`;
}

function decodeSession(value: string | undefined) {
  if (!value) return null;
  const [id, signature] = value.split(".");
  if (!id || !signature) return null;
  const expected = signSession(id);
  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }
  return id;
}

function hashPassword(password: string, salt: string) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function setSessionCookie(response: Response, adminId: number) {
  const id = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  run(
    "INSERT INTO sessions (id, admin_id, expires_at) VALUES (?, ?, ?)",
    id,
    adminId,
    expiresAt,
  );
  response.cookie(SESSION_COOKIE, encodeSession(id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export function currentAdmin(request: Request) {
  const sessionId = decodeSession(request.cookies?.[SESSION_COOKIE]);
  if (!sessionId) return null;
  const row = get<{ email: string; admin_id: number }>(
    `SELECT a.id AS admin_id, a.email
     FROM sessions s
     INNER JOIN admins a ON a.id = s.admin_id
     WHERE s.id = ? AND s.expires_at > ?`,
    sessionId,
    new Date().toISOString(),
  );
  return row ? { id: row.admin_id, email: row.email, sessionId } : null;
}

export function requireAdmin(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const admin = currentAdmin(request);
  if (!admin) {
    response.status(401).json({ error: "Admin login required" });
    return;
  }
  next();
}

export function setupAdmin(email: string, password: string) {
  const existing = get<{ id: number }>("SELECT id FROM admins LIMIT 1");
  if (existing) return false;
  const salt = crypto.randomBytes(16).toString("hex");
  run(
    "INSERT INTO admins (email, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?)",
    email.trim().toLowerCase(),
    hashPassword(password, salt),
    salt,
    new Date().toISOString(),
  );
  return true;
}

export function loginAdmin(email: string, password: string, response: Response) {
  const admin = get<AdminRow>(
    "SELECT id, email, password_hash, password_salt FROM admins WHERE email = ?",
    email.trim().toLowerCase(),
  );
  if (!admin) return false;
  const actual = hashPassword(password, admin.password_salt);
  if (
    actual.length !== admin.password_hash.length ||
    !crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(admin.password_hash))
  ) {
    return false;
  }
  setSessionCookie(response, admin.id);
  return true;
}

export function logoutAdmin(request: Request, response: Response) {
  const admin = currentAdmin(request);
  if (admin) run("DELETE FROM sessions WHERE id = ?", admin.sessionId);
  response.clearCookie(SESSION_COOKIE, { path: "/" });
}

export function hasAdmin() {
  return Boolean(get<{ id: number }>("SELECT id FROM admins LIMIT 1"));
}