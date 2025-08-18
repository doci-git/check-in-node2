const fetch = require("node-fetch");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  try {
    const { device, token } = JSON.parse(event.body);
    const sessions = JSON.parse(process.env.SESSIONS || "{}");

    if (!token || !sessions[token]) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Token non valido" }),
      };
    }

    const session = sessions[token];

    if (!device || !session.clicks[device]) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Dispositivo non valido" }),
      };
    }

    if (session.clicks[device] <= 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Nessun click rimasto" }),
      };
    }

    // Configurazione dispositivi Shelly
    const devices = {
      MainDoor: {
        id: process.env.SHELLY_MAIN_DOOR_ID || "e4b063f0c38c",
        auth_key: process.env.SHELLY_MAIN_DOOR_KEY,
        relay: 0,
      },
      AptDoor: {
        id: process.env.SHELLY_APT_DOOR_ID || "34945478d595",
        auth_key: process.env.SHELLY_APT_DOOR_KEY,
        relay: 0,
      },
    };

    const deviceConfig = devices[device];
    if (!deviceConfig) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Configurazione dispositivo non trovata",
        }),
      };
    }

    // Attivazione dispositivo Shelly
    const response = await fetch(
      `https://shelly-73-eu.shelly.cloud/device/relay/control`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${deviceConfig.auth_key}`,
        },
        body: JSON.stringify({
          id: deviceConfig.id,
          channel: deviceConfig.relay,
          turn: "on",
          timer: 5.0,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Errore durante l'attivazione del dispositivo",
          details: data,
        }),
      };
    }

    // Aggiorna sessioni
    session.clicks[device]--;
    sessions[token] = session;
    process.env.SESSIONS = JSON.stringify(sessions);

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `Dispositivo ${device} attivato con successo`,
        clicksLeft: session.clicks[device],
        deviceStatus: data,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Errore durante l'attivazione" }),
    };
  }
};
