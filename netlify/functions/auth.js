const crypto = require("crypto");

const CORRECT_CODE = process.env.CORRECT_CODE || "2245";
const SECRET_KEY = process.env.SECRET_KEY || "musart_secret_123";
const TIME_LIMIT_MINUTES = 120; // 2 ore invece di 2 minuti

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
    const { code } = JSON.parse(event.body || "{}");

    if (code !== CORRECT_CODE) {
      return {
        statusCode: 401,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ error: "Invalid code" }),
      };
    }

    const startTime = Date.now();
    const hash = crypto
      .createHash("sha256")
      .update(startTime + SECRET_KEY)
      .digest("hex");

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startTime,
        hash,
        limit: TIME_LIMIT_MINUTES,
        // Aggiungi un token persistente
        persistentToken: crypto
          .createHash("sha256")
          .update(startTime + SECRET_KEY + "persistent")
          .digest("hex"),
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
