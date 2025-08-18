const crypto = require("crypto");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" }),
      headers: { "Content-Type": "application/json" },
    };
  }

  try {
    const { code } = JSON.parse(event.body);
    const correctCode = process.env.ACCESS_CODE || "2245";

    if (!code) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Codice mancante" }),
      };
    }

    if (code !== correctCode) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Codice errato" }),
      };
    }

    const token = crypto.randomBytes(32).toString("hex");
    const sessions = JSON.parse(process.env.SESSIONS || "{}");

    sessions[token] = {
      startTime: Date.now(),
      clicks: {
        MainDoor: 3,
        AptDoor: 3,
      },
    };

    process.env.SESSIONS = JSON.stringify(sessions);

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token,
        timeLimit: 60,
        message: "Autenticazione riuscita",
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Errore durante l'autenticazione" }),
    };
  }
};
