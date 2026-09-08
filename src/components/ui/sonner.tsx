import type { ComponentProps, CSSProperties } from "react";
import { Toaster as Sonner } from "sonner";

export function Toaster({ theme, ...props }: ComponentProps<typeof Sonner>) {
  return (
    <Sonner
      theme={theme}
      className="toaster group"
      position="bottom-right"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as CSSProperties
      }
      {...props}
    />
  );
}
