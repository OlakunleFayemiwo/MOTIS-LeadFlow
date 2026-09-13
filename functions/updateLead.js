const { authErrorResponse, verifySession } = require("./crmAuth");
const { isLeadStatus } = require("./leadStatus");
const { getSupabaseClient } = require("./utils/supabaseClient");
const { buildJsonResponse, getCrmHeaders } = require("./utils/response");

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_ADMIN_NOTES_LENGTH = 5000;

exports.handler = async (event, context) => {
  const headers = getCrmHeaders(event, "POST, OPTIONS");

  // Handle preflight CORS request
  if (event.httpMethod === "OPTIONS") {
    return buildJsonResponse(200, { message: "CORS Preflight Success" }, headers);
  }

  // Only accept POST requests for update operation
  if (event.httpMethod !== "POST") {
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

  const { leadId, status, admin_notes } = body;

  // Validate required update fields
  if (
    typeof leadId !== "string" ||
    !UUID_PATTERN.test(leadId) ||
    (status === undefined && admin_notes === undefined)
  ) {
    return buildJsonResponse(
      400,
      {
        message: "Validation Failed: a valid leadId and an update field are required.",
      },
      headers,
    );
  }

  if (status !== undefined && !isLeadStatus(status)) {
    return buildJsonResponse(
      422,
      { message: "Validation Failed: unsupported lead status." },
      headers,
    );
  }

  if (
    admin_notes !== undefined &&
    (typeof admin_notes !== "string" ||
      admin_notes.length > MAX_ADMIN_NOTES_LENGTH)
  ) {
    return buildJsonResponse(
      422,
      {
        message: "Validation Failed: admin_notes must be text up to 5000 characters.",
      },
      headers,
    );
  }

  try {
    // Prepare fields to update
    const updateData = {};
    if (status !== undefined) updateData.status = status;
    if (admin_notes !== undefined) updateData.admin_notes = admin_notes.trim();

    // Update the record in Supabase
    const { data: updatedLeads, error } = await supabase
      .from("leads")
      .update(updateData)
      .eq("id", leadId)
      .select();

    if (error) throw error;

    if (!updatedLeads || updatedLeads.length === 0) {
      return buildJsonResponse(404, { message: "Lead record not found" }, headers);
    }

    return buildJsonResponse(
      200,
      {
        success: true,
        message: "Lead updated successfully",
        lead: updatedLeads[0],
      },
      headers,
    );
  } catch (error) {
    console.error("Error updating lead record in Supabase:", error);

    return buildJsonResponse(
      500,
      {
        success: false,
        message: "Internal Server Error while updating lead.",
      },
      headers,
    );
  }
};
