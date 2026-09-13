const { authErrorResponse, verifySession } = require("./crmAuth");
const { isLeadStatus } = require("./leadStatus");
const { getSupabaseClient } = require("./utils/supabaseClient");
const { buildJsonResponse, getCrmHeaders } = require("./utils/response");

exports.handler = async (event, context) => {
  const headers = getCrmHeaders(event, "GET, OPTIONS");

  // Handle preflight CORS request
  if (event.httpMethod === "OPTIONS") {
    return buildJsonResponse(200, { message: "CORS Preflight Success" }, headers);
  }

  // Only accept GET requests
  if (event.httpMethod !== "GET") {
    return buildJsonResponse(405, { message: "Method Not Allowed" }, headers);
  }

  const session = verifySession(event);
  if (!session.authenticated) return authErrorResponse(headers, session.reason);

  // Check database configuration
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

  // Extract query filters from URL
  const queryParams = event.queryStringParameters || {};
  const { brand, status } = queryParams;

  if (status !== undefined && !isLeadStatus(status)) {
    return buildJsonResponse(
      422,
      { message: "Validation Failed: unsupported lead status filter." },
      headers,
    );
  }

  try {
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

    return buildJsonResponse(
      200,
      {
        success: true,
        leads,
      },
      headers,
    );
  } catch (error) {
    console.error("Error retrieving leads from Supabase:", error);
    return buildJsonResponse(
      500,
      { message: "Internal Server Error while retrieving leads." },
      headers,
    );
  }
};
