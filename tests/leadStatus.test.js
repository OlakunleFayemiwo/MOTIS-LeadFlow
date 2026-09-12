const assert = require("node:assert/strict");
const test = require("node:test");

const {
  LEAD_STATUSES,
  isLeadStatus,
  normalizeLegacyLeadStatus,
} = require("../functions/leadStatus");

test("only the five canonical lead statuses are valid", () => {
  assert.deepEqual(LEAD_STATUSES, ["new", "contacted", "qualified", "won", "lost"]);
  LEAD_STATUSES.forEach((status) => assert.equal(isLeadStatus(status), true));
  ["New", "pending", "in progress", "", null].forEach((status) =>
    assert.equal(isLeadStatus(status), false),
  );
});

test("legacy status normalization matches the database migration", () => {
  const mappings = {
    " New ": "new",
    pending: "new",
    contacted: "contacted",
    qualified: "qualified",
    "in progress": "qualified",
    "in-progress": "qualified",
    in_progress: "qualified",
    won: "won",
    "closed won": "won",
    "closed-won": "won",
    closed_won: "won",
    lost: "lost",
    "closed lost": "lost",
    "closed-lost": "lost",
    closed_lost: "lost",
  };

  Object.entries(mappings).forEach(([legacyStatus, canonicalStatus]) => {
    assert.equal(normalizeLegacyLeadStatus(legacyStatus), canonicalStatus);
  });
  assert.equal(normalizeLegacyLeadStatus("awaiting payment"), null);
});
