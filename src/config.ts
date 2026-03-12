import "dotenv/config";

export const config = {
  port: parseInt(process.env.PORT ?? "3040", 10),
  nodeEnv: process.env.NODE_ENV ?? "development",
  sandboxBaseUrl: process.env.SANDBOX_BASE_URL ?? "http://localhost:3040",
  oauth: {
    tokenTtlSeconds: parseInt(process.env.OAUTH_TOKEN_TTL_SECONDS ?? "3600", 10),
    refreshTokenTtlDays: parseInt(process.env.OAUTH_REFRESH_TOKEN_TTL_DAYS ?? "30", 10),
    defaultClientId: process.env.SANDBOX_DEFAULT_CLIENT_ID ?? "sandbox_dev_001",
    defaultClientSecret: process.env.SANDBOX_DEFAULT_CLIENT_SECRET ?? "sandbox_secret_change_in_production",
  },
  security: {
    oauthRequestsPerMinute: parseInt(process.env.SANDBOX_OAUTH_REQUESTS_PER_MINUTE ?? "120", 10),
    apiRequestsPerMinute: parseInt(process.env.SANDBOX_API_REQUESTS_PER_MINUTE ?? "300", 10),
    portalAuthRequestsPerMinute: parseInt(
      process.env.SANDBOX_PORTAL_AUTH_REQUESTS_PER_MINUTE ?? "60",
      10
    ),
  },
} as const;
