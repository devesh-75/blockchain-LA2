import { DelayNotice } from './types.js';

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

/**
 * Parses raw messy Indian Railways delay notice text into structured data.
 * Supports notices in English, Hindi, Marathi, and reasonable formatting variations.
 *
 * @param rawNotice Raw notice text
 * @returns Structured DelayNotice object
 * @throws ParseError if any required field (train, station, expectedTime) is missing
 */
export function parseNotice(rawNotice: string): DelayNotice {
  if (!rawNotice || typeof rawNotice !== 'string' || rawNotice.trim().length === 0) {
    throw new ParseError('Notice input must be a non-empty string.');
  }

  const lines = rawNotice.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  let train: string | undefined;
  let station: string | undefined;
  let expectedTime: string | undefined;
  let reason: string | undefined;

  for (const line of lines) {
    // Train matching
    if (!train) {
      const trainMatch = line.match(/(?:Train|गाडी)(?:\s*No\.?|\s*Num|\s*Number|\s*:|\s*#)?\s*[:=-]?\s*([A-Za-z0-9]+)/i);
      if (trainMatch && trainMatch[1]) {
        train = trainMatch[1].trim();
      }
    }

    // Station matching
    if (!station) {
      const stationMatch = line.match(/(?:Station|स्टेशन)(?:\s*Code)?\s*[:=-]?\s*([A-Za-z0-9]+)/i);
      if (stationMatch && stationMatch[1]) {
        station = stationMatch[1].trim();
      }
    }

    // Expected time matching
    if (!expectedTime) {
      const timeMatch = line.match(/(?:New\s+)?Expected(?:\s*Time)?\s*[:=-]?\s*(\d{1,2}:\d{2}(?:\s*[AP]M)?)/i) ||
                        line.match(/(?:वेळ|समय|Time)\s*[:=-]?\s*(\d{1,2}:\d{2}(?:\s*[AP]M)?)/i);
      if (timeMatch && timeMatch[1]) {
        expectedTime = timeMatch[1].trim();
      }
    }

    // Reason matching
    if (!reason) {
      const reasonMatch = line.match(/(?:Reason|कारण)\s*[:=-]?\s*(.+)/i);
      if (reasonMatch && reasonMatch[1]) {
        reason = reasonMatch[1].trim();
      }
    }
  }

  // Fallback pattern matching on whole text if line-by-line missed anything
  if (!train) {
    const match = rawNotice.match(/Train\s+([A-Za-z0-9]+)/i);
    if (match) train = match[1];
  }

  if (!station) {
    const match = rawNotice.match(/Station\s+([A-Za-z0-9]+)/i);
    if (match) station = match[1];
  }

  if (!expectedTime) {
    const match = rawNotice.match(/(\d{1,2}:\d{2}(?:\s*[AP]M)?)/);
    if (match) expectedTime = match[1];
  }

  if (!train || !station || !expectedTime) {
    const missing: string[] = [];
    if (!train) missing.push('train');
    if (!station) missing.push('station');
    if (!expectedTime) missing.push('expectedTime');
    throw new ParseError(`Failed to parse delay notice: missing required field(s): ${missing.join(', ')}`);
  }

  const result: DelayNotice = {
    train,
    station,
    expectedTime,
  };

  if (reason) {
    result.reason = reason;
  }

  return result;
}
