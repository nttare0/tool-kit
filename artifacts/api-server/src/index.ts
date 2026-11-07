import { transaction, lockInitialization } from "./lib/sqlite";
import { provisionAdmin } from "./lib/provision-admin";
import app from "./app";
import { logger } from "./lib/logger";
import { seedDatabase } from "./lib/seed";

const rawPort = process.env["PORT"] ?? "5000";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

if (!process.env["PORT"]) {
  logger.warn(
    { port },
    "PORT not set — using fallback for local development. Set PORT in production.",
  );
}

await transaction(async () => {
  await lockInitialization();
  await provisionAdmin();
  await seedDatabase();
});

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
