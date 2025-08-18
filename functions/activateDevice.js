const fetch = require("node-fetch");

// Configurazione dispositivi
const DEVICES = [
  {
    id: "e4b063f0c38c",
    auth_key:
      process.env.SHELLY_AUTH_KEY ||
      "MWI2MDc4dWlk4908A71DA809FCEC05C5D1F360943FBFC6A7934EC0FD9E3CFEAF03F8F5A6A4A0C60665B97A1AA2E2",
    storage_key: "clicks_MainDoor",
    button_id: "MainDoor",
  },
  {
    id: "34945478d595",
    auth_key:
      process.env.SHELLY_AUTH_KEY ||
      "MWI2MDc4dWlk4908A71DA809FCEC05C5D1F360943FBFC6A7934EC0FD9E3CFEAF03F8F5A6A4A0C60665B97A1AA2E2",
    storage_key: "clicks_AptDoor",
    button_id: "AptDoor",
  },
];

const BASE_URL_SET =
  "https://shelly-73-eu.shelly.cloud/v2/devices/api/set/switch";
const MAX_CLICKS = 3;

// Stato in memoria (per produzione usare database)
let clicksMemory = {
  clicks_MainDoor: MAX_CLICKS,
  clicks_AptDoor: MAX_CLICKS,
};

// Handler principale
exports.handler = async (event) => {
  // Gestione CORS preflight
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
    // Verifica metodo HTTP
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Method Not Allowed" }),
      };
    }

    const { deviceId, sessionHash } = JSON.parse(event.body);

    // Verifica sessione
    if (!sessionHash) {
      return {
        statusCode: 401,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Unauthorized - No session" }),
      };
    }

    const device = DEVICES.find((d) => d.id === deviceId);
    if (!device) {
      return {
        statusCode: 404,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Device not found" }),
      };
    }

    // Verifica click disponibili
    if (clicksMemory[device.storage_key] <= 0) {
      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          success: false,
          clicksLeft: 0,
          message: "No clicks remaining",
        }),
      };
    }

    // Decrementa click e attiva dispositivo
    clicksMemory[device.storage_key]--;

    const response = await fetch(BASE_URL_SET, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: device.id,
        auth_key: device.auth_key,
        channel: 0,
        on: true,
        turn: "on",
      }),
    });

    if (!response.ok) {
      // Rollback in caso di errore
      clicksMemory[device.storage_key]++;
      throw new Error("Shelly API request failed");
    }

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        success: true,
        clicksLeft: clicksMemory[device.storage_key],
        message: "Device activated successfully",
      }),
    };
  } catch (err) {
    console.error("Activation error:", err);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        error: err.message,
        message: "Device activation failed",
      }),
    };
  }
};
