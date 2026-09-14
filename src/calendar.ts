import type { Card } from "./board.ts";

export type CalendarEventKind = "created" | "targetEnd";

export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  allDay: true;
  classNames: string[];
  extendedProps: { key: string; kind: CalendarEventKind; hover: string };
};

export type CanvasTab = "board" | "calendar";

export const CANVAS_TAB_KEY = "board-canvas-tab";

export function readCanvasTab(): CanvasTab {
  try {
    return localStorage.getItem(CANVAS_TAB_KEY) === "calendar" ? "calendar" : "board";
  } catch {
    return "board";
  }
}

export function writeCanvasTab(next: CanvasTab) {
  localStorage.setItem(CANVAS_TAB_KEY, next);
}

/** Sidebar Calendar control: select the Calendar tab without changing the opener. */
export function selectCalendarTab() {
  writeCanvasTab("calendar");
}

export function calendarOpenKey(props: { key?: unknown } | undefined): string | undefined {
  return typeof props?.key === "string" && props.key ? props.key : undefined;
}

function dayOf(value?: string): string | undefined {
  if (!value) return undefined;
  const day = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return day ? `${day[1]}-${day[2]}-${day[3]}` : undefined;
}

function eventTitle(card: Card): string {
  const summary = card.summary.trim();
  return summary ? `${card.key} ${summary}` : card.key;
}

export function calendarEvents(cards: Card[]): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const card of cards) {
    const title = eventTitle(card);
    const created = dayOf(card.created);
    if (created) {
      events.push({
        id: `${card.key}:created`,
        title,
        start: created,
        allDay: true,
        classNames: ["fc-event-created"],
        extendedProps: { key: card.key, kind: "created", hover: `${title} · created` },
      });
    }
    const targetEnd = dayOf(card.targetEnd);
    if (targetEnd) {
      events.push({
        id: `${card.key}:targetEnd`,
        title,
        start: targetEnd,
        allDay: true,
        classNames: ["fc-event-target-end"],
        extendedProps: { key: card.key, kind: "targetEnd", hover: `${title} · target end` },
      });
    }
  }
  return events;
}
