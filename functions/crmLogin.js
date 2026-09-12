const {
  createSessionCookie,
  isLoginConfigured,
  verifyAdminPassword,
} = require("./crmAuth");

const headers = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { ...headers, Allow: "POST" },
      body: JSON.stringify({ message: "Method Not Allowed" }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || "");
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: "Invalid JSON request body" }),
    };
  }

  if (!body || typeof body.password !== "string" || !body.password) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: "A password is required" }),
    };
  }

  if (!isLoginConfigured()) {
    console.error("CRM login configuration is missing required environment variables");
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Authentication service is unavailable" }),
    };
  }

  if (!verifyAdminPassword(body.password)) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ message: "Invalid authentication credentials" }),
    };
  }

  try {
    return {
      statusCode: 200,
      headers: { ...headers, "Set-Cookie": createSessionCookie() },
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    console.error("CRM login configuration error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Authentication service is unavailable" }),
    };
  }
};
