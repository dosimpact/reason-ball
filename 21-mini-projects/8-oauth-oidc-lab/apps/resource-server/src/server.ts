import { createAccessTokenVerifier } from "./auth.js";
import { createApp } from "./app.js";
import { readConfig } from "./config.js";

const config = readConfig();
const verifyAccessToken = createAccessTokenVerifier({
  issuer: config.issuer,
  audience: config.audience,
  jwksUrl: config.jwksUrl,
});
const app = createApp({ verifyAccessToken });

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
