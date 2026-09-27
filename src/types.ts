export interface DelayNotice {
  train: string;
  station: string;
  expectedTime: string;
  reason?: string;
}

export interface ParseNoticeRequest {
  notice: string;
}

export interface BulkParseNoticeRequest {
  notices: string[];
}

export interface BulkParseNoticeResponse {
  results: DelayNotice[];
}

export interface ServerConfig {
  port: number;
  payToAddress: string;
  parsePriceUsdc: string;
  bulkParsePriceUsdc: string;
  network: string;
  maxNoticeLength: number;
}
