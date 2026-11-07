import { transaction, lockInitialization } from "./lib/sqlite";
import { provisionAdmin } from "./lib/provision-admin";
import app from "./app";
import { seedDatabase } from "./lib/seed";

// Run once per cold start; unlike index.ts, never open a listening socket.
await transaction(async () => {
  await lockInitialization();
  await provisionAdmin();
  await seedDatabase();
});
export default app;

export { configureDefaultGemini } from "./lib/llm-provider";
