/**
 * Vitest global setup — initialise the durable-store (SQLite) and
 * pre-load caches before any tests run.
 */
import { initDurableStore } from "../src/services/durable-store.js";
import { initDeveloperRegistry } from "../src/services/developer-registry.js";
import { initPortalAuth } from "../src/services/portal-auth.js";
import { initTenantStore } from "../src/services/tenant-store.js";

await initDurableStore();
await initDeveloperRegistry();
await initPortalAuth();
await initTenantStore();
