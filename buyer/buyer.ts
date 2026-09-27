import dotenv from 'dotenv';
import { wrapFetchWithPayment, x402Client } from '@x402/fetch';
import { ExactEvmScheme, toClientEvmSigner } from '@x402/evm';
import { privateKeyToAccount } from 'viem/accounts';
import type { Hex } from 'viem';

dotenv.config();

/**
 * Buyer script demonstrating x402 payment client library integration
 * Calls paid endpoints on Meera's Railway Delay API on Base Sepolia testnet
 */
async function main() {
  const privateKey = process.env.BUYER_PRIVATE_KEY;
  const baseUrl = process.env.API_URL || 'http://localhost:3000';
  const network = process.env.NETWORK || 'eip155:84532'; // Base Sepolia

  if (!privateKey || privateKey.includes('YOUR_TESTNET_PRIVATE_KEY')) {
    console.error('Error: BUYER_PRIVATE_KEY environment variable is required to run buyer script.');
    console.error('Please set BUYER_PRIVATE_KEY in your .env file with a valid testnet private key.');
    process.exit(1);
  }

  console.log(`Connecting to API at: ${baseUrl}`);
  console.log(`Target payment network: ${network}`);

  // Set up viem account and x402 EVM signer
  const account = privateKeyToAccount(privateKey as Hex);
  const signer = toClientEvmSigner(account);

  // Initialize x402 client with ExactEvmScheme for Base Sepolia
  const client = new x402Client().register(network as `${string}:${string}`, new ExactEvmScheme(signer));

  // Wrap standard fetch function with x402 payment capability
  const fetchWithPayment = wrapFetchWithPayment(fetch, client);

  // 1. Single notice parse test
  console.log('\n--- 1. Testing Single Notice Paid Parse (POST /parse) ---');
  const sampleNotice = `Train 12109
Station: PUNE
Expected: 18:45
Reason: Heavy rainfall`;

  try {
    const res = await fetchWithPayment(`${baseUrl}/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notice: sampleNotice }),
    });

    console.log(`HTTP Status: ${res.status} ${res.statusText}`);
    const data = await res.json();
    console.log('Parsed JSON Response:', JSON.stringify(data, null, 2));
  } catch (err: unknown) {
    console.error('Single notice request failed:', err instanceof Error ? err.message : err);
  }

  // 2. Bulk notice parse test
  console.log('\n--- 2. Testing Bulk Notices Paid Parse (POST /parse/bulk) ---');
  const sampleBulkNotices = [
    `Train No: 11010
Station Code: LTT
New Expected Time: 21:30
Reason: परिचालन कारणों से देरी`,
    `Train: 12124
Station: NGP
Expected Time: 07:40
Reason: मुसळधार पावसामुळे उशीर`,
  ];

  try {
    const res = await fetchWithPayment(`${baseUrl}/parse/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notices: sampleBulkNotices }),
    });

    console.log(`HTTP Status: ${res.status} ${res.statusText}`);
    const data = await res.json();
    console.log('Bulk Parsed JSON Response:', JSON.stringify(data, null, 2));
  } catch (err: unknown) {
    console.error('Bulk notices request failed:', err instanceof Error ? err.message : err);
  }
}

main().catch((err) => {
  console.error('Fatal error running buyer script:', err);
  process.exit(1);
});
