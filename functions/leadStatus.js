const LEAD_STATUSES = Object.freeze([
  "new",
  "contacted",
  "qualified",
  "won",
  "lost",
]);

function isLeadStatus(value) {
  return typeof value === "string" && LEAD_STATUSES.includes(value);
}

function normalizeLegacyLeadStatus(value) {
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();
  const mappings = {
    new: "new",
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

  return mappings[normalized] || null;
}

module.exports = { LEAD_STATUSES, isLeadStatus, normalizeLegacyLeadStatus };
