const crypto = require("crypto");

// Configurazione
const TIME_LIMIT_MINUTES = 2;
const SECRET_KEY = process.env.SECRET_KEY || "musart_secret_123";
const CORRECT_CODE = process.env.ACCESS_CODE || "2245";

exports.handler = async (event) => {
  // Gestione CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: JSON.stringify({ message: "CORS preflight" }),
    };
  }

  try {
    // Endpoint di health check
    if (event.httpMethod === "GET") {
      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          status: "OK",
          service: "MusArt Door Control",
          version: "1.0",
        }),
      };
    }

    // Verifica sessione
    const { startTime, hash } = JSON.parse(event.body);

    if (!startTime || !hash) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Missing session data" }),
      };
    }

    // Verifica hash sessione
    const expectedHash = crypto
      .createHmac("sha256", SECRET_KEY)
      .update(`${startTime}${CORRECT_CODE}`)
      .digest("hex");

    if (hash !== expectedHash) {
      return {
        statusCode: 401,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          error: "Invalid session",
          expired: true,
          reason: "Invalid session token",
        }),
      };
    }

    // Calcola tempo rimanente
    const now = Date.now();
    const expiresAt = startTime + TIME_LIMIT_MINUTES * 60 * 1000;
    const timeLeft = expiresAt - now;

    if (timeLeft <= 0) {
      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          expired: true,
          reason: "Session expired!",
        }),
      };
    }

    const minutesLeft = Math.floor(timeLeft / (60 * 1000));
    const secondsLeft = Math.floor((timeLeft % (60 * 1000)) / 1000);

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        expired: false,
        minutesLeft,
        secondsLeft,
        timeLeft,
        message: "Session active",
      }),
    };
  } catch (error) {
    console.error("Status error:", error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        error: error.message,
        message: "Internal server error",
      }),
    };
  }
};
