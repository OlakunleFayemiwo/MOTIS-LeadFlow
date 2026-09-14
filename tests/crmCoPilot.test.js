const assert = require("node:assert/strict");
const test = require("node:test");

process.env.CRM_ADMIN_PASSWORD = "test-password";
process.env.CRM_SESSION_SECRET = "test-session-secret";
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SECRET_KEY = "test-supabase-secret";
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
        return { text: JSON.stringify(geminiReply) };
      },
    };
  }
}

let geminiReply = {};
const genaiPath = require.resolve("@google/genai");
require.cache[genaiPath] = {
  id: genaiPath,
  filename: genaiPath,
  loaded: true,
  exports: { GoogleGenAI: FakeGoogleGenAI },
};

// Mock the Supabase client at runtime. supabaseClient.js destructures
// createClient when it is first required (after this mock is installed),
// so the mock closure reads from this mutable holder to let individual
// tests change the query result.
let supabaseLeadsResult = {
  data: [
    {
      id: "123e4567-e89b-42d3-a456-426614174000",
      name: "Ada Lovelace",
      phone: "08000000000",
      email: null,
      location: "Lagos",
      brand: "motis_industrial",
      product_line: "motis_industrial_epoxy",
      quantity: "20 Drums",
      status: "new",
      message: "Need epoxy coating for a warehouse floor.",
      admin_notes: null,
    },
  ],
  error: null,
};
let queriedLeadId;
require("@supabase/supabase-js").createClient = () => ({
  from: () => ({
    select: () => ({
      eq: (field, value) => {
        queriedLeadId = value;
        return Promise.resolve(supabaseLeadsResult);
      },
    }),
  }),
});

const rateLimit = require("../functions/utils/rateLimit");
const login = require("../functions/crmLogin").handler;
const coPilot = require("../functions/crmCoPilot").handler;

const LEAD_ID = "123e4567-e89b-42d3-a456-426614174000";

function fullReply() {
  return {
    lead_summary: "Warehouse buyer requesting epoxy.",
    customer_intent: "Purchase floor epoxy.",
    missing_information: "Floor condition and dimensions unknown.",
    qualification_observations: "Clear commercial intent.",
    suggested_response_draft: "Dear Ada, thank you for your inquiry...",
  };
}

async function authenticatedCookie() {
  const loginResponse = await login({
    httpMethod: "POST",
    body: '{"password":"test-password"}',
  });
  return loginResponse.headers["Set-Cookie"].split(";")[0];
}

test.beforeEach(() => {
  rateLimit.reset();
  generateContentCalls = [];
  geminiReply = fullReply();
});

test("unauthenticated requests are rejected with 401", async () => {
  const response = await coPilot({
    httpMethod: "POST",
    headers: {},
    body: JSON.stringify({ leadId: LEAD_ID }),
  });
  assert.equal(response.statusCode, 401);
  assert.equal(generateContentCalls.length, 0);
});

test("non-POST and preflight requests are handled without the AI", async () => {
  const cookie = await authenticatedCookie();
  const getResponse = await coPilot({ httpMethod: "GET", headers: { cookie } });
  assert.equal(getResponse.statusCode, 405);

  const optionsResponse = await coPilot({
    httpMethod: "OPTIONS",
    headers: { cookie },
  });
  assert.equal(optionsResponse.statusCode, 200);
  assert.equal(generateContentCalls.length, 0);
});

test("invalid bodies and lead IDs return 400", async () => {
  const cookie = await authenticatedCookie();
  const cases = [
    "not json",
    "{}",
    JSON.stringify({ leadId: "not-a-uuid" }),
    JSON.stringify({ leadId: "123e4567-e89b-02d3-a456-426614174000" }),
  ];
  for (const body of cases) {
    const response = await coPilot({
      httpMethod: "POST",
      headers: { cookie },
      body,
    });
    assert.equal(response.statusCode, 400);
  }
  assert.equal(generateContentCalls.length, 0);
});

test("an authenticated valid request returns the five Co-Pilot sections", async () => {
  const cookie = await authenticatedCookie();
  const response = await coPilot({
    httpMethod: "POST",
    headers: { cookie },
    body: JSON.stringify({ leadId: LEAD_ID }),
  });

  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.success, true);
  assert.deepEqual(Object.keys(body.coPilot).sort(), [
    "customer_intent",
    "lead_summary",
    "missing_information",
    "qualification_observations",
    "suggested_response_draft",
  ]);
  assert.equal(queriedLeadId, LEAD_ID);
});

test("the Gemini prompt embeds the real lead context and production prohibitions", async () => {
  const cookie = await authenticatedCookie();
  await coPilot({
    httpMethod: "POST",
    headers: { cookie },
    body: JSON.stringify({ leadId: LEAD_ID }),
  });

  const [params] = generateContentCalls;
  assert.equal(params.model, "gemini-3.6-flash");
  assert.ok(params.contents.includes("Ada Lovelace"));
  assert.ok(params.contents.includes("Need epoxy coating for a warehouse floor."));
  const prompt = params.config.systemInstruction;
  assert.ok(prompt.includes("never"));
  assert.ok(prompt.includes("manufacturing, formulation, chemical production"));
  assert.ok(prompt.includes("work order"));
});

test("a malformed or incomplete model response returns 502", async () => {
  geminiReply = { lead_summary: "only one field" };
  const cookie = await authenticatedCookie();
  const response = await coPilot({
    httpMethod: "POST",
    headers: { cookie },
    body: JSON.stringify({ leadId: LEAD_ID }),
  });
  assert.equal(response.statusCode, 502);
});

test("an empty Supabase result returns 404", async () => {
  const original = supabaseLeadsResult;
  supabaseLeadsResult = { data: [], error: null };
  try {
    const cookie = await authenticatedCookie();
    const response = await coPilot({
      httpMethod: "POST",
      headers: { cookie },
      body: JSON.stringify({ leadId: LEAD_ID }),
    });
    assert.equal(response.statusCode, 404);
  } finally {
    supabaseLeadsResult = original;
  }
});
