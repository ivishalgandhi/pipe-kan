import type { ComponentProps } from "react";

import { cn } from "~/lib/utils";

function Message({
  className,
  align = "start",
  ...props
}: ComponentProps<"div"> & { align?: "start" | "end" }) {
  return (
    <div
      data-slot="message"
      data-align={align}
      className={cn(
        "group/message relative flex w-full min-w-0 gap-2 text-sm data-[align=end]:flex-row-reverse",
        className,
      )}
      {...props}
    />
  );
}

function MessageContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="message-content"
      className={cn(
        "flex min-w-0 max-w-[85%] flex-col gap-1 wrap-break-word group-data-[align=end]/message:items-end",
        className,
      )}
      {...props}
    />
  );
}

function MessageFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="message-footer"
      className={cn(
        "text-muted-foreground flex max-w-full min-w-0 items-center text-xs font-medium group-data-[align=end]/message:justify-end",
        className,
      )}
      {...props}
    />
  );
}

export { Message, MessageContent, MessageFooter };
