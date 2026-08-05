import { google, calendar_v3 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

const CALENDAR_ID = "primary";

export interface CalendarEventInput {
  summary: string;
  description?: string;
  location?: string;
  start: string; // ISO datetime, or YYYY-MM-DD for all-day
  end: string;
  allDay?: boolean;
}

export type CalendarEvent = calendar_v3.Schema$Event;

function client(auth: OAuth2Client) {
  return google.calendar({ version: "v3", auth });
}

export async function listEvents(
  auth: OAuth2Client,
  timeMin: string,
  timeMax: string
): Promise<CalendarEvent[]> {
  const { data } = await client(auth).events.list({
    calendarId: CALENDAR_ID,
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 50,
  });
  return data.items ?? [];
}

function toEventDateTime(value: string, allDay?: boolean) {
  return allDay ? { date: value } : { dateTime: value };
}

export async function createEvent(
  auth: OAuth2Client,
  input: CalendarEventInput
): Promise<CalendarEvent> {
  const { data } = await client(auth).events.insert({
    calendarId: CALENDAR_ID,
    requestBody: {
      summary: input.summary,
      description: input.description,
      location: input.location,
      start: toEventDateTime(input.start, input.allDay),
      end: toEventDateTime(input.end, input.allDay),
    },
  });
  return data;
}

export async function updateEvent(
  auth: OAuth2Client,
  eventId: string,
  input: Partial<CalendarEventInput>
): Promise<CalendarEvent> {
  const { data } = await client(auth).events.patch({
    calendarId: CALENDAR_ID,
    eventId,
    requestBody: {
      ...(input.summary !== undefined && { summary: input.summary }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.location !== undefined && { location: input.location }),
      ...(input.start !== undefined && { start: toEventDateTime(input.start, input.allDay) }),
      ...(input.end !== undefined && { end: toEventDateTime(input.end, input.allDay) }),
    },
  });
  return data;
}

export async function deleteEvent(auth: OAuth2Client, eventId: string): Promise<void> {
  await client(auth).events.delete({ calendarId: CALENDAR_ID, eventId });
}
