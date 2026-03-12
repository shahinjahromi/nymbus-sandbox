import { app } from "./app.js";
import { config } from "./config.js";

app.listen(config.port, () => {
  console.log(`Nymbus Sandbox API listening on http://localhost:${config.port}`);
  console.log(`  Health: http://localhost:${config.port}/health`);
  console.log(`  Token:  POST http://localhost:${config.port}/oauth/token`);
});
