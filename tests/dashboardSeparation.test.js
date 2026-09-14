const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const dashboardPath = path.join(__dirname, "..", "public", "admin", "dashboard.js");
const adminIndexPath = path.join(__dirname, "..", "public", "admin", "index.html");
const dashboard = fs.readFileSync(dashboardPath, "utf8");
const adminIndex = fs.readFileSync(adminIndexPath, "utf8");

test("dashboard no longer derives technical formulas from sales leads", () => {
  assert.doesNotMatch(dashboard, /constituentBase|constituentPigment|workslipFormulaBody/);
  assert.doesNotMatch(dashboard, /Titanium Dioxide|Dispersion Room|Blending Ratio/);
  assert.doesNotMatch(dashboard, /BATCH-#M/);
  assert.doesNotMatch(dashboard, /Chemical Ticket/);
});

test("production view is framed as fulfillment review with explicit separation", () => {
  assert.ok(dashboard.includes("Review Summary"));
  assert.ok(adminIndex.includes("Fulfillment Review"));
  assert.ok(
    adminIndex.includes("does <strong>not</strong> authorize manufacturing, formulation, chemical production, or any production work order"),
  );
  assert.ok(adminIndex.includes("Sales Outcome — Not a Production Order"));
  assert.ok(adminIndex.includes('>Won</option>'));
  assert.doesNotMatch(adminIndex, /Send to Factory/);
});

test("unverified commercial figures are labelled as illustrative demo assumptions", () => {
  assert.ok(
    dashboard.includes("ILLUSTRATIVE DEMO FIGURES ONLY — not verified MOTIS pricing"),
  );
  assert.ok(dashboard.includes("Illustrative Demo"));
  assert.ok(
    adminIndex.includes("Illustrative — not verified MOTIS pricing"),
  );
});

test("the Co-Pilot is wired to the authenticated AI endpoint", () => {
  assert.ok(dashboard.includes("/.netlify/functions/crmCoPilot"));
  assert.ok(dashboard.includes("generateCoPilotDraft"));
  assert.ok(!dashboard.includes("Mock Gemini response compilation logic"));
  assert.ok(adminIndex.includes('id="generateCoPilotBtn"'));
  assert.ok(adminIndex.includes('id="copilotSections"'));
  assert.ok(adminIndex.includes("review before sending"));
});
