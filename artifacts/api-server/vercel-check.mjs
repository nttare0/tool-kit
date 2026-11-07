// Fail the build before promotion if the real production database cannot serve
// the app. No credentials or database rows are printed in deployment logs.
process.env.NODE_ENV ||= "production";

if (!process.env.DATABASE_URL) {
  if (process.env.VERCEL_ENV === "production")
    throw new Error("Production DATABASE_URL is missing");
  console.log(
    "Database preflight skipped: configure a separate preview DATABASE_URL.",
  );
} else {
  let server;
  try {
    const { default: app, configureDefaultGemini } =
      await import("./dist/serverless.mjs");
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    for (const route of ["/healthz", "/categories", "/tools", "/auth/status"]) {
      const response = await fetch(base + route);
      if (!response.ok)
        throw new Error(`Database preflight failed for ${route}`);
      const body = await response.json();
      if (route === "/auth/status" && !body.configured)
        throw new Error("Admin provisioning was not completed");
    }
    console.log(
      "PASS: Supabase connection, schema, initialization, and public/auth API preflight.",
    );
    if (process.env.GOOGLE_AI_API_KEY) {
      try {
        const model = await configureDefaultGemini();
        console.log(
          "PASS: Default Gemini model discovery and live generation:",
          model,
        );
      } catch (error) {
        // AI availability must not take down the directory or dashboard.
        console.warn(
          "Default Gemini verification failed:",
          String(error?.message || "Unknown provider error").replaceAll(
            process.env.GOOGLE_AI_API_KEY,
            "[redacted]",
          ),
        );
      }
    }
    server.close();
    process.exit(0);
  } catch (error) {
    console.error(
      "Database preflight failed:",
      error?.code || "UNKNOWN",
      String(error?.message || "Unknown database error")
        .replaceAll(process.env.DATABASE_URL, "[redacted]")
        .replaceAll(new URL(process.env.DATABASE_URL).password, "[redacted]"),
    );
    server?.close();
    process.exit(1);
  }
}
