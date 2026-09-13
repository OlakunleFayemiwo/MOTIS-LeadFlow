const { getSupabaseClient } = require("./utils/supabaseClient");
const { buildJsonResponse, getPublicCorsHeaders } = require("./utils/response");

exports.handler = async (event, context) => {
  const headers = getPublicCorsHeaders("POST, OPTIONS");

  // Handle preflight CORS request
  if (event.httpMethod === "OPTIONS") {
    return buildJsonResponse(200, { message: "CORS Preflight Success" }, headers);
  }

  // Only accept POST requests
  if (event.httpMethod !== "POST") {
    return buildJsonResponse(405, { message: "Method Not Allowed" }, headers);
  }

  // Parse incoming JSON body
  let body;
  try {
    body = JSON.parse(event.body);
  } catch (err) {
    return buildJsonResponse(400, { message: "Invalid JSON request body" }, headers);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return buildJsonResponse(400, { message: "Request body must be an object" }, headers);
  }

  if (Object.prototype.hasOwnProperty.call(body, "status")) {
    return buildJsonResponse(
      400,
      { message: "Lead status is assigned by the server" },
      headers,
    );
  }

  // Destructure the public fields explicitly allowed into a lead record.
  const {
    name,
    phone,
    email,
    location,
    product_line,
    quantity,
    message,
    brand,
    referrer_id,
    ai_estimation,
  } = body;

  // Validate required fields (following strict PRD specification)
  const requiredFields = { name, phone, location, product_line, message };
  if (
    Object.values(requiredFields).some(
      (value) => typeof value !== "string" || !value.trim(),
    )
  ) {
    return buildJsonResponse(
      400,
      {
        message:
          "Validation Failed: name, phone, location, product_line, and message are required.",
      },
      headers,
    );
  }

  // Initialize Supabase Client
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error(
      "Configuration Error: Supabase credentials missing in Environment Variables!",
    );
    return buildJsonResponse(
      500,
      { message: "Server database configuration is missing." },
      headers,
    );
  }

  try {
    // Insert lead into Supabase PostgreSQL database
    const { data, error } = await supabase
      .from("leads")
      .insert([
        {
          name: name.trim(),
          phone: phone.trim(),
          email: typeof email === "string" && email ? email.trim() : null,
          location: location.trim(),
          product_line: product_line.trim(),
          quantity: typeof quantity === "string" && quantity ? quantity.trim() : null,
          message: message.trim(),
          brand: typeof brand === "string" && brand ? brand.trim() : "motis_industrial",
          referrer_id:
            typeof referrer_id === "string" && referrer_id
              ? referrer_id.trim()
              : null,
          ai_estimation: ai_estimation || null,
          status: "new",
        },
      ])
      .select();

    if (error) throw error;

    return buildJsonResponse(
      200,
      {
        success: true,
        message: "Lead captured successfully",
        lead: data[0],
      },
      headers,
    );
  } catch (error) {
    console.error("Error writing lead record to Supabase:", error);
    return buildJsonResponse(
      500,
      { message: "Internal Server Error while saving lead." },
      headers,
    );
  }
};
