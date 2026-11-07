import { get, run } from "./sqlite";

/** Private, opt-in provisioning. Never accept these values from an HTTP request. */
export async function provisionAdmin() {
  const value = process.env.ADMIN_BOOTSTRAP;
  if (!value) return;
  const config = JSON.parse(
    Buffer.from(value, "base64").toString("utf8"),
  ) as Record<string, unknown>;
  const { email, hash, salt } = config;
  if (
    typeof email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    typeof hash !== "string" ||
    !/^[a-f0-9]{128}$/.test(hash) ||
    typeof salt !== "string" ||
    !/^[a-f0-9]{32}$/.test(salt)
  ) {
    throw new Error("Invalid private ADMIN_BOOTSTRAP configuration");
  }
  // Do not overwrite an existing account or a password changed in the dashboard.
  if (await get<{ id: number }>("SELECT id FROM admins LIMIT 1")) return;
  await run(
    "INSERT OR IGNORE INTO admins (email, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?)",
    email.trim().toLowerCase(),
    hash,
    salt,
    new Date().toISOString(),
  );
}
