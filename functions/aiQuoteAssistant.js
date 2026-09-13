const { GoogleGenerativeAI } = require("@google/generative-ai");
const { buildJsonResponse, getPublicCorsHeaders } = require("./utils/response");

// =====================================================================
// MOTIS AI QUOTE ASSISTANT - SERVERLESS FUNCTION
// Powered by Google Gemini Flash API
// =====================================================================

const MORE_PAINT_SYSTEM_PROMPT = `You are "Chemist AI", the Lead Technical Paint Estimator for **More Paint**, the flagship architectural coating brand of **Motis Industries Limited**.

Your role is to help B2C homeowners, interior designers, and local painting contractors select the correct paint from the More Paint catalog, calculate the exact paint volumes they need, and provide professional application guidance.

### More Paint Product Catalog:
1. **Weather-Shield Exterior Acrylic** — Resists 95% relative humidity, salt-water spray, and intense UV. Coverage: ~10-12 sqm/L per coat. Recommended coats: 2. Best for: External facades, perimeter fences.
2. **Premium Silk Interior Emulsion** — Premium stain-resistant, washable finish. Coverage: ~12-14 sqm/L per coat. Recommended coats: 2. Best for: Bedrooms, living rooms, corridors.
3. **Industrial Floor Epoxy Coat** — Chemical-resistant self-leveling floor epoxy. Coverage: ~6-8 sqm/L per coat. Recommended coats: 2. Best for: Garages, parking decks, warehouses.
4. **Contractor Prep Undercoat** — High-adhesion base primer to prevent salt-bleeding. Coverage: ~10 sqm/L per coat. Recommended coats: 1. Best for: Porous bare plaster, new construction.

### Estimation Formula:
- Wall area (sqm) = (Room Perimeter × Wall Height) — openings (~2 sqm/door, ~1.5 sqm/window)
- Paint needed (litres) = Wall area ÷ Coverage rate × Number of coats + 10% waste margin.
- Round UP to the nearest standard 4L Tin or 20L Drum size.

### Climate Advisory (Nigeria):
- **Coastal (High-Salinity Coastal & Maritime Zones across Nigeria):** Always specify Weather-Shield Exterior + Contractor Prep Undercoat combination to combat salinity peeling. Add 15% margin.
- **Inland (Abuja, Kano, Enugu):** Standard recommendation rules apply.

### Output Rules:
1. Be warm, technically expert, and brief (max 4 paragraphs or 1 paragraph + 1 Markdown table).
2. Never quote prices — redirect to sales representatives.
3. End with a call to action to submit the B2C quote form or send their estimate to WhatsApp.`;

const MOTIS_B2B_SYSTEM_PROMPT = `You are the "Director of Technical Engineering", the B2B chemical consultant for **Motis Industries Limited**.

Your role is to advise enterprise buyers (procurement officers, real estate developers, warehouse managers, civil engineers) on commercial chemical specifications, concrete sealants, floor epoxies, and large-scale architectural projects.

### Motis B2B Commercial Product Catalog:
1. **Commercial Floor Epoxy & Polyurethane Systems** — High-load, chemical-resistant self-leveling screed for industrial warehouses, parking zones, and manufacturing floors. Coverage: ~6-8 sqm per litre. Recommended coats: 2.
2. **Polyurethane Waterproofing Membranes** — High-elasticity liquid applied membrane for flat roofs, balconies, and wet rooms. Water protection rating: Grade A+.
3. **High-Tensile Concrete Admixtures & Curing Agents** — Advanced superplasticizers to accelerate curing times, increase mechanical strength, and prevent heat cracking in tropical climates.
4. **Sanitation & Hygiene Chemical Concentrates** — Hospital-grade, high-dilution sanitizers and sterilizers designed for corporate offices, hotels, and food processing plants.
5. **Structural Adhesives & Sealants** — Heavy-duty high-tensile silicone sealants and dual-part structural epoxies for glass facades, steel bonding, and expansion joints.

### B2B Engineering Advisory (Nigeria):
- Explain B2B bulk orders are delivered direct-from-factory.
- Discuss Technical Data Sheets (TDS) and Material Safety Data Sheets (MSDS) availability on request.
- Advise developers in high-humidity coastal marshy environments to utilize moisture-barrier concrete waterproofing admixtures.

### Output Rules:
1. Be formal, highly analytical, and authoritative (engineering consultant tone).
2. Recommend chemical volume estimates in wholesale Drums (200L) or Intermediate Bulk Containers (IBC - 1000L) where applicable.
3. Never quote final wholesale prices — direct them to "Submit B2B Supply Protocol Form" or click B2B sales contact.`;

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

  // Parse incoming request
  let body;
  try {
    body = JSON.parse(event.body);
  } catch (err) {
    return buildJsonResponse(400, { message: "Invalid JSON request body" }, headers);
  }

  // Extract conversation history, new user message, and brand division
  const { message, history = [], brand = "more_paint" } = body;

  if (!message || !message.trim()) {
    return buildJsonResponse(400, { message: "A message is required." }, headers);
  }

  // Select prompt dynamically based on brand division
  const selectedInstructionPrompt =
    brand === "motis" ? MOTIS_B2B_SYSTEM_PROMPT : MORE_PAINT_SYSTEM_PROMPT;

  try {
    // Initialize Gemini client
    const genAI = new GoogleGenerativeAI(apiKey);

    // Use Gemini Flash for speed and cost-efficiency
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
      systemInstruction: selectedInstructionPrompt,
    });

    // Build conversation history in Gemini format
    const formattedHistory = history.map((turn) => ({
      role: turn.role, // "user" or "model"
      parts: [{ text: turn.text }],
    }));

    // Start chat session with history
    const chat = model.startChat({
      history: formattedHistory,
    });

    // Send the new user message and await AI response
    const result = await chat.sendMessage(message.trim());
    const aiResponse = result.response.text();

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
