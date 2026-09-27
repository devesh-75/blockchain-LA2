import dotenv from 'dotenv';
import { ServerConfig } from './types.js';

dotenv.config();

function formatUsdcPrice(val?: string, defaultPrice = '0.0001'): string {
  if (!val) return defaultPrice;
  // Strip any leading '$' if present, return clean numeric string
  return val.replace(/^\$/, '');
}

export const config: ServerConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  payToAddress: process.env.PAY_TO_ADDRESS || '0x0000000000000000000000000000000000000000',
  parsePriceUsdc: formatUsdcPrice(process.env.PARSE_PRICE_USDC, '0.0001'),
  bulkParsePriceUsdc: formatUsdcPrice(process.env.BULK_PARSE_PRICE_USDC, '0.0005'),
  network: process.env.NETWORK || 'eip155:84532', // Base Sepolia testnet
  maxNoticeLength: parseInt(process.env.MAX_NOTICE_LENGTH || '5000', 10),
};
