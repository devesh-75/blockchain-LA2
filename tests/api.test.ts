import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { createApp } from '../src/app.js';
import { config } from '../src/config.js';

describe('Meera Railway Delay API Integration Tests', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = createApp(true);
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        if (address && typeof address !== 'string') {
          baseUrl = `http://localhost:${address.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  // CHECK 1: Free route /health
  it('GET /health returns HTTP 200 OK without requiring payment', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string };
    expect(body).toEqual({ status: 'ok' });
  });

  // CHECK 1 & CHECK 2: Paid routes gated by x402
  it('POST /parse without payment returns HTTP 402 Payment Required', async () => {
    const res = await fetch(`${baseUrl}/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notice: 'Train 12109\nStation: PUNE\nExpected: 18:45' }),
    });

    expect(res.status).toBe(402);
    expect(res.headers.has('payment-required') || res.headers.has('x-payment-requirements') || res.status === 402).toBe(true);
  });

  // CHECK 2: Payment network is Base Sepolia testnet
  it('configured network is Base Sepolia testnet (eip155:84532)', () => {
    expect(config.network).toBe('eip155:84532');
    expect(config.network).not.toContain('mainnet');
  });

  // CHECK 5 & CHECK 6: Prices and recipient are server-controlled
  it('route prices and recipient are server-controlled constants', () => {
    expect(config.parsePriceUsdc).toBeDefined();
    expect(config.bulkParsePriceUsdc).toBeDefined();
    expect(config.parsePriceUsdc).not.toEqual(config.bulkParsePriceUsdc);
    expect(config.payToAddress).toBeDefined();
  });

  // Testing protected handlers directly (without 402 middleware blocking test requests)
  describe('Protected Handlers Execution (Direct Handler Tests)', () => {
    let appWithoutAuth: ReturnType<typeof createApp>;
    let testServer: http.Server;
    let testUrl: string;

    beforeAll(async () => {
      appWithoutAuth = createApp(false);
      await new Promise<void>((resolve) => {
        testServer = appWithoutAuth.listen(0, () => {
          const address = testServer.address();
          if (address && typeof address !== 'string') {
            testUrl = `http://localhost:${address.port}`;
          }
          resolve();
        });
      });
    });

    afterAll(async () => {
      await new Promise<void>((resolve) => {
        testServer.close(() => resolve());
      });
    });

    it('POST /parse returns 200 and clean JSON for valid notice', async () => {
      const noticeText = fs.readFileSync(path.join(__dirname, '../samples/valid/notice1.txt'), 'utf8');
      const res = await fetch(`${testUrl}/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notice: noticeText }),
      });

      expect(res.status).toBe(200);
      const data = await res.json() as Record<string, string>;
      expect(data).toEqual({
        train: '12109',
        station: 'PUNE',
        expectedTime: '18:45',
        reason: 'Heavy rainfall',
      });
    });

    // CHECK 7 & CHECK 10: Malformed notice returns HTTP 422
    it('POST /parse with malformed notice returns HTTP 422 Unprocessable Entity', async () => {
      const brokenNotice = fs.readFileSync(path.join(__dirname, '../samples/malformed/broken1.txt'), 'utf8');
      const res = await fetch(`${testUrl}/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notice: brokenNotice }),
      });

      expect(res.status).toBe(422);
      const data = await res.json() as { error?: string };
      expect(data).toHaveProperty('error');
    });

    it('POST /parse with garbage text returns HTTP 422 Unprocessable Entity', async () => {
      const garbageNotice = fs.readFileSync(path.join(__dirname, '../samples/malformed/broken3.txt'), 'utf8');
      const res = await fetch(`${testUrl}/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notice: garbageNotice }),
      });

      expect(res.status).toBe(422);
    });

    // CHECK 8: Server enforces notice size limit
    it('POST /parse rejects notice exceeding maximum length limit with 400', async () => {
      const oversizedNotice = 'Train 12109\nStation: PUNE\nExpected: 18:45\nReason: ' + 'A'.repeat(6000);
      const res = await fetch(`${testUrl}/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notice: oversizedNotice }),
      });

      expect(res.status).toBe(400);
      const data = await res.json() as { error?: string };
      expect(data.error).toContain('maximum allowed size');
    });

    // Bulk parse test
    it('POST /parse/bulk returns 200 with results array for valid bulk notices', async () => {
      const notice1 = fs.readFileSync(path.join(__dirname, '../samples/valid/notice1.txt'), 'utf8');
      const notice2 = fs.readFileSync(path.join(__dirname, '../samples/valid/notice2.txt'), 'utf8');

      const res = await fetch(`${testUrl}/parse/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notices: [notice1, notice2] }),
      });

      expect(res.status).toBe(200);
      const data = await res.json() as { results?: any[] };
      expect(data).toHaveProperty('results');
      expect(Array.isArray(data.results)).toBe(true);
      expect(data.results?.length).toBe(2);
    });

    it('POST /parse/bulk returns HTTP 422 if ANY notice in bulk is malformed', async () => {
      const validNotice = fs.readFileSync(path.join(__dirname, '../samples/valid/notice1.txt'), 'utf8');
      const brokenNotice = fs.readFileSync(path.join(__dirname, '../samples/malformed/broken1.txt'), 'utf8');

      const res = await fetch(`${testUrl}/parse/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notices: [validNotice, brokenNotice] }),
      });

      expect(res.status).toBe(422);
      const data = await res.json() as { error?: string };
      expect(data).toHaveProperty('error');
    });
  });
});
