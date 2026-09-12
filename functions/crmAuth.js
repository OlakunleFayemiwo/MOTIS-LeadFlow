const crypto = require("crypto");

const SESSION_COOKIE_NAME = "motis_crm_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

function getCookieValue(cookieHeader, name) {
  if (!cookieHeader) return null;

  const prefix = `${name}=`;
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
}

function sign(value, secret) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left || "");
  const rightBuffer = Buffer.from(right || "");

  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function createSessionCookie() {
  const secret = process.env.CRM_SESSION_SECRET;
  if (!secret) throw new Error("CRM_SESSION_SECRET is not configured");

  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({ iat: now, exp: now + SESSION_MAX_AGE_SECONDS }),
  ).toString("base64url");
  const token = `v1.${payload}.${sign(`v1.${payload}`, secret)}`;

  return `${SESSION_COOKIE_NAME}=${token}; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
}

function clearSessionCookie() {
  return `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

function verifySession(event) {
  const secret = process.env.CRM_SESSION_SECRET;
  const token = getCookieValue(event.headers?.cookie, SESSION_COOKIE_NAME);

  if (!token) return { authenticated: false, reason: "missing" };
  if (!secret) return { authenticated: false, reason: "invalid" };

  const [version, encodedPayload, signature] = token.split(".");
  if (!version || !encodedPayload || !signature || version !== "v1") {
    return { authenticated: false, reason: "invalid" };
  }

  if (!safeEqual(signature, sign(`${version}.${encodedPayload}`, secret))) {
    return { authenticated: false, reason: "invalid" };
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    );
    if (!Number.isInteger(payload.exp) || payload.exp <= Date.now() / 1000) {
      return { authenticated: false, reason: "invalid" };
    }
  } catch {
    return { authenticated: false, reason: "invalid" };
  }

  return { authenticated: true };
}

function verifyAdminPassword(password) {
  const configuredPassword = process.env.CRM_ADMIN_PASSWORD;
  return Boolean(configuredPassword) && safeEqual(password, configuredPassword);
}

function isLoginConfigured() {
  return Boolean(process.env.CRM_ADMIN_PASSWORD && process.env.CRM_SESSION_SECRET);
}

function authErrorResponse(headers, reason) {
  return {
    statusCode: 401,
    headers,
    body: JSON.stringify({
      message:
        reason === "missing"
          ? "Authentication is required."
          : "Authentication is invalid or has expired.",
    }),
  };
}

module.exports = {
  authErrorResponse,
  clearSessionCookie,
  createSessionCookie,
  isLoginConfigured,
  verifyAdminPassword,
  verifySession,
};
