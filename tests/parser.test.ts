import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseNotice, ParseError } from '../src/parser.js';
import { DelayNoticeSchema } from '../src/schema.js';

describe('Notice Parser (parseNotice)', () => {
  it('should parse valid English delay notice (notice1.txt)', () => {
    const raw = fs.readFileSync(path.join(__dirname, '../samples/valid/notice1.txt'), 'utf8');
    const result = parseNotice(raw);

    expect(result).toEqual({
      train: '12109',
      station: 'PUNE',
      expectedTime: '18:45',
      reason: 'Heavy rainfall',
    });

    const validated = DelayNoticeSchema.safeParse(result);
    expect(validated.success).toBe(true);
  });

  it('should parse valid Hindi delay notice (notice2.txt)', () => {
    const raw = fs.readFileSync(path.join(__dirname, '../samples/valid/notice2.txt'), 'utf8');
    const result = parseNotice(raw);

    expect(result).toEqual({
      train: '11010',
      station: 'LTT',
      expectedTime: '21:30',
      reason: 'परिचालन कारणों से देरी',
    });

    const validated = DelayNoticeSchema.safeParse(result);
    expect(validated.success).toBe(true);
  });

  it('should parse valid Marathi delay notice (notice3.txt)', () => {
    const raw = fs.readFileSync(path.join(__dirname, '../samples/valid/notice3.txt'), 'utf8');
    const result = parseNotice(raw);

    expect(result).toEqual({
      train: '12124',
      station: 'NGP',
      expectedTime: '07:40',
      reason: 'मुसळधार पावसामुळे उशीर',
    });

    const validated = DelayNoticeSchema.safeParse(result);
    expect(validated.success).toBe(true);
  });

  it('should throw ParseError on malformed notice missing train number (broken1.txt)', () => {
    const raw = fs.readFileSync(path.join(__dirname, '../samples/malformed/broken1.txt'), 'utf8');
    expect(() => parseNotice(raw)).toThrow(ParseError);
  });

  it('should throw ParseError on malformed notice missing station code (broken2.txt)', () => {
    const raw = fs.readFileSync(path.join(__dirname, '../samples/malformed/broken2.txt'), 'utf8');
    expect(() => parseNotice(raw)).toThrow(ParseError);
  });

  it('should throw ParseError on garbage text (broken3.txt)', () => {
    const raw = fs.readFileSync(path.join(__dirname, '../samples/malformed/broken3.txt'), 'utf8');
    expect(() => parseNotice(raw)).toThrow(ParseError);
  });

  it('should throw ParseError on empty or whitespace input', () => {
    expect(() => parseNotice('')).toThrow(ParseError);
    expect(() => parseNotice('   \n  ')).toThrow(ParseError);
  });
});
