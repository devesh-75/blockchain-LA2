import { createApp } from './app.js';
import { config } from './config.js';

const app = createApp(true);

app.listen(config.port, () => {
  console.log(`Meera's Railway Delay API server running on port ${config.port}`);
  console.log(`Network: ${config.network}`);
  console.log(`Recipient (payTo): ${config.payToAddress}`);
  console.log(`Single Parse Price: ${config.parsePriceUsdc}`);
  console.log(`Bulk Parse Price: ${config.bulkParsePriceUsdc}`);
});
