import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import { useMemo } from "react";

import { calendarEvents, calendarOpenKey } from "~/calendar.ts";
import type { Card } from "~/board.ts";

export function BoardCalendar({
  cards,
  onOpen,
}: {
  cards: Card[];
  onOpen: (key: string) => void;
}) {
  const events = useMemo(() => calendarEvents(cards), [cards]);

  function openKey(props: { key?: unknown } | undefined) {
    const key = calendarOpenKey(props);
    if (key) onOpen(key);
  }

  return (
    <div className="pk-calendar h-full min-h-0 p-2">
      <FullCalendar
        plugins={[dayGridPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{ left: "prev", center: "title", right: "next" }}
        events={events}
        editable={false}
        selectable={false}
        height="100%"
        expandRows
        fixedWeekCount={false}
        dayMaxEvents
        eventContent={(arg) => {
          const key = calendarOpenKey(arg.event.extendedProps);
          if (!key) return true;
          const hover = arg.event.extendedProps.hover;
          return (
            <button
              type="button"
              className="fc-event-key"
              title={typeof hover === "string" ? hover : undefined}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onOpen(key);
              }}
            >
              {arg.event.title}
            </button>
          );
        }}
        eventClick={(info) => {
          info.jsEvent.preventDefault();
          openKey(info.event.extendedProps);
        }}
      />
    </div>
  );
}
