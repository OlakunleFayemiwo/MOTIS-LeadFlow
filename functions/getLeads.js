const { createClient } = require("@supabase/supabase-js");
const { authErrorResponse, verifySession } = require("./crmAuth");
const { isLeadStatus } = require("./leadStatus");

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

exports.handler = async (event, context) => {
  // CRM responses must not be cached by a browser or intermediary.
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };

  // Handle preflight CORS request
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: "CORS Preflight Success" }),
    };
  }

  // Only accept GET requests
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ message: "Method Not Allowed" }),
    };
  }

  const session = verifySession(event);
  if (!session.authenticated) return authErrorResponse(headers, session.reason);

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

  // Extract query filters from URL
  const queryParams = event.queryStringParameters || {};
  const { brand, status } = queryParams;

  if (status !== undefined && !isLeadStatus(status)) {
    return {
      statusCode: 422,
      headers,
      body: JSON.stringify({ message: "Validation Failed: unsupported lead status filter." }),
    };
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseSecretKey);

    // Initialize query
    let query = supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false }); // Sort newest first!

    // Apply Brand dynamic filter (supporting Unilever-style scaling)
    if (brand && brand !== "all") {
      query = query.eq("brand", brand);
    }

    // Apply Status dynamic filter
    if (status !== undefined) {
      query = query.eq("status", status);
    }

    // Execute query
    const { data: leads, error } = await query;

    if (error) throw error;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        leads,
      }),
    };
  } catch (error) {
    console.error("Error retrieving leads from Supabase:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: "Internal Server Error while retrieving leads.",
      }),
    };
  }
};
