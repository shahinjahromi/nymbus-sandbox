import { Router, type Request, type Response } from "express";
import { handleClientCredentialsGrant } from "../auth/oauth.js";

export const authRouter = Router();

/**
 * OAuth 2.0 Token endpoint (client_credentials grant).
 * Integrators use client_id + client_secret to obtain an access_token for sandbox API calls.
 */
authRouter.post("/oauth/token", (req: Request, res: Response) => {
  const contentType = req.headers["content-type"] ?? "";
  let clientId: string | undefined;
  let clientSecret: string | undefined;
  let grantType: string | undefined;

  if (contentType.includes("application/json")) {
    ({ client_id: clientId, client_secret: clientSecret, grant_type: grantType } = req.body ?? {});
  } else if (contentType.includes("application/x-www-form-urlencoded")) {
    clientId = req.body?.client_id;
    clientSecret = req.body?.client_secret;
    grantType = req.body?.grant_type;
  }

  if (!clientId || !clientSecret) {
    res.status(400).json({
      error: "invalid_request",
      error_description: "client_id and client_secret are required",
    });
    return;
  }

  if (grantType && grantType !== "client_credentials") {
    res.status(400).json({
      error: "unsupported_grant_type",
      error_description: "Only client_credentials grant is supported in sandbox",
    });
    return;
  }

  const tokenResponse = handleClientCredentialsGrant(clientId, clientSecret);
  if (!tokenResponse) {
    res.status(401).json({
      error: "invalid_client",
      error_description: "Invalid client_id or client_secret",
    });
    return;
  }

  res.json(tokenResponse);
});
