import app from "./app";
import { seedDatabase } from "./lib/seed";

// Run once per cold start; unlike index.ts, never open a listening socket.
await seedDatabase();
export default app;
