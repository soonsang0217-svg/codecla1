import type { CommuteInfo } from "./directions";
import type { StockQuote } from "./stocks";
import type { NewsItem } from "./news";
import type { HealthSnapshot } from "./health";

export interface BriefingEventTime {
  dateTime?: string | null;
  date?: string | null;
}

export interface BriefingEvent {
  id?: string | null;
  summary?: string | null;
  location?: string | null;
  description?: string | null;
  start?: BriefingEventTime | null;
  end?: BriefingEventTime | null;
  commute?: CommuteInfo | null;
}

export interface BriefingTask {
  id?: string | null;
  title?: string | null;
  notes?: string | null;
  due?: string | null;
  status?: string | null;
}

export interface BriefingResponse {
  date: string;
  events: BriefingEvent[];
  tasks: BriefingTask[];
  stocks: StockQuote[];
  news: NewsItem[];
  health: HealthSnapshot | null;
  homeAddressConfigured: boolean;
}

export type { CommuteInfo, StockQuote, NewsItem, HealthSnapshot };
