# The Operator's Booth: Meera's Railway Delay API

Meera is a retired Indian Railways clerk in Pune. Every morning she reads messy, half-structured delay notices posted by stations (train number, station code, expected time, and optional reasons in English, Hindi, or Marathi) and turns them into clean JSON. 

This repository implements **Meera's Railway Delay API** with **x402 protocol payment gating** on the Base Sepolia testnet. Commuters and apps pay a fraction of a cent per API call, settled instantly in test USDC. Most importantly, Meera's golden rule is strictly enforced: **Nobody pays for a notice she couldn't read.** If parsing or validation fails, the API responds with HTTP 422 and payment settlement is canceled.

---

## What It Does

- **Structured Notice Parsing**: Extracts train number, station code, expected time, and reason text (preserving English, Hindi, and Marathi characters).
- **x402 Micropayment Gating**: Paid routes are protected using `@x402/express` middleware on Base Sepolia.
- **Server-Controlled Pricing**: Route prices (`PARSE_PRICE_USDC` and `BULK_PARSE_PRICE_USDC`) and recipient address (`PAY_TO_ADDRESS`) are strictly configured server-side. Callers cannot specify or alter prices.
- **Fail-Safe Settlement**: Unparseable or malformed notices produce an HTTP 422 status code, which automatically aborts payment settlement so callers retain their funds.
- **Schema Validation**: Output is strictly validated against a Zod schema (`DelayNoticeSchema`) before returning.

---

## Architecture

### Successful Payment & Parse Flow
```
Client Request
   │
   ├─► 1. HTTP Request to /parse
   ├─► 2. Server responds with 402 Payment Required + x402 headers (if unpaid)
   ├─► 3. Client constructs x402 payment header & retries
   ├─► 4. x402 Middleware verifies payment
   ├─► 5. Parser processes delay notice text
   ├─► 6. Zod Schema validates output object
   ├─► 7. Handler returns HTTP 200 + clean JSON
   └─► 8. x402 Middleware settles payment (USDC transferred)
```

### Malformed Notice / Failure Flow
```
Client Request with Malformed Notice
   │
   ├─► 1. Client provides valid x402 payment header & sends request
   ├─► 2. x402 Middleware verifies payment
   ├─► 3. Parser fails OR Zod Schema validation fails
   ├─► 4. Handler sets HTTP 422 status code
   └─► 5. x402 Middleware detects HTTP >= 400 and CANCELS settlement (Caller keeps funds)
```

---

## Requirements

- Node.js 20.12+
- npm
- Base Sepolia testnet wallet & test USDC

---

## Installation

Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd operators-booth
npm install
```

---

## Environment Configuration

Copy the example environment file and configure your variables:

```bash
cp .env.example .env
```

### Environment Variables

| Variable | Description | Default |
| --- | --- | --- |
| `PORT` | HTTP server port | `3000` |
| `PAY_TO_ADDRESS` | Recipient EVM wallet address for USDC payments | `0xYOUR_TESTNET_ADDRESS` |
| `BUYER_PRIVATE_KEY` | Private key for buyer script (testnet only) | `YOUR_TESTNET_PRIVATE_KEY` |
| `PARSE_PRICE_USDC` | Price per single notice parse (USDC) | `$0.0001` |
| `BULK_PARSE_PRICE_USDC` | Price per bulk notice parse (USDC) | `$0.0005` |
| `NETWORK` | Payment network CAIP-2 identifier | `eip155:84532` (Base Sepolia) |
| `MAX_NOTICE_LENGTH` | Server-side maximum notice length limit (chars) | `5000` |

> ⚠️ **Security Warning**: Never commit `.env` or real private keys to git. `.env` is ignored by `.gitignore`.

---

## Running the API Server

### Development Mode
```bash
npm run dev
```

### Production Build & Start
```bash
npm run build
npm start
```

---

## Running Automated Tests

Run the complete test suite with Vitest:

```bash
npm test
```

---

## Running the Buyer Script

The included buyer script uses `@x402/fetch` to automatically handle 402 payment challenges, sign payment payloads using your testnet private key, and complete paid API requests:

```bash
npm run buyer
```

---

## API Documentation & Examples

### 1. Free Route: Health Check

**`GET /health`**
- **Auth**: None (Free)
- **Response** (`200 OK`):
```json
{
  "status": "ok"
}
```

---

### 2. Paid Route: Single Notice Parse

**`POST /parse`**
- **Price**: `$0.0001` USDC (Server-controlled)
- **Headers**: Requires x402 Payment Header
- **Request Body**:
```json
{
  "notice": "Train 12109\nStation: PUNE\nExpected: 18:45\nReason: Heavy rainfall"
}
```

- **Unpaid Response** (`402 Payment Required`):
```http
HTTP/1.1 402 Payment Required
x-payment-requirements: [...]
```

- **Success Response** (`200 OK`):
```json
{
  "train": "12109",
  "station": "PUNE",
  "expectedTime": "18:45",
  "reason": "Heavy rainfall"
}
```

- **Unparseable / Malformed Notice Response** (`422 Unprocessable Entity` - **Payment Not Settled**):
```json
{
  "error": "Failed to parse delay notice: missing required field(s): train"
}
```

---

### 3. Paid Route: Bulk Notices Parse

**`POST /parse/bulk`**
- **Price**: `$0.0005` USDC (Server-controlled)
- **Headers**: Requires x402 Payment Header
- **Request Body**:
```json
{
  "notices": [
    "Train No: 11010\nStation Code: LTT\nNew Expected Time: 21:30\nReason: परिचालन कारणों से देरी",
    "Train: 12124\nStation: NGP\nExpected Time: 07:40\nReason: मुसळधार पावसामुळे उशीर"
  ]
}
```

- **Success Response** (`200 OK`):
```json
{
  "results": [
    {
      "train": "11010",
      "station": "LTT",
      "expectedTime": "21:30",
      "reason": "परिचालन कारणों से देरी"
    },
    {
      "train": "12124",
      "station": "NGP",
      "expectedTime": "07:40",
      "reason": "मुसळधार पावसामुळे उशीर"
    }
  ]
}
```

---

## Payment & Network Policy

- **Network**: Base Sepolia testnet (`eip155:84532`) ONLY. Mainnet configurations are strictly disallowed.
- **Server Control**: Price and recipient address are strictly determined server-side from environment variables.
- **No Charge on Failure**: If parsing fails or output validation fails, an HTTP 422 status code is returned. The x402 middleware detects the 4xx status and cancels settlement automatically.

---

## Security

Secrets and keys are read exclusively from environment variables (`.env`). `.env` is listed in `.gitignore` to prevent credentials from being tracked in source control. `.env.example` contains placeholders only.

---

## License

[MIT](LICENSE)
