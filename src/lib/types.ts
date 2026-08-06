import type { CommuteInfo } from "./directions";
import type { StockQuote } from "./stocks";
import type { NewsItem } from "./news";
import type { WeatherInfo } from "./weather";
import type { WeatherAlert } from "./weatherAlerts";

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
  /** RFC3339 completion timestamp, present only once status is "completed". */
  completed?: string | null;
}

export interface BriefingResponse {
  date: string;
  events: BriefingEvent[];
  tasks: BriefingTask[];
  /** Completed tasks, most recently completed first — for undoing accidental checks. */
  completedTasks: BriefingTask[];
  stocks: StockQuote[];
  weather: WeatherInfo | null;
  homeAddressConfigured: boolean;
  locationSource: "current" | "home";
  locationLabel: string | null;
}

export type { CommuteInfo, StockQuote, NewsItem, WeatherInfo, WeatherAlert };
