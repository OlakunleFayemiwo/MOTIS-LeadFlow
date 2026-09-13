const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildJsonResponse,
  getCrmHeaders,
  getPublicCorsHeaders,
} = require("../functions/utils/response");
const { getSupabaseClient } = require("../functions/utils/supabaseClient");

test("getPublicCorsHeaders returns standard public CORS headers", () => {
  const headers = getPublicCorsHeaders("POST, OPTIONS");
  assert.equal(headers["Access-Control-Allow-Origin"], "*");
  assert.equal(headers["Access-Control-Allow-Headers"], "Content-Type");
  assert.equal(headers["Access-Control-Allow-Methods"], "POST, OPTIONS");
  assert.equal(headers["Content-Type"], "application/json");
});

test("getCrmHeaders allows configured site origin, rejects unconfigured or different origins", () => {
  const originalUrl = process.env.URL;
  const originalSiteUrl = process.env.SITE_URL;

  try {
    // 1. Configured site origin is allowed when requestOrigin matches
    process.env.URL = "https://motis-leadflow.netlify.app";
    delete process.env.SITE_URL;

    const matchingEvent = {
      headers: { origin: "https://motis-leadflow.netlify.app" },
    };
    const matchingHeaders = getCrmHeaders(matchingEvent);
    assert.equal(
      matchingHeaders["Access-Control-Allow-Origin"],
      "https://motis-leadflow.netlify.app",
    );
    assert.equal(matchingHeaders["Vary"], "Origin");

    // 2. A different origin is NOT allowed when site URL is configured
    const attackerEvent = {
      headers: { origin: "https://evil-attacker.com" },
    };
    const attackerHeaders = getCrmHeaders(attackerEvent);
    assert.equal(attackerHeaders["Access-Control-Allow-Origin"], undefined);

    // 3. No configured site URL does NOT result in reflecting an arbitrary origin
    delete process.env.URL;
    delete process.env.SITE_URL;

    const unconfiguredEvent = {
      headers: { origin: "https://arbitrary-origin.com" },
    };
    const unconfiguredHeaders = getCrmHeaders(unconfiguredEvent);
    assert.equal(unconfiguredHeaders["Access-Control-Allow-Origin"], undefined);
  } finally {
    if (originalUrl) process.env.URL = originalUrl;
    else delete process.env.URL;
    if (originalSiteUrl) process.env.SITE_URL = originalSiteUrl;
    else delete process.env.SITE_URL;
  }
});

test("buildJsonResponse formats statusCode, headers, and stringified body", () => {
  const customHeaders = { "X-Custom": "test" };
  const response = buildJsonResponse(200, { success: true }, customHeaders);

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["X-Custom"], "test");
  assert.equal(response.body, JSON.stringify({ success: true }));
});

test("getSupabaseClient handles missing or populated environment configuration", () => {
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SECRET_KEY;

  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SECRET_KEY;
  assert.equal(getSupabaseClient(), null);

  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "test-secret-key";
  const client = getSupabaseClient();
  assert.ok(client);
  assert.equal(typeof client.from, "function");

  // Restore env
  if (originalUrl) process.env.SUPABASE_URL = originalUrl;
  else delete process.env.SUPABASE_URL;
  if (originalKey) process.env.SUPABASE_SECRET_KEY = originalKey;
  else delete process.env.SUPABASE_SECRET_KEY;
});
