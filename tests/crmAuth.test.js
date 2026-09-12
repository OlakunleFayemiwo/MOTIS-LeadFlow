const assert = require("node:assert/strict");
const test = require("node:test");

process.env.CRM_ADMIN_PASSWORD = "test-password";
process.env.CRM_SESSION_SECRET = "test-session-secret";
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SECRET_KEY = "test-supabase-secret";

let insertedLead;
let appliedStatusFilter;
require("@supabase/supabase-js").createClient = () => ({
  from: () => ({
    select: () => ({
      order: () => ({
        eq: (field, value) => {
          if (field === "status") appliedStatusFilter = value;
          return Promise.resolve({
            data: [{ id: "lead-1", status: "new" }],
            error: null,
          });
        },
        then: (resolve, reject) =>
          Promise.resolve({ data: [{ id: "lead-1", status: "new" }], error: null }).then(
            resolve,
            reject,
          ),
      }),
    }),
    update: () => ({
      eq: () => ({
        select: async () => ({ data: [{ id: "lead-1", status: "won" }], error: null }),
      }),
    }),
    insert: (leads) => {
      insertedLead = leads[0];
      return {
        select: async () => ({ data: [insertedLead], error: null }),
      };
    },
  }),
});

const login = require("../functions/crmLogin").handler;
const getLeads = require("../functions/getLeads").handler;
const updateLead = require("../functions/updateLead").handler;
const captureLead = require("../functions/captureLead").handler;

test("CRM endpoints reject requests without a session", async () => {
  const getResponse = await getLeads({ httpMethod: "GET", headers: {} });
  const updateResponse = await updateLead({ httpMethod: "POST", headers: {}, body: "{}" });

  assert.equal(getResponse.statusCode, 401);
  assert.equal(updateResponse.statusCode, 401);
});

test("login validates request bodies and credentials", async () => {
  assert.equal((await login({ httpMethod: "POST", body: "not json" })).statusCode, 400);
  assert.equal((await login({ httpMethod: "POST", body: "{}" })).statusCode, 400);
  assert.equal(
    (await login({ httpMethod: "POST", body: '{"password":"wrong"}' })).statusCode,
    401,
  );
});

test("an authenticated update rejects malformed requests", async () => {
  const loginResponse = await login({
    httpMethod: "POST",
    body: '{"password":"test-password"}',
  });
  const cookie = loginResponse.headers["Set-Cookie"].split(";")[0];
  const response = await updateLead({
    httpMethod: "POST",
    headers: { cookie },
    body: "not json",
  });

  assert.equal(response.statusCode, 400);
});

test("an authenticated update validates lead IDs, statuses, and notes", async () => {
  const loginResponse = await login({
    httpMethod: "POST",
    body: '{"password":"test-password"}',
  });
  const cookie = loginResponse.headers["Set-Cookie"].split(";")[0];
  const headers = { cookie };

  assert.equal(
    (
      await updateLead({
        httpMethod: "POST",
        headers,
        body: '{"leadId":"not-a-uuid","status":"new"}',
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await updateLead({
        httpMethod: "POST",
        headers,
        body: '{"leadId":"123e4567-e89b-42d3-a456-426614174000","status":"pending"}',
      })
    ).statusCode,
    422,
  );
  assert.equal(
    (
      await updateLead({
        httpMethod: "POST",
        headers,
        body: '{"leadId":"123e4567-e89b-42d3-a456-426614174000","admin_notes":{}}',
      })
    ).statusCode,
    422,
  );
});

test("authenticated lead filtering only accepts canonical statuses", async () => {
  const loginResponse = await login({
    httpMethod: "POST",
    body: '{"password":"test-password"}',
  });
  const cookie = loginResponse.headers["Set-Cookie"].split(";")[0];

  const invalidResponse = await getLeads({
    httpMethod: "GET",
    headers: { cookie },
    queryStringParameters: { status: "pending" },
  });
  const allResponse = await getLeads({
    httpMethod: "GET",
    headers: { cookie },
    queryStringParameters: { status: "all" },
  });
  const validResponse = await getLeads({
    httpMethod: "GET",
    headers: { cookie },
    queryStringParameters: { status: "qualified" },
  });

  assert.equal(invalidResponse.statusCode, 422);
  assert.equal(allResponse.statusCode, 422);
  assert.equal(validResponse.statusCode, 200);
  assert.equal(appliedStatusFilter, "qualified");
});

test("public lead capture assigns new and rejects supplied statuses", async () => {
  const baseLead = {
    name: "Ada Lovelace",
    phone: "08000000000",
    location: "Lagos",
    product_line: "Industrial Paint",
    message: "Please contact me.",
  };
  const rejected = await captureLead({
    httpMethod: "POST",
    body: JSON.stringify({ ...baseLead, status: "won" }),
  });
  const accepted = await captureLead({
    httpMethod: "POST",
    body: JSON.stringify(baseLead),
  });

  assert.equal(rejected.statusCode, 400);
  assert.equal(accepted.statusCode, 200);
  assert.equal(insertedLead.status, "new");
});

test("a valid login creates a session accepted by each CRM endpoint", async () => {
  const loginResponse = await login({
    httpMethod: "POST",
    body: '{"password":"test-password"}',
  });
  const cookie = loginResponse.headers["Set-Cookie"].split(";")[0];

  assert.equal(loginResponse.statusCode, 200);
  assert.match(loginResponse.headers["Set-Cookie"], /HttpOnly; Secure; SameSite=Strict/);
  const getResponse = await getLeads({ httpMethod: "GET", headers: { cookie } });
  const updateResponse = await updateLead({
    httpMethod: "POST",
    headers: { cookie },
    body: '{"leadId":"123e4567-e89b-42d3-a456-426614174000","status":"won"}',
  });

  assert.equal(getResponse.statusCode, 200);
  assert.equal(JSON.parse(getResponse.body).leads[0].id, "lead-1");
  assert.equal(updateResponse.statusCode, 200);
  assert.equal(JSON.parse(updateResponse.body).lead.status, "won");
});
