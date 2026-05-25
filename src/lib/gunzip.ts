/**
 * Browser-side gzip decompression using the native DecompressionStream API.
 * Used to support uploads like MIMIC-IV `.csv.gz` files without a server round-trip.
 */
export function isGzipped(file: File): boolean {
  const n = file.name.toLowerCase();
  return n.endsWith(".gz") || n.endsWith(".gzip") || file.type === "application/gzip" || file.type === "application/x-gzip";
}

export async function gunzipToText(file: File): Promise<string> {
  if (typeof (globalThis as any).DecompressionStream === "undefined") {
    throw new Error("Your browser does not support in-page gzip decompression. Please decompress the .gz file and re-upload.");
  }
  const ds = new (globalThis as any).DecompressionStream("gzip");
  const stream = file.stream().pipeThrough(ds);
  const blob = await new Response(stream).blob();
  return await blob.text();
}

/** Read a file as text, transparently decompressing if it's a .gz. */
export async function readTextMaybeGzipped(file: File): Promise<string> {
  return isGzipped(file) ? await gunzipToText(file) : await file.text();
}