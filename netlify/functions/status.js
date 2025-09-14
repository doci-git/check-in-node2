const { getSession, isExpired } = require("./sessionManager");

exports.handler = async (event) => {
  try {
    const userId = event.path.split("/").pop();
    const session = getSession(userId);
    if (!session) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Sessione non trovata" }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        clicks: session.clicks,
        expired: isExpired(session),
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
