const { GoogleGenAI } = require("@google/genai");
const { buildJsonResponse, getPublicCorsHeaders } = require("./utils/response");
const { isAllowed } = require("./utils/rateLimit");
const {
  KNOWLEDGE_GUARDRAILS,
  OBSERVED_PRICE_LIST_TEXT,
} = require("./utils/motisKnowledge");

// =====================================================================
// MOTIS AI QUOTE ASSISTANT - SERVERLESS FUNCTION
// Powered by Google Gemini (current @google/genai SDK)
// =====================================================================

const MAX_BODY_BYTES = 64 * 1024;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_TURNS = 20;
const HISTORY_ROLES = ["user", "model"];

const MORE_PAINT_SYSTEM_PROMPT = `You are the "AI Sales & Technical Inquiry Assistant" for **More Paint**, the flagship architectural coating brand of **Motis Industries Limited**. You are an AI assistant, not a professional chemist.

Your role is to help B2C homeowners, interior designers, and local painting contractors explore the More Paint catalog, estimate indicative paint volumes, and provide general application guidance. All specific product values below are indicative marketing descriptions and must be confirmed with Motis sales before any purchase or application decision.

### More Paint Product Catalog (indicative marketing descriptions — confirm details with Motis sales):
1. **Weather-Shield Exterior Acrylic** — Marketed for high humidity, salt-air coastal exposure, and intense UV. Indicative coverage: ~10-12 sqm/L per coat. Typically applied in 2 coats. Commonly used for: External facades, perimeter fences.
2. **Premium Silk Interior Emulsion** — Marketed as a stain-resistant, washable interior finish. Indicative coverage: ~12-14 sqm/L per coat. Typically applied in 2 coats. Commonly used for: Bedrooms, living rooms, corridors.
3. **Industrial Floor Epoxy Coat** — Marketed as a chemical-resistant self-leveling floor epoxy. Indicative coverage: ~6-8 sqm/L per coat. Typically applied in 2 coats. Commonly used for: Garages, parking decks, warehouses.
4. **Contractor Prep Undercoat** — Marketed as a high-adhesion base primer for porous bare plaster and new construction. Indicative coverage: ~10 sqm/L per coat. Typically applied as 1 coat.

### Estimation Formula (general industry method — indicative only):
- Wall area (sqm) = (Room Perimeter × Wall Height) — openings (~2 sqm/door, ~1.5 sqm/window)
- Paint needed (litres) = Wall area ÷ Coverage rate × Number of coats + 10% waste margin.
- Round UP to practical whole containers; available pack sizes must be confirmed with Motis sales.

### Climate Advisory (Nigeria — general industry practice, not a MOTIS specification):
- In coastal high-salinity zones, industry practice commonly recommends a primer/undercoat under exterior topcoats to reduce salt-related peeling, with an added safety margin. Whether a specific MOTIS product combination or margin applies must be confirmed with Motis sales.
- Inland (Abuja, Kano, Enugu): standard general estimation rules apply.

### Output Rules:
1. Be warm, helpful, and technically informed, and brief (max 4 paragraphs or 1 paragraph + 1 Markdown table). You are an assistant — do not present yourself as a professional chemist or estimator of record.
2. Never quote prices for the More Paint catalog above — redirect to sales representatives. For observed price-list entries, follow the Knowledge & Provenance Rules below.
3. End with a call to action to submit the B2C quote form or send their estimate to WhatsApp.

${KNOWLEDGE_GUARDRAILS}

### Observed MOTIS Price List (business artifact):
${OBSERVED_PRICE_LIST_TEXT}`;

const MOTIS_B2B_SYSTEM_PROMPT = `You are the "AI Sales & Technical Inquiry Assistant", the B2B inquiry assistant for **Motis Industries Limited**. You are an AI assistant, not a professional engineer.

Your role is to help enterprise buyers (procurement officers, real estate developers, warehouse managers, civil engineers) explore Motis B2B product categories — commercial chemical specifications, concrete sealants, floor epoxies, and large-scale architectural projects. The product descriptions below are indicative marketing descriptions and must be confirmed with Motis sales.

### Motis B2B Commercial Product Catalog (indicative marketing descriptions — confirm details with Motis sales):
1. **Commercial Floor Epoxy & Polyurethane Systems** — Marketed as high-load, chemical-resistant self-leveling screeds for industrial warehouses, parking zones, and manufacturing floors. Indicative coverage: ~6-8 sqm per litre. Typically applied in 2 coats.
2. **Polyurethane Waterproofing Membranes** — Marketed as high-elasticity liquid-applied membranes for flat roofs, balconies, and wet rooms. Performance ratings must be confirmed with Motis sales.
3. **High-Tensile Concrete Admixtures & Curing Agents** — Marketed as superplasticizers to support curing and strength in tropical climates.
4. **Sanitation & Hygiene Chemical Concentrates** — Marketed as high-dilution sanitizers and sterilizers designed for corporate offices, hotels, and food processing plants.
5. **Structural Adhesives & Sealants** — Marketed as heavy-duty silicone sealants and dual-part structural epoxies for facades, steel bonding, and expansion joints.

### B2B Advisory (Nigeria — general industry practice, not a MOTIS specification):
- B2B bulk orders are delivered direct-from-factory; logistics are confirmed with Motis sales.
- Technical Data Sheets (TDS) and Material Safety Data Sheets (MSDS) are available on request.
- In high-humidity coastal environments, industry practice commonly considers moisture-barrier concrete admixtures; whether a specific MOTIS product applies must be confirmed with Motis sales.

### Output Rules:
1. Be formal and analytical in tone, while remaining an AI assistant — never present yourself as a professional engineer.
2. Recommend chemical volume estimates in appropriate wholesale quantities where applicable; package sizes must be confirmed with Motis sales.
3. Never quote final wholesale prices for the catalog above — direct them to "Submit B2B Supply Protocol Form" or click B2B sales contact. For observed price-list entries, follow the Knowledge & Provenance Rules below.

${KNOWLEDGE_GUARDRAILS}

### Observed MOTIS Price List (business artifact):
${OBSERVED_PRICE_LIST_TEXT}`;

// Validates a supplied conversation history array. Missing, null, or
// non-array history is treated as empty. A supplied array must contain
// only well-formed {role, text} turns; any malformed turn is rejected
// rather than silently rewritten. Returns { history } or { error }.
function validateHistory(rawHistory) {
  if (rawHistory === undefined || rawHistory === null || !Array.isArray(rawHistory)) {
    return { history: [] };
  }

  if (rawHistory.length > MAX_HISTORY_TURNS) {
    return { error: "Invalid request: history is too long." };
  }

  const history = [];
  for (const turn of rawHistory) {
    const isValidTurn =
      turn &&
      typeof turn === "object" &&
      !Array.isArray(turn) &&
      HISTORY_ROLES.includes(turn.role) &&
      typeof turn.text === "string" &&
      turn.text.length > 0 &&
      turn.text.length <= MAX_MESSAGE_LENGTH;

    if (!isValidTurn) {
      return { error: "Invalid request: history contains a malformed turn." };
    }

    history.push({ role: turn.role, parts: [{ text: turn.text }] });
  }

  return { history };
}

function buildModelContents(history, message) {
  return [...history, { role: "user", parts: [{ text: message }] }];
}

exports.handler = async (event, context) => {
  const headers = getPublicCorsHeaders("POST, OPTIONS");

  // Preflight CORS
  if (event.httpMethod === "OPTIONS") {
    return buildJsonResponse(200, { message: "OK" }, headers);
  }

  // Only accept POST
  if (event.httpMethod !== "POST") {
    return buildJsonResponse(405, { message: "Method Not Allowed" }, headers);
  }

  // Best-effort abuse damping (per-function-instance; see rateLimit.js)
  if (!isAllowed(event)) {
    return buildJsonResponse(
      429,
      { message: "Too many requests. Please wait a moment and try again." },
      headers,
    );
  }

  // Reject oversized payloads before parsing
  if ((event.body || "").length > MAX_BODY_BYTES) {
    return buildJsonResponse(
      413,
      { message: "Request payload is too large." },
      headers,
    );
  }

  // Parse incoming request
  let body;
  try {
    body = JSON.parse(event.body);
  } catch (err) {
    return buildJsonResponse(400, { message: "Invalid JSON request body" }, headers);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return buildJsonResponse(400, { message: "Invalid JSON request body" }, headers);
  }

  // Extract conversation history, new user message, and brand division
  const { message, history: rawHistory, brand = "more_paint" } = body;

  if (typeof message !== "string" || !message.trim()) {
    return buildJsonResponse(400, { message: "A message is required." }, headers);
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return buildJsonResponse(
      400,
      { message: "Message is too long. Please shorten your request." },
      headers,
    );
  }

  // Conversation history must be well-formed or absent; malformed
  // history is rejected, never silently rewritten or forwarded.
  const { history, error: historyError } = validateHistory(rawHistory);
  if (historyError) {
    return buildJsonResponse(400, { message: historyError }, headers);
  }

  // Validate API key configuration
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Configuration Error: GEMINI_API_KEY missing from Environment Variables!");
    return buildJsonResponse(
      500,
      { message: "AI service is not configured. Please contact the administrator." },
      headers,
    );
  }

  // Select prompt dynamically based on brand division
  const selectedInstructionPrompt =
    brand === "motis" ? MOTIS_B2B_SYSTEM_PROMPT : MORE_PAINT_SYSTEM_PROMPT;

  try {
    // Initialize Gemini client (current @google/genai SDK)
    const ai = new GoogleGenAI({ apiKey });

    // Use Gemini Flash for speed and cost-efficiency
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
      contents: buildModelContents(history, message.trim()),
      config: { systemInstruction: selectedInstructionPrompt },
    });

    const aiResponse = response.text;
    if (!aiResponse) {
      console.error("Gemini AI returned an empty or blocked response");
      return buildJsonResponse(
        502,
        { message: "The AI estimator could not answer that request. Please try again." },
        headers,
      );
    }

    return buildJsonResponse(
      200,
      {
        success: true,
        reply: aiResponse,
      },
      headers,
    );
  } catch (error) {
    console.error("Gemini AI API Error:", error);
    return buildJsonResponse(
      500,
      { message: "The AI estimator encountered an error. Please try again." },
      headers,
    );
  }
};
