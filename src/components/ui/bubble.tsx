import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "~/lib/utils";

const bubbleVariants = cva(
  "group/bubble relative flex w-fit max-w-full min-w-0 flex-col gap-1 group-data-[align=end]/message:self-end",
  {
    variants: {
      variant: {
        default:
          "*:data-[slot=bubble-content]:bg-primary *:data-[slot=bubble-content]:text-primary-foreground",
        muted: "*:data-[slot=bubble-content]:bg-muted",
      },
    },
    defaultVariants: {
      variant: "muted",
    },
  },
);

function Bubble({
  variant = "muted",
  className,
  ...props
}: ComponentProps<"div"> & VariantProps<typeof bubbleVariants>) {
  return (
    <div
      data-slot="bubble"
      data-variant={variant}
      className={cn(bubbleVariants({ variant }), className)}
      {...props}
    />
  );
}

function BubbleContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="bubble-content"
      className={cn(
        "w-fit max-w-full min-w-0 overflow-hidden rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap wrap-break-word",
        className,
      )}
      {...props}
    />
  );
}

export { Bubble, BubbleContent };
