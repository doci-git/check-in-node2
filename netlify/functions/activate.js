const fetch = require("node-fetch");
const DEVICES = require("./devices");
const { BASE_URL_SET } = require("./config");
const { getSession, isExpired, useClick } = require("./sessionManager");

exports.handler = async (event) => {
  try {
    const { userId, deviceId } = JSON.parse(event.body);

    const session = getSession(userId);
    if (!session)
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Sessione non valida" }),
      };
    if (isExpired(session))
      return {
        statusCode: 403,
        body: JSON.stringify({ error: "Sessione scaduta" }),
      };

    const device = DEVICES.find((d) => d.id === deviceId);
    if (!device)
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Dispositivo non trovato" }),
      };

    if (session.clicks[device.storage_key] <= 0) {
      return {
        statusCode: 429,
        body: JSON.stringify({ error: "Nessun click rimanente" }),
      };
    }

    const clicksLeft = useClick(session, device.storage_key);

    const response = await fetch(BASE_URL_SET, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: device.id,
        auth_key: device.auth_key,
        channel: 0,
        on: true,
      }),
    });

    if (!response.ok) {
      session.clicks[device.storage_key]++; // rollback
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Errore attivazione dispositivo" }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Dispositivo attivato", clicksLeft }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
