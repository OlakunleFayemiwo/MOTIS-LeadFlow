const { GoogleGenAI } = require("@google/genai");
const { authErrorResponse, verifySession } = require("./crmAuth");
const { getSupabaseClient } = require("./utils/supabaseClient");
const { buildJsonResponse, getCrmHeaders } = require("./utils/response");

// =====================================================================
// MOTIS CRM AI CO-PILOT - AUTHENTICATED SERVERLESS FUNCTION
// Generates an AI-assisted review of a single lead for the CRM user.
// The human operator remains in control: output is advisory material
// for the operator to edit and send. This endpoint NEVER authorizes or
// triggers manufacturing, formulation, chemical production, work
// orders, or production instructions.
// =====================================================================

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_MODEL = "gemini-3.6-flash";

const OUTPUT_FIELDS = Object.freeze([
  "lead_summary",
  "customer_intent",
  "missing_information",
  "qualification_observations",
  "suggested_response_draft",
]);

const COPILOT_SYSTEM_PROMPT = `You are the MOTIS CRM AI Co-Pilot, an assistant for a Motis Industries sales operator reviewing a single customer lead.

Your task is to analyze the lead record provided by the operator and return STRICT JSON (no markdown fences, no extra text) with exactly these five string fields:
- "lead_summary": a brief factual summary of who the lead is and what they asked for.
- "customer_intent": what the customer appears to want, based only on the lead record.
- "missing_information": clarification questions for the customer — details not present in the lead record that a sales person would need before quoting or fulfilling.
- "qualification_observations": neutral observations about how qualified or ready the lead appears, and any risks.
- "suggested_response_draft": a professional draft reply the operator can edit and send.

### Hard limits on your output:
1. You are ADVISORY ONLY. Your output must never state or imply that manufacturing, formulation, chemical production, a work order, or any production instruction is authorized, scheduled, or underway. Never use production-authorization language ("we have begun production", "batch approved", "formulation created", etc.). Drafts must only commit to follow-up from the sales team.
2. Do not invent MOTIS-specific facts: product variants, package sizes, grades, specifications, coverage, drying times, formulation, chemical composition, availability, or certifications. If such information would be needed and is not in the lead record, raise it under "missing_information" instead.
3. Never quote or commit to final prices. Direct pricing questions to a Motis sales representative.
4. General industry knowledge may be used for explanation, but must never be presented as a MOTIS-specific fact.
5. Base every statement on the lead record provided. If the record is ambiguous, say so.`;

function buildLeadContext(lead) {
  const lines = [
    `Name: ${lead.name || "Not provided"}`,
    `Phone: ${lead.phone || "Not provided"}`,
    `Email: ${lead.email || "Not provided"}`,
    `Location: ${lead.location || "Not provided"}`,
    `Brand division: ${lead.brand || "Not provided"}`,
    `Product line: ${lead.product_line || "Not provided"}`,
    `Quantity requested: ${lead.quantity || "Not specified"}`,
    `Current status: ${lead.status || "Not provided"}`,
    `Customer message: ${lead.message || "Not provided"}`,
    `Operator notes: ${lead.admin_notes || "None"}`,
  ];
  return lines.join("\n");
}

// Extracts a JSON object from the model response, tolerating code
// fences. Returns null when no object with all five required string
// fields can be recovered.
function parseCoPilotResponse(text) {
  if (typeof text !== "string" || !text.trim()) return null;

  const stripped = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

  const result = {};
  for (const field of OUTPUT_FIELDS) {
    const value = parsed[field];
    if (typeof value !== "string" || !value.trim()) return null;
    result[field] = value.trim();
  }
  return result;
}

exports.handler = async (event) => {
  const headers = getCrmHeaders(event, "POST, OPTIONS");

  if (event.httpMethod === "OPTIONS") {
    return buildJsonResponse(200, { message: "CORS Preflight Success" }, headers);
  }

  if (event.httpMethod !== "POST") {
    return buildJsonResponse(405, { message: "Method Not Allowed" }, headers);
  }

  const session = verifySession(event);
  if (!session.authenticated) return authErrorResponse(headers, session.reason);

  let body;
  try {
    body = JSON.parse(event.body || "");
  } catch (err) {
    return buildJsonResponse(400, { message: "Invalid JSON request body" }, headers);
  }

  const { leadId } = body || {};
  if (typeof leadId !== "string" || !UUID_PATTERN.test(leadId)) {
    return buildJsonResponse(
      400,
      { message: "Validation Failed: a valid leadId is required." },
      headers,
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Configuration Error: GEMINI_API_KEY missing from Environment Variables!");
    return buildJsonResponse(
      500,
      { message: "AI service is not configured. Please contact the administrator." },
      headers,
    );
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error("Configuration Error: Supabase credentials missing in Environment Variables!");
    return buildJsonResponse(
      500,
      { message: "Server database configuration is missing." },
      headers,
    );
  }

  try {
    const { data: leads, error } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId);

    if (error) throw error;
    if (!leads || leads.length === 0) {
      return buildJsonResponse(404, { message: "Lead record not found" }, headers);
    }

    const leadContext = buildLeadContext(leads[0]);

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
      contents: `Lead record:\n${leadContext}`,
      config: { systemInstruction: COPILOT_SYSTEM_PROMPT },
    });

    const coPilot = parseCoPilotResponse(response.text);
    if (!coPilot) {
      console.error("CRM Co-Pilot: model response could not be parsed into the required JSON shape");
      return buildJsonResponse(
        502,
        { message: "The AI Co-Pilot could not complete the analysis. Please try again." },
        headers,
      );
    }

    return buildJsonResponse(200, { success: true, coPilot }, headers);
  } catch (error) {
    console.error("CRM Co-Pilot error:", error);
    return buildJsonResponse(
      500,
      { message: "The AI Co-Pilot encountered an error. Please try again." },
      headers,
    );
  }
};
