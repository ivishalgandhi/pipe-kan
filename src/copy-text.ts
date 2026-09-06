export type ClipboardWriter = {
  writeText(text: string): Promise<void>;
};

export async function copyText(
  text: string,
  clipboard: ClipboardWriter | null = defaultClipboard(),
  fallback: (text: string) => void = copyWithTextarea,
): Promise<void> {
  if (clipboard) {
    try {
      await clipboard.writeText(text);
      return;
    } catch {
      fallback(text);
      return;
    }
  }
  fallback(text);
}

function defaultClipboard(): ClipboardWriter | null {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return null;
  return navigator.clipboard;
}

export function copyWithTextarea(text: string, doc: Document = document): void {
  const el = doc.createElement("textarea");
  el.value = text;
  el.setAttribute("readonly", "");
  el.style.position = "fixed";
  el.style.top = "0";
  el.style.left = "0";
  el.style.width = "1px";
  el.style.height = "1px";
  el.style.opacity = "0";
  doc.body.appendChild(el);
  el.focus();
  el.select();
  el.setSelectionRange(0, text.length);
  const ok = doc.execCommand("copy");
  doc.body.removeChild(el);
  if (!ok) throw new Error("Copy failed");
}
