exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  try {
    const { token } = event.queryStringParameters;
    const sessions = JSON.parse(process.env.SESSIONS || "{}");

    if (!token || !sessions[token]) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Token non valido" }),
      };
    }

    const session = sessions[token];
    const timeLeft = Math.max(
      0,
      60 - Math.floor((Date.now() - session.startTime) / 60000)
    );

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        clicks: session.clicks,
        startTime: session.startTime,
        timeLeft: timeLeft,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Errore durante il recupero dello stato" }),
    };
  }
};
