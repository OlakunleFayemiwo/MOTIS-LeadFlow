const { createClient } = require("@supabase/supabase-js");

// Initialize Supabase Client
// SUPABASE_URL and SUPABASE_SECRET_KEY are set securely in Netlify
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

exports.handler = async (event, context) => {
  // Setup CORS headers to allow modern frontend AJAX requests
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  // Handle preflight CORS request
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: "CORS Preflight Success" }),
    };
  }

  // Only accept POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ message: "Method Not Allowed" }),
    };
  }

  // Parse incoming JSON body
  let body;
  try {
    body = JSON.parse(event.body);
  } catch (err) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: "Invalid JSON request body" }),
    };
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: "Request body must be an object" }),
    };
  }

  if (Object.prototype.hasOwnProperty.call(body, "status")) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: "Lead status is assigned by the server" }),
    };
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

  // Validate required fields (following our strict PRD specification)
  const requiredFields = { name, phone, location, product_line, message };
  if (
    Object.values(requiredFields).some(
      (value) => typeof value !== "string" || !value.trim(),
    )
  ) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        message:
          "Validation Failed: name, phone, location, product_line, and message are required.",
      }),
    };
  }

  // Check database configuration
  if (!supabaseUrl || !supabaseSecretKey) {
    console.error(
      "Configuration Error: Supabase credentials missing in Environment Variables!",
    );
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: "Server database configuration is missing.",
      }),
    };
  }

  try {
    // Create Supabase Client with service key to securely bypass RLS policies
    const supabase = createClient(supabaseUrl, supabaseSecretKey);

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

    // Send successful response with the created lead details
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: "Lead captured successfully",
        lead: data[0],
      }),
    };
  } catch (error) {
    console.error("Error writing lead record to Supabase:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: "Internal Server Error while saving lead.",
      }),
    };
  }
};
