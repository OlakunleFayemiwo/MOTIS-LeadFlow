const { createClient } = require("@supabase/supabase-js");
const { authErrorResponse, verifySession } = require("./crmAuth");
const { isLeadStatus } = require("./leadStatus");

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_ADMIN_NOTES_LENGTH = 5000;

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

  // Only accept POST requests for update operation
  if (event.httpMethod !== "POST") {
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

  const { leadId, status, admin_notes } = body;

  // Validate required update fields
  if (
    typeof leadId !== "string" ||
    !UUID_PATTERN.test(leadId) ||
    (status === undefined && admin_notes === undefined)
  ) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        message: "Validation Failed: a valid leadId and an update field are required.",
      }),
    };
  }

  if (status !== undefined && !isLeadStatus(status)) {
    return {
      statusCode: 422,
      headers,
      body: JSON.stringify({ message: "Validation Failed: unsupported lead status." }),
    };
  }

  if (
    admin_notes !== undefined &&
    (typeof admin_notes !== "string" ||
      admin_notes.length > MAX_ADMIN_NOTES_LENGTH)
  ) {
    return {
      statusCode: 422,
      headers,
      body: JSON.stringify({
        message: "Validation Failed: admin_notes must be text up to 5000 characters.",
      }),
    };
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseSecretKey);

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
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ message: "Lead record not found" }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: "Lead updated successfully",
        lead: updatedLeads[0],
      }),
    };
  } catch (error) {
    console.error("Error updating lead record in Supabase:", error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: "Internal Server Error while updating lead.",
      }),
    };
  }
};
