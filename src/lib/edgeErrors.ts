/**
 * Extracts a friendly, specific error message from a supabase.functions.invoke response.
 *
 * The Supabase JS SDK returns a generic "Edge Function returned a non-2xx status code"
 * error and hides the actual JSON body. This helper reads the body off the FunctionsHttpError
 * context and surfaces the real reason (rate limit, out of credits, validation error, etc.)
 * so users see something actionable instead of "non-2xx status code".
 */
export async function extractEdgeError(
  response: { error: any; data: any },
  fallback: string,
): Promise<string> {
  const { error, data } = response;

  // 1. If the function returned a 2xx but the body indicates failure
  if (!error && data && data.success === false) {
    return friendlyMessage(data.error || fallback);
  }

  if (!error) return fallback;

  // 2. FunctionsHttpError exposes the original Response on error.context
  const ctx = (error as any).context;
  if (ctx && typeof ctx.json === "function") {
    try {
      const body = await ctx.json();
      if (body?.error) return friendlyMessage(body.error);
      if (body?.message) return friendlyMessage(body.message);
    } catch {
      // body was not JSON, try text
      try {
        const text = await ctx.text();
        if (text) return friendlyMessage(text);
      } catch {
        // ignore
      }
    }
  }

  // 3. HTTP status hints (when body parsing fails)
  const status = ctx?.status;
  if (status === 429) return "AI service is busy right now — please try again in a moment.";
  if (status === 402) return "AI credits are exhausted. Add credits in Lovable Cloud → Usage and try again.";
  if (status === 401) return "Your session expired. Please sign in again.";
  if (status === 413) return "The case file is too large. Try a shorter excerpt.";
  if (status >= 500) return "The analysis service hit an internal error. Please try again — if it keeps happening, let support know.";

  return friendlyMessage(error.message || fallback);
}

function friendlyMessage(raw: string): string {
  const msg = String(raw);
  const lower = msg.toLowerCase();

  if (lower.includes("rate limit") || lower.includes("429")) {
    return "AI service is busy right now — please try again in a moment.";
  }
  if (lower.includes("credits exhausted") || lower.includes("402") || lower.includes("payment required")) {
    return "AI credits are exhausted. Add credits in Lovable Cloud → Usage and try again.";
  }
  if (lower.includes("non-2xx status code")) {
    return "The analysis service returned an unexpected error. Please try again.";
  }
  if (lower.includes("lovable_api_key")) {
    return "AI service is not configured. Please contact support.";
  }
  if (lower.includes("unauthorized")) {
    return "Your session expired. Please sign in again.";
  }
  return msg;
}
