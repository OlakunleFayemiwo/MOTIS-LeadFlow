const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migrationPath = path.join(
  __dirname,
  "..",
  "migrations",
  "202609100001_standardize_lead_statuses.sql",
);
const migration = fs.readFileSync(migrationPath, "utf8");

test("migration checks unexpected broad public policies before data changes", () => {
  const policyCheckIndex = migration.indexOf("from pg_policies");
  const statusUpdateIndex = migration.indexOf("update public.leads");

  assert.ok(policyCheckIndex >= 0);
  assert.ok(policyCheckIndex < statusUpdateIndex);
  assert.match(migration, /roles && array\['public', 'anon', 'authenticated'\]::name\[\]/);
  assert.match(migration, /cmd = 'ALL'/);
  assert.match(migration, /unexpected permissive policy/);
});

test("migration removes only the known legacy policy automatically", () => {
  assert.match(
    migration,
    /drop policy if exists "Allow Netlify service role full access" on public\.leads/,
  );
  assert.doesNotMatch(migration, /drop policy.*pg_policies/i);
});
