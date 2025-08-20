// functions/state.js
const jwt = require("jsonwebtoken");

const SECRET_KEY = process.env.SECRET_KEY || "musart_secret_123";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

// helper per estrarre il token dal body o dall'header
function getTokenFromEvent(event) {
  const auth = event.headers?.authorization || event.headers?.Authorization;
  if (auth && auth.startsWith("Bearer ")) return auth.slice(7);
  try {
    const body = JSON.parse(event.body || "{}");
    if (body.token) return body.token;
  } catch (_) {}
  return null;
}

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
    const token = getTokenFromEvent(event);
    if (!token) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Token required" }),
      };
    }

    // verifica il JWT
    const decoded = jwt.verify(token, SECRET_KEY);

    // calcola tempo residuo
    const nowSec = Math.floor(Date.now() / 1000);
    const secondsLeft = Math.max(0, (decoded.exp || 0) - nowSec);
    const minutesLeft = Math.floor(secondsLeft / 60);
    const remSeconds = secondsLeft % 60;

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        valid: true,
        minutesLeft,
        secondsLeft: remSeconds,
        expiresAt: (decoded.exp || 0) * 1000,
      }),
    };
  } catch (error) {
    console.error("STATE function error:", error);

    // restituisce sempre JSON valido anche in caso di errore
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Internal server error",
        details: error.message,
      }),
    };
  }
};
