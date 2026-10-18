export async function readApiJson<T>(res: Response): Promise<T> {
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("json")) {
    throw new Error(
      `Server returned ${res.status} ${res.statusText || "non-JSON"} instead of JSON (proxy or route problem)`,
    );
  }
  return (await res.json()) as T;
}
