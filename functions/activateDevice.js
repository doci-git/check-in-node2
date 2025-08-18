const fetch = require("node-fetch");

const DEVICES = [
  {
    id: "e4b063f0c38c",
    auth_key: process.env.SHELLY_AUTH_KEY,
    storage_key: "clicks_MainDoor",
    button_id: "MainDoor",
  },
  {
    id: "34945478d595",
    auth_key: process.env.SHELLY_AUTH_KEY,
    storage_key: "clicks_AptDoor",
    button_id: "AptDoor",
  },
];

const MAX_CLICKS = 3;
let clicksMemory = {
  clicks_MainDoor: MAX_CLICKS,
  clicks_AptDoor: MAX_CLICKS,
};

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
      body: JSON.stringify({ message: "CORS preflight" }),
    };
  }

  try {
    // Verify request
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Method Not Allowed" }),
      };
    }

    // Verify authorization
    const authHeader = event.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return {
        statusCode: 401,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Missing authorization header" }),
      };
    }

    // Parse body
    let body;
    try {
      body = JSON.parse(event.body);
    } catch (e) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Invalid JSON body" }),
      };
    }

    const { deviceId, sessionHash } = body;
    const token = authHeader.split(" ")[1];

    // Verify session
    if (token !== sessionHash) {
      return {
        statusCode: 401,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Invalid session token" }),
      };
    }

    // Find device
    const device = DEVICES.find((d) => d.id === deviceId);
    if (!device) {
      return {
        statusCode: 404,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Device not found" }),
      };
    }

    // Check clicks
    if (clicksMemory[device.storage_key] <= 0) {
      return {
        statusCode: 403,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          error: "No clicks remaining",
          clicksLeft: 0,
        }),
      };
    }

    // Call Shelly API
    const shellyResponse = await fetch(
      "https://shelly-73-eu.shelly.cloud/v2/devices/api/set/switch",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: device.id,
          auth_key: device.auth_key,
          channel: 0,
          on: true,
          turn: "on",
        }),
        timeout: 10000,
      }
    );

    if (!shellyResponse.ok) {
      throw new Error(`Shelly API error: ${shellyResponse.status}`);
    }

    // Update clicks
    clicksMemory[device.storage_key]--;

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        success: true,
        clicksLeft: clicksMemory[device.storage_key],
        message: "Device activated",
      }),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        error: error.message,
        message: "Activation failed",
      }),
    };
  }
};
