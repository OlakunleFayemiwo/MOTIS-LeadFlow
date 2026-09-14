const assert = require("node:assert/strict");
const test = require("node:test");

const {
  KNOWLEDGE_GUARDRAILS,
  OBSERVED_PRICE_ENTRIES,
  OBSERVED_PRICE_LIST_TEXT,
  SOURCE_TYPE,
  VERIFICATION_STATUS,
} = require("../functions/utils/motisKnowledge");

test("contains exactly the 19 observed entries in artifact order", () => {
  assert.equal(OBSERVED_PRICE_ENTRIES.length, 19);
  assert.deepEqual(
    OBSERVED_PRICE_ENTRIES.map((e) => [e.name, e.price]),
    [
      ["Emulsion", 21200],
      ["Deep Emulsion", 21400],
      ["Texture", 27500],
      ["Gloss", 20200],
      ["Gallon", 4800],
      ["Deep Gallon", 5000],
      ["Texture", 34000],
      ["Emulsion", 27000],
      ["Gloss", 20800],
      ["Satin Drums", 75000],
      ["Satin Gallon", 18500],
      ["Matt Emulsion", 72000],
      ["Matt Sand", 72000],
      ["Gold", 27500],
      ["B / A", 27500],
      ["C / MB", 21000],
      ["C / MW", 21500],
      ["Flex", 55000],
      ["Magic Gloss", 18500],
    ],
  );
});

test("duplicate product names are preserved, never merged or reconciled", () => {
  const counts = {};
  OBSERVED_PRICE_ENTRIES.forEach(({ name }) => {
    counts[name] = (counts[name] || 0) + 1;
  });
  assert.equal(counts["Texture"], 2);
  assert.equal(counts["Emulsion"], 2);
  assert.equal(counts["Gloss"], 2);
  assert.equal(counts["Gold"], 1);
});

test("every entry carries business-artifact provenance and no invented fields", () => {
  OBSERVED_PRICE_ENTRIES.forEach((entry) => {
    assert.deepEqual(Object.keys(entry).sort(), [
      "name",
      "price",
      "source_type",
      "verification_status",
    ]);
    assert.equal(entry.source_type, "business_artifact");
    assert.equal(entry.verification_status, "observed");
  });
  assert.equal(SOURCE_TYPE, "business_artifact");
  assert.equal(VERIFICATION_STATUS, "observed");
});

test("observed names are kept verbatim, including spacing", () => {
  const names = OBSERVED_PRICE_ENTRIES.map((e) => e.name);
  assert.ok(names.includes("B / A"));
  assert.ok(names.includes("C / MB"));
  assert.ok(names.includes("C / MW"));
  assert.ok(names.includes("Satin Drums"));
});

test("guardrails forbid MOTIS-specific invention and demand human confirmation", () => {
  const guardrails = KNOWLEDGE_GUARDRAILS.toLowerCase();
  assert.ok(
    guardrails.includes(
      "never present general industry knowledge as a motis-specific fact",
    ),
  );
  assert.ok(
    KNOWLEDGE_GUARDRAILS.includes(
      "requires confirmation from a Motis representative",
    ),
  );
  assert.ok(KNOWLEDGE_GUARDRAILS.includes("Never guess or invent it"));
  assert.ok(KNOWLEDGE_GUARDRAILS.includes("business_artifact"));
  assert.ok(KNOWLEDGE_GUARDRAILS.includes("duplicate product names"));
});

test("the prompt-rendered price list reflects every observed entry", () => {
  OBSERVED_PRICE_ENTRIES.forEach(({ name, price }) => {
    assert.ok(
      OBSERVED_PRICE_LIST_TEXT.includes(`${name}: NGN ${price.toLocaleString("en-NG")}`),
      `price list text is missing ${name}`,
    );
  });
});
