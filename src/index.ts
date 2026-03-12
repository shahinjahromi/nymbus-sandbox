import { app } from "./app.js";
import { config } from "./config.js";
import { initDurableStore } from "./services/durable-store.js";
import { initTenantStore } from "./services/tenant-store.js";
import { initDeveloperRegistry } from "./services/developer-registry.js";
import { initPortalAuth } from "./services/portal-auth.js";

async function main(): Promise<void> {
  // 1. Database connection + schema
  await initDurableStore();
  // 2. Pre-load caches (order matters: registry before portal)
  await initDeveloperRegistry();
  await initPortalAuth();
  await initTenantStore();

  app.listen(config.port, () => {
    console.log(`Nymbus Sandbox API listening on http://localhost:${config.port}`);
    console.log(`  Health: http://localhost:${config.port}/health`);
    console.log(`  Token:  POST http://localhost:${config.port}/oauth/token`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
