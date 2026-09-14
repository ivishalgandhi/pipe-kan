import { expect, test } from "vitest";

import {
  calendarEvents,
  calendarOpenKey,
  readCanvasTab,
  selectCalendarTab,
  writeCanvasTab,
} from "./calendar.ts";
import type { Card } from "./board.ts";

function memoryStorage() {
  const store = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key) {
      return store.get(key) ?? null;
    },
    key(index) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key) {
      store.delete(key);
    },
    setItem(key, value) {
      store.set(key, value);
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });
}

test("canvas tab persists and sidebar Calendar selects Calendar", () => {
  memoryStorage();
  expect(readCanvasTab()).toBe("board");
  selectCalendarTab();
  expect(readCanvasTab()).toBe("calendar");
  writeCanvasTab("board");
  expect(readCanvasTab()).toBe("board");
});

test("calendar events come from created and target end", () => {
  const cards: Card[] = [
    {
      key: "DEMO-2",
      summary: "Parse JSON",
      created: "2026-09-01T10:00:00.000+0000",
      targetEnd: "2026-10-20",
    },
    {
      key: "DEMO-4",
      summary: "No dates",
    },
  ];
  const events = calendarEvents(cards);
  expect(events).toEqual([
    {
      id: "DEMO-2:created",
      title: "DEMO-2 Parse JSON",
      start: "2026-09-01",
      allDay: true,
      classNames: ["fc-event-created"],
      extendedProps: {
        key: "DEMO-2",
        kind: "created",
        hover: "DEMO-2 Parse JSON · created",
      },
    },
    {
      id: "DEMO-2:targetEnd",
      title: "DEMO-2 Parse JSON",
      start: "2026-10-20",
      allDay: true,
      classNames: ["fc-event-target-end"],
      extendedProps: {
        key: "DEMO-2",
        kind: "targetEnd",
        hover: "DEMO-2 Parse JSON · target end",
      },
    },
  ]);
});

test("calendar events follow stories, epics, and combined visible Cards", () => {
  const story: Card = {
    key: "DEMO-2",
    summary: "Parse JSON",
    created: "2026-09-01T10:00:00.000+0000",
    targetEnd: "2026-10-20",
  };
  const epic: Card = {
    key: "DEMO-1",
    summary: "Ship calendar",
    type: "Epic",
    created: "2026-08-01T00:00:00.000Z",
    targetEnd: "2026-11-01",
  };
  expect(calendarEvents([story]).map((event) => event.id)).toEqual([
    "DEMO-2:created",
    "DEMO-2:targetEnd",
  ]);
  expect(calendarEvents([epic]).map((event) => event.id)).toEqual([
    "DEMO-1:created",
    "DEMO-1:targetEnd",
  ]);
  expect(calendarEvents([epic, story]).map((event) => event.extendedProps.key)).toEqual([
    "DEMO-1",
    "DEMO-1",
    "DEMO-2",
    "DEMO-2",
  ]);
  const epicEvents = calendarEvents([epic]);
  expect(epicEvents.map((event) => event.title)).toEqual([
    "DEMO-1 Ship calendar",
    "DEMO-1 Ship calendar",
  ]);
  expect(epicEvents.map((event) => event.extendedProps.hover)).toEqual([
    "DEMO-1 Ship calendar · created",
    "DEMO-1 Ship calendar · target end",
  ]);
});

test("calendar event title is key only when summary is empty or whitespace", () => {
  expect(
    calendarEvents([{ key: "DEMO-2", summary: "", created: "2026-09-01" }])[0]?.title,
  ).toBe("DEMO-2");
  expect(
    calendarEvents([{ key: "DEMO-2", summary: "   ", created: "2026-09-01" }])[0]?.title,
  ).toBe("DEMO-2");
  expect(
    calendarEvents([{ key: "DEMO-2", summary: "", created: "2026-09-01" }])[0]?.extendedProps
      .hover,
  ).toBe("DEMO-2 · created");
  expect(
    calendarEvents([{ key: "DEMO-2", summary: "", targetEnd: "2026-10-20" }])[0]
      ?.extendedProps.hover,
  ).toBe("DEMO-2 · target end");
});

test("calendar event title trims surrounding summary spaces", () => {
  expect(
    calendarEvents([{ key: "DEMO-2", summary: "  Parse JSON  ", created: "2026-09-01" }])[0]
      ?.title,
  ).toBe("DEMO-2 Parse JSON");
});

test("calendar events ignore due date and a Target Start decoy", () => {
  const cards: Card[] = [
    {
      key: "DEMO-2",
      summary: "Has decoys",
      created: "2026-09-01T10:00:00.000+0000",
      dueDate: "2026-01-15",
    },
  ];
  expect(calendarEvents(cards)).toEqual([
    {
      id: "DEMO-2:created",
      title: "DEMO-2 Has decoys",
      start: "2026-09-01",
      allDay: true,
      classNames: ["fc-event-created"],
      extendedProps: {
        key: "DEMO-2",
        kind: "created",
        hover: "DEMO-2 Has decoys · created",
      },
    },
  ]);
});

test("calendar click Opens with the Issue key", () => {
  const opened: string[] = [];
  const key = calendarOpenKey({ key: "DEMO-2" });
  if (key) opened.push(key);
  expect(opened).toEqual(["DEMO-2"]);
  expect(calendarOpenKey({ key: 12 })).toBeUndefined();
  expect(calendarOpenKey({})).toBeUndefined();
});
