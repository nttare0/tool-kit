import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { get, run } from "./sqlite";

const COOKIE = "toolstack_user_session";
const SESSION_DAYS = 30;
const secret = process.env.SESSION_SECRET || "toolstack-development-session-secret";

type UserRow = {
  id: number;
  email: string;
  display_name: string;
  profession: string;
  password_hash: string;
  password_salt: string;
  status: string;
};

function tokenFor(id: string) {
  const signature = crypto.createHmac("sha256", secret).update(id).digest("base64url");
  return `${id}.${signature}`;
}

function sessionIdFromCookie(value: string | undefined) {
  if (!value) return null;
  const [id, supplied] = value.split(".");
  if (!id || !supplied) return null;
  const expected = tokenFor(id).split(".")[1];
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) return null;
  return id;
}

function hashPassword(password: string, salt: string) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function passwordsMatch(password: string, stored: string, salt: string) {
  const actual = hashPassword(password, salt);
  return actual.length === stored.length && crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(stored));
}

function setUserSession(response: Response, userId: number) {
  const id = crypto.randomBytes(32).toString("hex");
  const maxAge = SESSION_DAYS * 24 * 60 * 60 * 1000;
  run("INSERT INTO user_sessions (id, user_id, expires_at) VALUES (?, ?, ?)", id, userId, new Date(Date.now() + maxAge).toISOString());
  response.cookie(COOKIE, tokenFor(id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge,
    path: "/",
  });
}

export function currentUser(request: Request) {
  const sessionId = sessionIdFromCookie(request.cookies?.[COOKIE]);
  if (!sessionId) return null;
  const row = get<{ id: number; email: string; display_name: string; profession: string }>(
    `SELECT u.id, u.email, u.display_name, u.profession FROM user_sessions s
     INNER JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > ? AND u.status = 'active'`,
    sessionId,
    new Date().toISOString(),
  );
  return row ? { id: row.id, email: row.email, displayName: row.display_name, profession: row.profession, sessionId } : null;
}

export function requireUser(request: Request, response: Response, next: NextFunction) {
  if (!currentUser(request)) {
    response.status(401).json({ error: "Sign in to continue." });
    return;
  }
  next();
}

export function registerUser(displayName: string, email: string, password: string, profession: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (get<{ id: number }>("SELECT id FROM users WHERE email = ?", normalizedEmail)) return null;
  const salt = crypto.randomBytes(16).toString("hex");
  const result = run(
    `INSERT INTO users (email, display_name, profession, password_hash, password_salt, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    normalizedEmail,
    displayName.trim(),
    profession.trim(),
    hashPassword(password, salt),
    salt,
    new Date().toISOString(),
  );
  return Number(result.lastInsertRowid);
}

export function loginUser(email: string, password: string, response: Response) {
  const user = get<UserRow>(
    "SELECT id, email, display_name, profession, password_hash, password_salt, status FROM users WHERE email = ?",
    email.trim().toLowerCase(),
  );
  if (!user || user.status !== "active" || !passwordsMatch(password, user.password_hash, user.password_salt)) return null;
  setUserSession(response, user.id);
  return { id: user.id, email: user.email, displayName: user.display_name, profession: user.profession };
}

export function logoutUser(request: Request, response: Response) {
  const user = currentUser(request);
  if (user) run("DELETE FROM user_sessions WHERE id = ?", user.sessionId);
  response.clearCookie(COOKIE, { path: "/" });
}

export function changeUserPassword(userId: number, currentPassword: string, newPassword: string, keepSessionId: string) {
  const user = get<Pick<UserRow, "password_hash" | "password_salt">>(
    "SELECT password_hash, password_salt FROM users WHERE id = ?",
    userId,
  );
  if (!user || !passwordsMatch(currentPassword, user.password_hash, user.password_salt)) return false;
  const salt = crypto.randomBytes(16).toString("hex");
  run("UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?", hashPassword(newPassword, salt), salt, userId);
  run("DELETE FROM user_sessions WHERE user_id = ? AND id != ?", userId, keepSessionId);
  return true;
}