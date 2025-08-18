const crypto = require("crypto");

const CORRECT_CODE = process.env.ACCESS_CODE || "2245";
const TIME_LIMIT_MINUTES = 2;
const SECRET_KEY = process.env.SECRET_KEY || "musart_secret_123";

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: JSON.stringify({ message: "CORS preflight" }),
    };
  }

  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Method Not Allowed" }),
      };
    }

    const { code } = JSON.parse(event.body);

    if (!code) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Code is required" }),
      };
    }

    if (code !== CORRECT_CODE) {
      return {
        statusCode: 401,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          error: "Invalid code",
          message: "Incorrect access code",
        }),
      };
    }

    // Create session
    const startTime = Date.now();
    const expiresAt = startTime + TIME_LIMIT_MINUTES * 60 * 1000;
    const hash = crypto
      .createHmac("sha256", SECRET_KEY)
      .update(`${startTime}${CORRECT_CODE}`)
      .digest("hex");

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        success: true,
        message: "Access granted",
        session: {
          startTime,
          expiresAt,
          hash,
          timeLimit: TIME_LIMIT_MINUTES,
        },
      }),
    };
  } catch (error) {
    console.error("Error:", error);
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
