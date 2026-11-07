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

async function setSessionCookie(response: Response, adminId: number) {
  const id = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  await run(
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

export async function currentAdmin(request: Request) {
  const sessionId = decodeSession(request.cookies?.[SESSION_COOKIE]);
  if (!sessionId) return null;
  const row = await get<{ email: string; admin_id: number }>(
    `SELECT a.id AS admin_id, a.email
     FROM sessions s
     INNER JOIN admins a ON a.id = s.admin_id
     WHERE s.id = ? AND s.expires_at > ?`,
    sessionId,
    new Date().toISOString(),
  );
  return row ? { id: row.admin_id, email: row.email, sessionId } : null;
}

export async function requireAdmin(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const admin = await currentAdmin(request);
  if (!admin) {
    response.status(401).json({ error: "Admin login required" });
    return;
  }
  next();
}

export async function loginAdmin(
  email: string,
  password: string,
  response: Response,
) {
  const admin = await get<AdminRow>(
    "SELECT id, email, password_hash, password_salt FROM admins WHERE email = ?",
    email.trim().toLowerCase(),
  );
  if (!admin) return false;
  const actual = hashPassword(password, admin.password_salt);
  if (
    actual.length !== admin.password_hash.length ||
    !crypto.timingSafeEqual(
      Buffer.from(actual),
      Buffer.from(admin.password_hash),
    )
  ) {
    return false;
  }
  await setSessionCookie(response, admin.id);
  return true;
}

export async function changeAdminPassword(
  adminId: number,
  currentPassword: string,
  newPassword: string,
) {
  const admin = await get<AdminRow>(
    "SELECT id, email, password_hash, password_salt FROM admins WHERE id = ?",
    adminId,
  );
  if (!admin) return false;
  const actual = hashPassword(currentPassword, admin.password_salt);
  if (
    actual.length !== admin.password_hash.length ||
    !crypto.timingSafeEqual(
      Buffer.from(actual),
      Buffer.from(admin.password_hash),
    )
  ) {
    return false;
  }
  const salt = crypto.randomBytes(16).toString("hex");
  await run(
    "UPDATE admins SET password_hash = ?, password_salt = ? WHERE id = ?",
    hashPassword(newPassword, salt),
    salt,
    adminId,
  );
  return true;
}

export async function logoutAdmin(request: Request, response: Response) {
  const admin = await currentAdmin(request);
  if (admin) await run("DELETE FROM sessions WHERE id = ?", admin.sessionId);
  response.clearCookie(SESSION_COOKIE, { path: "/" });
}

export async function hasAdmin() {
  return Boolean(await get<{ id: number }>("SELECT id FROM admins LIMIT 1"));
}
