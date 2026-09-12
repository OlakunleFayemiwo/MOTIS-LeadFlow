const { clearSessionCookie } = require("./crmAuth");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json", Allow: "POST" },
      body: JSON.stringify({ message: "Method Not Allowed" }),
    };
  }

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Set-Cookie": clearSessionCookie(),
    },
    body: JSON.stringify({ success: true }),
  };
};
