import { run } from "./sqlite";

export function recordActivity(
  actorType: "admin" | "user",
  actorId: number | null,
  actorEmail: string,
  action: string,
  targetType: string,
  targetId: number | null,
  details = "",
) {
  run(
    `INSERT INTO activity_log (actor_type, actor_id, actor_email, action, target_type, target_id, details, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    actorType,
    actorId,
    actorEmail,
    action,
    targetType,
    targetId,
    details,
    new Date().toISOString(),
  );
}