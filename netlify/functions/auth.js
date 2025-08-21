// functions/auth.js
const jwt = require("jsonwebtoken");

const CORRECT_CODE = process.env.CORRECT_CODE || "2245";
const SECRET_KEY = process.env.SECRET_KEY || "musart_secret_123";
const TIME_LIMIT_MINUTES = 20; // 2 ore

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { code } = JSON.parse(event.body || "{}");

    if (code !== CORRECT_CODE) {
      return {
        statusCode: 401,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Invalid code" }),
      };
    }

    // payload minimale: puoi aggiungere info come ruoli, device, ecc.
    const payload = { authorized: true };
    const token = jwt.sign(payload, SECRET_KEY, {
      expiresIn: `${TIME_LIMIT_MINUTES}m`,
      issuer: "netlify-fn/auth",
    });

    const decoded = jwt.decode(token);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        token,
        // info utili al client
        expiresAt: decoded.exp * 1000,
        issuedAt: decoded.iat * 1000,
        limitMinutes: TIME_LIMIT_MINUTES,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
