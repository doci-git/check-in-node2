const fetch = require("node-fetch");

const DEVICES = [
  { id: "e4b063f0c38c", auth_key: process.env.DEVICE1_KEY },
  { id: "34945478d595", auth_key: process.env.DEVICE2_KEY },
];


const BASE_URL_SET =
  "https://shelly-73-eu.shelly.cloud/v2/devices/api/set/switch";

exports.handler = async (event) => {
  const { deviceId } = JSON.parse(event.body || "{}");

  const device = DEVICES.find((d) => d.id === deviceId);
  if (!device) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: "Device not found" }),
    };
  }

  try {
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

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Device error", data }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, data }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Connection failed" }),
    };
  }
};
