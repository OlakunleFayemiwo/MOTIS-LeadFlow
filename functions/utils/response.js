function getPublicCorsHeaders(allowedMethods = "POST, OPTIONS") {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": allowedMethods,
    "Content-Type": "application/json",
  };
}

function getCrmHeaders(event, allowedMethods = "GET, POST, OPTIONS") {
  const rawOrigin = event?.headers?.origin || event?.headers?.Origin;
  const requestOrigin = rawOrigin ? rawOrigin.replace(/\/$/, "") : null;
  const rawSiteUrl = process.env.URL || process.env.SITE_URL;
  const configuredSiteUrl = rawSiteUrl ? rawSiteUrl.replace(/\/$/, "") : null;

  let allowOrigin = null;
  if (configuredSiteUrl) {
    if (requestOrigin) {
      if (requestOrigin === configuredSiteUrl) {
        allowOrigin = requestOrigin;
      }
    } else {
      allowOrigin = configuredSiteUrl;
    }
  }

  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": allowedMethods,
  };

  if (allowOrigin) {
    headers["Access-Control-Allow-Origin"] = allowOrigin;
    headers["Vary"] = "Origin";
  }

  return headers;
}

function buildJsonResponse(statusCode, data, headers = {}) {
  return {
    statusCode,
    headers,
    body: JSON.stringify(data),
  };
}

module.exports = {
  buildJsonResponse,
  getCrmHeaders,
  getPublicCorsHeaders,
};
