// =====================================================================
// MOTIS KNOWLEDGE LAYER - OBSERVED BUSINESS ARTIFACT DATA
// =====================================================================
// This module contains ONLY what was literally observed on a supplied
// MOTIS pricing list (a business artifact). Every entry preserves the
// observed product name and price exactly as written, including
// duplicate names that appear with different prices. No meaning,
// variant, package size, grade, coverage, drying time, formulation,
// chemistry, inventory level, or regulatory status has been inferred.
//
// This is intentionally NOT a catalogue, pricing engine, or RAG system.
// It is a lightweight, provenance-tagged reference injected into AI
// system prompts so the assistant can ground its answers in observed
// data and clearly flag anything that is not observed.
// =====================================================================

const SOURCE_TYPE = "business_artifact";
const VERIFICATION_STATUS = "observed";

// Observed pricing entries, in artifact order. Duplicate names are
// preserved intentionally and must never be merged, deduplicated, or
// reconciled — the reason for differing prices was not stated on the
// artifact and must not be inferred.
const OBSERVED_PRICE_ENTRIES = Object.freeze([
  { name: "Emulsion", price: 21200 },
  { name: "Deep Emulsion", price: 21400 },
  { name: "Texture", price: 27500 },
  { name: "Gloss", price: 20200 },
  { name: "Gallon", price: 4800 },
  { name: "Deep Gallon", price: 5000 },
  { name: "Texture", price: 34000 },
  { name: "Emulsion", price: 27000 },
  { name: "Gloss", price: 20800 },
  { name: "Satin Drums", price: 75000 },
  { name: "Satin Gallon", price: 18500 },
  { name: "Matt Emulsion", price: 72000 },
  { name: "Matt Sand", price: 72000 },
  { name: "Gold", price: 27500 },
  { name: "B / A", price: 27500 },
  { name: "C / MB", price: 21000 },
  { name: "C / MW", price: 21500 },
  { name: "Flex", price: 55000 },
  { name: "Magic Gloss", price: 18500 },
].map((entry) => ({
  ...entry,
  source_type: SOURCE_TYPE,
  verification_status: VERIFICATION_STATUS,
})));

// Guardrail instructions appended to AI system prompts. They allow
// general industry explanation but forbid presenting it as a
// MOTIS-specific fact, and require human confirmation for anything
// MOTIS-specific that is not in the observed data.
const KNOWLEDGE_GUARDRAILS = `### Knowledge & Provenance Rules:
1. You may explain GENERAL industry concepts (e.g. what an emulsion paint is, why primer matters), but you must NEVER present general industry knowledge as a MOTIS-specific fact.
2. MOTIS-specific facts you may state are limited to the observed price list provided above, which is an observed business artifact (source_type: business_artifact, verification_status: observed).
3. The observed list contains duplicate product names with different prices. Do not explain, reconcile, or speculate about the differences. Quote only when the customer's request clearly matches one observed entry, otherwise ask which one they mean.
4. If a customer asks for any MOTIS-specific information that is NOT in the observed data (product variants, package sizes, grades, specifications, coverage, drying times, formulation, chemical composition, availability, certifications, or anything else), clearly state that the information requires confirmation from a Motis representative. Never guess or invent it.
5. Never claim independent verification of any MOTIS data. Prices and details must be confirmed with Motis sales before any order.`;

// Text rendering of the observed price list for injection into prompts.
// Names are kept verbatim (including "B / A" spacing); prices are in
// Naira exactly as observed on the artifact.
const OBSERVED_PRICE_LIST_TEXT = OBSERVED_PRICE_ENTRIES.map(
  (entry) => `- ${entry.name}: NGN ${entry.price.toLocaleString("en-NG")}`,
).join("\n");

module.exports = {
  KNOWLEDGE_GUARDRAILS,
  OBSERVED_PRICE_ENTRIES,
  OBSERVED_PRICE_LIST_TEXT,
  SOURCE_TYPE,
  VERIFICATION_STATUS,
};
