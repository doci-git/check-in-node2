const crypto = require("crypto");

const SECRET_KEY = process.env.SECRET_KEY || "musart_secret_123";
const TIME_LIMIT_MINUTES = 120; // 2 ore

exports.handler = async (event) => {
  // Handle CORS
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { startTime, hash, persistentToken } = JSON.parse(event.body || "{}");

    if (!startTime || !hash) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ error: "Missing data" }),
      };
    }

    // Verifica l'hash normale
    const calcHash = crypto
      .createHash("sha256")
      .update(startTime + SECRET_KEY)
      .digest("hex");

    // Verifica il token persistente (se fornito)
    const calcPersistentToken = crypto
      .createHash("sha256")
      .update(startTime + SECRET_KEY + "persistent")
      .digest("hex");

    if (
      calcHash !== hash &&
      (!persistentToken || calcPersistentToken !== persistentToken)
    ) {
      return {
        statusCode: 403,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ error: "Security violation" }),
      };
    }

    const now = Date.now();
    const minutesPassed = (now - parseInt(startTime, 10)) / (1000 * 60);

    if (minutesPassed >= TIME_LIMIT_MINUTES) {
      return {
        statusCode: 403,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ error: "Session expired" }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        minutesLeft: Math.max(
          0,
          TIME_LIMIT_MINUTES - Math.floor(minutesPassed)
        ),
        secondsLeft: Math.max(0, 60 - Math.floor((minutesPassed % 1) * 60)),
        // Restituisci anche il token persistente per il refresh
        persistentToken: calcPersistentToken,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
