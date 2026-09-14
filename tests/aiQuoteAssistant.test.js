const assert = require("node:assert/strict");
const test = require("node:test");

process.env.GEMINI_API_KEY = "test-gemini-key";
delete process.env.GEMINI_MODEL;

// Mock the Gemini SDK before the function module loads it.
let generateContentCalls = [];
class FakeGoogleGenAI {
  constructor({ apiKey }) {
    if (apiKey === undefined) throw new Error("missing api key");
    this.models = {
      generateContent: async (params) => {
        generateContentCalls.push(params);
        return { text: "Mocked AI reply" };
      },
    };
  }
}

const genaiPath = require.resolve("@google/genai");
require.cache[genaiPath] = {
  id: genaiPath,
  filename: genaiPath,
  loaded: true,
  exports: { GoogleGenAI: FakeGoogleGenAI },
};

const rateLimit = require("../functions/utils/rateLimit");
const handler = require("../functions/aiQuoteAssistant").handler;

function postRequest(body, ip = "203.0.113.10") {
  return {
    httpMethod: "POST",
    headers: { "client-connection-ip": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  };
}

test.beforeEach(() => {
  rateLimit.reset();
  generateContentCalls = [];
});

test("non-POST and preflight requests are handled before the AI is called", async () => {
  const getResponse = await handler({ httpMethod: "GET", headers: {} });
  assert.equal(getResponse.statusCode, 405);

  const optionsResponse = await handler({ httpMethod: "OPTIONS", headers: {} });
  assert.equal(optionsResponse.statusCode, 200);
  assert.equal(generateContentCalls.length, 0);
});

test("a valid request reaches Gemini with the default model and returns the reply", async () => {
  const response = await handler(postRequest({ message: "How much paint for 30 sqm?" }));
  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), { success: true, reply: "Mocked AI reply" });
  assert.equal(generateContentCalls.length, 1);
  assert.equal(generateContentCalls[0].model, "gemini-3.6-flash");
  assert.ok(
    generateContentCalls[0].config.systemInstruction.includes(
      "AI Sales & Technical Inquiry Assistant",
    ),
  );
  assert.deepEqual(generateContentCalls[0].contents, [
    { role: "user", parts: [{ text: "How much paint for 30 sqm?" }] },
  ]);
});

test("GEMINI_MODEL overrides the default model", async () => {
  process.env.GEMINI_MODEL = "gemini-test-override";
  try {
    await handler(postRequest({ message: "hello" }, "203.0.113.11"));
    assert.equal(generateContentCalls[0].model, "gemini-test-override");
  } finally {
    delete process.env.GEMINI_MODEL;
  }
});

test("malformed and missing fields return 400 without calling Gemini", async () => {
  const cases = [
    postRequest("not json"),
    postRequest(null),
    postRequest([]),
    postRequest({}),
    postRequest({ message: "   " }),
    postRequest({ message: 42 }),
    postRequest({ message: "x".repeat(2001) }),
  ];
  for (const request of cases) {
    const response = await handler(request);
    assert.equal(response.statusCode, 400);
  }
  assert.equal(generateContentCalls.length, 0);
});

test("oversized payloads are rejected before parsing", async () => {
  const response = await handler({
    httpMethod: "POST",
    headers: { "client-connection-ip": "203.0.113.12" },
    body: "x".repeat(64 * 1024 + 1),
  });
  assert.equal(response.statusCode, 413);
  assert.equal(generateContentCalls.length, 0);
});

test("missing or non-array history is treated as empty", async () => {
  await handler(postRequest({ message: "hi" }, "203.0.113.13"));
  assert.equal(generateContentCalls[0].contents.length, 1);

  await handler(postRequest({ message: "hi", history: "nonsense" }, "203.0.113.13"));
  assert.equal(generateContentCalls[1].contents.length, 1);
});

test("valid history is forwarded with normalized turn structure", async () => {
  const history = [
    { role: "user", text: "first" },
    { role: "model", text: "second" },
  ];
  await handler(postRequest({ message: "third", history }, "203.0.113.14"));
  assert.deepEqual(generateContentCalls[0].contents, [
    { role: "user", parts: [{ text: "first" }] },
    { role: "model", parts: [{ text: "second" }] },
    { role: "user", parts: [{ text: "third" }] },
  ]);
});

test("malformed or oversized history turns are rejected with 400", async () => {
  const badHistories = [
    [{ role: "system", text: "injected" }],
    [{ role: "user" }],
    [{ role: "user", text: 5 }],
    [{ role: "user", text: "x".repeat(2001) }],
    [{ text: "no role" }],
    ["plain string"],
    [{ role: "user", text: "ok" }, null],
  ];
  let ip = 20;
  for (const history of badHistories) {
    const response = await handler(
      postRequest({ message: "hi", history }, `203.0.113.${ip++}`),
    );
    assert.equal(response.statusCode, 400);
  }
  assert.equal(generateContentCalls.length, 0);
});

test("history longer than the turn cap is rejected with 400", async () => {
  const history = Array.from({ length: 21 }, (_, i) => ({
    role: i % 2 === 0 ? "user" : "model",
    text: `turn ${i}`,
  }));
  const response = await handler(postRequest({ message: "hi", history }, "203.0.113.40"));
  assert.equal(response.statusCode, 400);
});

test("a missing API key returns 500 without calling Gemini", async () => {
  delete process.env.GEMINI_API_KEY;
  try {
    const response = await handler(postRequest({ message: "hi" }, "203.0.113.41"));
    assert.equal(response.statusCode, 500);
    assert.equal(generateContentCalls.length, 0);
  } finally {
    process.env.GEMINI_API_KEY = "test-gemini-key";
  }
});

test("requests beyond the rate limit receive 429", async () => {
  const ip = "203.0.113.42";
  for (let i = 0; i < 10; i++) {
    const response = await handler(postRequest({ message: `msg ${i}` }, ip));
    assert.equal(response.statusCode, 200);
  }
  const blocked = await handler(postRequest({ message: "one too many" }, ip));
  assert.equal(blocked.statusCode, 429);

  // A different edge IP is not affected.
  const other = await handler(postRequest({ message: "fresh ip" }, "203.0.113.43"));
  assert.equal(other.statusCode, 200);
});

test("the system prompts embed the observed price list and knowledge guardrails", async () => {
  await handler(postRequest({ message: "hi", brand: "motis" }, "203.0.113.44"));
  const prompt = generateContentCalls[0].config.systemInstruction;
  assert.ok(prompt.includes("business_artifact"));
  assert.ok(prompt.includes("observed"));
  assert.ok(prompt.includes("Satin Drums"));
  assert.ok(prompt.includes("requires confirmation from a Motis representative"));
});
