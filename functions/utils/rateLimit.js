// =====================================================================
// IN-MEMORY RATE LIMITER (BEST-EFFORT)
// =====================================================================
// Sliding-window limiter for public serverless endpoints.
//
// IMPORTANT LIMITATION: Netlify functions run as independent instances
// with separate memory. This limiter is PER-FUNCTION-INSTANCE and is
// therefore NOT a globally distributed rate limit. It damps bursts that
// hit a warm instance but does not cap total traffic across all
// instances. Deliberately no external infrastructure (Redis, Supabase
// counters, etc.) per the MVP scope; a distributed counter would be a
// follow-up if abuse becomes a real problem.
// =====================================================================

const MAX_BUCKETS = 5000;

const buckets = new Map();

function pruneExpired(now, windowMs) {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, timestamps] of buckets) {
    if (!timestamps.some((t) => t > now - windowMs)) buckets.delete(key);
  }
}

function getClientIp(event) {
  const headers = event?.headers || {};
  // Netlify's edge sets these per client connection; they are not
  // client-controllable the way a raw x-forwarded-for header is.
  // Never trust arbitrary browser-supplied IP headers.
  return (
    headers["client-connection-ip"] ||
    headers["x-nf-client-connection-ip"] ||
    // No edge IP available (e.g. local dev / tests): fall back to a
    // single shared bucket, which is the conservative choice.
    "unknown"
  );
}

// Returns true when the request is allowed, false when the client has
// exceeded MAX_REQUESTS within the last WINDOW_MS milliseconds.
function isAllowed(event, { maxRequests = 10, windowMs = 60_000 } = {}) {
  const now = Date.now();
  const key = getClientIp(event);

  pruneExpired(now, windowMs);

  const timestamps = (buckets.get(key) || []).filter(
    (t) => t > now - windowMs,
  );

  if (timestamps.length >= maxRequests) {
    buckets.set(key, timestamps);
    return false;
  }

  timestamps.push(now);
  buckets.set(key, timestamps);
  return true;
}

function reset() {
  buckets.clear();
}

module.exports = { isAllowed, reset, getClientIp };
