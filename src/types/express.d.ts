import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Request {
    clientId?: string;
    tenantId?: string;
    credentialId?: string;
    portalUserEmail?: string;
    portalTenantId?: string;
  }
}
