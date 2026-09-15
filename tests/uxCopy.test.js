const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const read = (...parts) =>
  fs.readFileSync(path.join(__dirname, "..", ...parts), "utf8");

const dashboard = read("public", "admin", "dashboard.js");
const adminIndex = read("public", "admin", "index.html");
const b2bPage = read("public", "index.html");
const b2cPage = read("public", "more-paint.html");

test("WhatsApp CTA fallback never writes into the Project Specifications textarea", () => {
  assert.doesNotMatch(b2cPage, /msgBox\.value\s*=\s*`\[AI/);
  assert.doesNotMatch(b2bPage, /b2bMsgBox\.value\s*=\s*`\[AI/);

  // The fallback keeps the existing scroll-and-focus guidance behaviour.
  assert.ok(b2cPage.includes("document.getElementById('formMessage')"));
  assert.ok(b2bPage.includes("document.getElementById('b2bMessage')"));
  assert.ok(b2cPage.includes("scrollIntoView({ behavior: 'smooth' })"));
  assert.ok(b2bPage.includes("scrollIntoView({ behavior: 'smooth' })"));
});

test("CRM uses clear business terminology, not theatrical labels", () => {
  assert.ok(dashboard.includes("View Lead"));
  assert.ok(adminIndex.includes("Lead Details"));
  for (const stale of [
    "Protocol Spec",
    "Bid Specifications Protocol",
    "Master Authorization Key",
    "Admin Protocol",
    "Initiate Session",
    "Enterprise v2.0",
    "Sync Ledger",
    "Export Ledger",
    "Decrypting Ledger",
    "Ledger Empty",
    "Product Protocol",
    "Protocol Ledger",
  ]) {
    assert.ok(!dashboard.includes(stale), `dashboard.js still contains: ${stale}`);
    assert.ok(!adminIndex.includes(stale), `admin/index.html still contains: ${stale}`);
  }
});

test("CRM lead-update feedback uses in-page toasts, not browser alerts", () => {
  assert.ok(dashboard.includes("function showToast"));
  assert.ok(dashboard.includes("Lead updated successfully."));
  assert.ok(dashboard.includes("Unable to update lead. Please try again."));
  // No alert( call should remain in the dashboard (comment mention excluded).
  assert.doesNotMatch(dashboard.replace(/\/\/[^\n]*alert\(\)[^\n]*/g, ""), /\balert\(/);
});

test("public AI assistant keeps the neutral assistant role", () => {
  for (const stale of ["Chemist AI", "Technical Director AI", "Engineering Consultant", "Director of Technical"]) {
    assert.ok(!b2bPage.includes(stale), `index.html still contains: ${stale}`);
    assert.ok(!b2cPage.includes(stale), `more-paint.html still contains: ${stale}`);
  }
  assert.ok(b2bPage.includes("AI Sales & Technical Inquiry Assistant"));
  assert.ok(b2cPage.includes("AI Sales & Technical Inquiry Assistant"));
});

test("public forms do not showcase invented package sizes", () => {
  assert.ok(!/placeholder="e\.g\. \d+ Drums"/.test(b2bPage));
  assert.ok(!/placeholder="e\.g\. \d+ Drums"/.test(b2cPage));
  assert.ok(!b2bPage.includes("e.g. 50 Drums"));
  assert.ok(!b2cPage.includes("e.g. 50 Drums"));
  assert.ok(!b2cPage.includes("e.g. 100 Drums"));
});

test("static pages do not present unverified technical figures or certifications as fact", () => {
  const staleClaims = [
    "95% relative humidity",
    "Humidity Resilience Limit",
    "10+ Years",
    "molecular binder",
    "impenetrable",
    "Grade A+",
    "< 15g/L",
    "Zero VOC",
    "100% Pure Acrylic",
    "Washed Elastomeric",
    "ISO 12944",
    "ASTM D4060",
    "ASTM C494",
    "BS EN 934",
    "ISO 11600",
    "ASTM C920",
    "99.999",
    "NAFDAC",
  ];
  for (const claim of staleClaims) {
    assert.ok(!b2bPage.includes(claim), `index.html still contains: ${claim}`);
    assert.ok(!b2cPage.includes(claim), `more-paint.html still contains: ${claim}`);
  }
  // Spec details must point customers to MOTIS sales for confirmation.
  assert.ok(b2cPage.includes("confirm current coverage with MOTIS sales"));
  assert.ok(b2bPage.includes("documentation available on request"));
});
