const assert = require("node:assert/strict");
const test = require("node:test");

const rateLimit = require("../functions/utils/rateLimit");

function eventWithIp(ip) {
  return { headers: { "client-connection-ip": ip } };
}

test.beforeEach(() => rateLimit.reset());

test("allows requests up to the limit, then blocks the same client", () => {
  const request = eventWithIp("198.51.100.1");
  for (let i = 0; i < 10; i++) {
    assert.equal(rateLimit.isAllowed(request), true, `request ${i + 1} should pass`);
  }
  assert.equal(rateLimit.isAllowed(request), false);
  assert.equal(rateLimit.isAllowed(request), false);
});

test("tracks clients independently", () => {
  const first = eventWithIp("198.51.100.2");
  const second = eventWithIp("198.51.100.3");
  for (let i = 0; i < 10; i++) rateLimit.isAllowed(first);
  assert.equal(rateLimit.isAllowed(first), false);
  assert.equal(rateLimit.isAllowed(second), true);
});

test("clients without an edge IP header share one conservative bucket", () => {
  // x-forwarded-for is browser-controlled and must NOT be used as a key.
  const spoofed = { headers: { "x-forwarded-for": "9.9.9.9" } };
  const noHeader = { headers: {} };

  for (let i = 0; i < 10; i++) assert.equal(rateLimit.isAllowed(spoofed), true);
  assert.equal(rateLimit.isAllowed(spoofed), false);
  // Requests without an edge IP share the same fallback bucket.
  assert.equal(rateLimit.isAllowed(noHeader), false);
});

test("old requests expire from the window", () => {
  const request = eventWithIp("198.51.100.4");
  for (let i = 0; i < 10; i++) rateLimit.isAllowed(request, { windowMs: 50 });
  assert.equal(rateLimit.isAllowed(request, { windowMs: 50 }), false);

  const start = Date.now();
  while (Date.now() - start < 60) {
    // spin briefly so the 50ms window fully elapses
  }
  assert.equal(rateLimit.isAllowed(request, { windowMs: 50 }), true);
});

test("reset clears all buckets", () => {
  const request = eventWithIp("198.51.100.5");
  for (let i = 0; i < 10; i++) rateLimit.isAllowed(request);
  assert.equal(rateLimit.isAllowed(request), false);
  rateLimit.reset();
  assert.equal(rateLimit.isAllowed(request), true);
});

test("accepts the Netlify alternate edge IP header", () => {
  const viaNetlifyHeader = { headers: { "x-nf-client-connection-ip": "198.51.100.6" } };
  for (let i = 0; i < 10; i++) rateLimit.isAllowed(viaNetlifyHeader);
  assert.equal(rateLimit.isAllowed(viaNetlifyHeader), false);

  // The edge header value is used as the client key, so a request
  // presenting the same client IP via either edge header shares the
  // same bucket, while a different IP gets its own.
  assert.equal(
    rateLimit.isAllowed({ headers: { "client-connection-ip": "198.51.100.6" } }),
    false,
  );
  assert.equal(rateLimit.isAllowed(eventWithIp("198.51.100.7")), true);
});
