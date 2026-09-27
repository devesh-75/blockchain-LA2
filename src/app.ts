import express, { Request, Response, NextFunction } from 'express';
import { paymentMiddlewareFromConfig } from '@x402/express';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { RoutesConfig } from '@x402/core/server';
import { config } from './config.js';
import { parseNotice, ParseError } from './parser.js';
import { DelayNoticeSchema, BulkDelayNoticeSchema } from './schema.js';
import { DelayNotice } from './types.js';

export function createApp(enableX402Middleware = true) {
  const app = express();

  // 1. Enforce server-side body size limit (Check 8)
  app.use(express.json({ limit: '50kb' }));
  app.use(express.text({ limit: '50kb' }));
  app.use(express.urlencoded({ extended: true, limit: '50kb' }));

  // 2. Free route (Check 1 & Check 4) - MUST be declared BEFORE payment middleware
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  // 3. Configure x402 paid routes (Check 1, Check 2, Check 5, Check 6)
  const networkId = config.network as `${string}:${string}`;
  const routes: RoutesConfig = {
    'POST /parse': {
      accepts: {
        scheme: 'exact',
        payTo: config.payToAddress,
        price: config.parsePriceUsdc,
        network: networkId,
      },
      description: "Single Indian Railways delay notice parsing",
    },
    'POST /parse/bulk': {
      accepts: {
        scheme: 'exact',
        payTo: config.payToAddress,
        price: config.bulkParsePriceUsdc,
        network: networkId,
      },
      description: "Bulk Indian Railways delay notices parsing",
    },
  };

  const schemes = [
    { network: networkId, server: new ExactEvmScheme() }
  ];

  // Attach x402 payment middleware if enabled
  if (enableX402Middleware) {
    app.use(paymentMiddlewareFromConfig(routes, undefined, schemes, undefined, undefined, true));
  }

  // 4. Single Notice Parse Paid Route (POST /parse)
  app.post('/parse', (req: Request, res: Response): void => {
    try {
      let rawNotice: string | undefined;

      if (typeof req.body === 'string') {
        rawNotice = req.body;
      } else if (req.body && typeof req.body.notice === 'string') {
        rawNotice = req.body.notice;
      }

      if (!rawNotice) {
        res.status(400).json({ error: 'Missing notice field or request body.' });
        return;
      }

      // Check input size limit server-side (Check 8)
      if (rawNotice.length > config.maxNoticeLength) {
        res.status(400).json({
          error: `Notice exceeds maximum allowed size of ${config.maxNoticeLength} characters.`,
        });
        return;
      }

      // Parse notice
      const parsed = parseNotice(rawNotice);

      // Validate parsed output against Zod schema (Check 9)
      const validationResult = DelayNoticeSchema.safeParse(parsed);
      if (!validationResult.success) {
        res.status(422).json({
          error: 'Schema validation failed for parsed notice output.',
          details: validationResult.error.format(),
        });
        return;
      }

      // Success: returns HTTP 200 with clean JSON (Settlement occurs)
      res.status(200).json(validationResult.data);
    } catch (err: unknown) {
      // Unparseable notice returns HTTP 422 - No settlement (Check 7)
      if (err instanceof ParseError) {
        res.status(422).json({ error: err.message });
        return;
      }
      const message = err instanceof Error ? err.message : 'Unknown server error';
      res.status(400).json({ error: message });
    }
  });

  // 5. Bulk Notice Parse Paid Route (POST /parse/bulk)
  app.post('/parse/bulk', (req: Request, res: Response): void => {
    try {
      if (!req.body || !Array.isArray(req.body.notices)) {
        res.status(400).json({ error: 'Request body must contain a "notices" array.' });
        return;
      }

      const notices: string[] = req.body.notices;

      if (notices.length === 0) {
        res.status(400).json({ error: '"notices" array must not be empty.' });
        return;
      }

      if (notices.length > 100) {
        res.status(400).json({ error: 'Bulk parsing is limited to a maximum of 100 notices per request.' });
        return;
      }

      const parsedResults: DelayNotice[] = [];

      // Process each notice (All-or-nothing policy for bulk)
      for (let i = 0; i < notices.length; i++) {
        const rawNotice = notices[i];

        if (typeof rawNotice !== 'string') {
          res.status(400).json({ error: `Notice at index ${i} is not a string.` });
          return;
        }

        if (rawNotice.length > config.maxNoticeLength) {
          res.status(400).json({
            error: `Notice at index ${i} exceeds maximum allowed size of ${config.maxNoticeLength} characters.`,
          });
          return;
        }

        const parsed = parseNotice(rawNotice);
        const validationResult = DelayNoticeSchema.safeParse(parsed);

        if (!validationResult.success) {
          res.status(422).json({
            error: `Schema validation failed for notice at index ${i}.`,
            details: validationResult.error.format(),
          });
          return;
        }

        parsedResults.push(validationResult.data);
      }

      // Validate entire bulk output array against Zod schema (Check 9)
      const bulkValidation = BulkDelayNoticeSchema.safeParse({ results: parsedResults });
      if (!bulkValidation.success) {
        res.status(422).json({
          error: 'Bulk schema validation failed.',
          details: bulkValidation.error.format(),
        });
        return;
      }

      // Success: returns HTTP 200 with array of clean JSON results
      res.status(200).json(bulkValidation.data);
    } catch (err: unknown) {
      if (err instanceof ParseError) {
        res.status(422).json({ error: err.message });
        return;
      }
      const message = err instanceof Error ? err.message : 'Unknown server error';
      res.status(400).json({ error: message });
    }
  });

  // Global Error Handler middleware
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    res.status(400).json({ error: message });
  });

  return app;
}
