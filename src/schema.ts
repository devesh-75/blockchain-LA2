import { z } from 'zod';

export const DelayNoticeSchema = z.object({
  train: z.string().min(1, 'Train identifier is required'),
  station: z.string().min(1, 'Station code is required'),
  expectedTime: z.string().min(1, 'Expected time is required'),
  reason: z.string().optional(),
});

export const BulkDelayNoticeSchema = z.object({
  results: z.array(DelayNoticeSchema),
});

export type DelayNoticeInput = z.infer<typeof DelayNoticeSchema>;
