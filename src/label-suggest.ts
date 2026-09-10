const TOKEN = /[a-z0-9]{2,}/g;

function tokens(value: string): string[] {
  return value.toLowerCase().match(TOKEN) ?? [];
}

export function uniqueLabels(items: Array<{ labels?: string[] } | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    for (const label of item?.labels ?? []) {
      const key = label.toLowerCase();
      if (!label || seen.has(key)) continue;
      seen.add(key);
      out.push(label);
    }
  }
  return out;
}

export function suggestLabels(opts: {
  text: string;
  labels: string[];
  selected?: string[];
}): string[] {
  const text = opts.text.toLowerCase();
  if (!opts.text.trim()) return [];
  const selected = new Set((opts.selected ?? []).map((label) => label.toLowerCase()));
  const textTokens = tokens(opts.text);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const label of opts.labels) {
    const lower = label.toLowerCase();
    if (!lower || selected.has(lower) || seen.has(lower)) continue;
    const labelTokens = tokens(label);
    const hit =
      text.includes(lower) ||
      labelTokens.some((token) => textTokens.includes(token) || text.includes(token)) ||
      textTokens.some((token) => lower.includes(token));
    if (!hit) continue;
    seen.add(lower);
    out.push(label);
    if (out.length >= 5) break;
  }
  return out;
}
