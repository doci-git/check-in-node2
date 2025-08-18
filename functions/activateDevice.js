const fetch = require("node-fetch");

const DEVICES = [
  {
    id: "e4b063f0c38c",
    auth_key:
      "MWI2MDc4dWlk4908A71DA809FCEC05C5D1F360943FBFC6A7934EC0FD9E3CFEAF03F8F5A6A4A0C60665B97A1AA2E2",
    storage_key: "clicks_MainDoor",
    button_id: "MainDoor",
  },
  {
    id: "34945478d595",
    auth_key:
      "MWI2MDc4dWlk4908A71DA809FCEC05C5D1F360943FBFC6A7934EC0FD9E3CFEAF03F8F5A6A4A0C60665B97A1AA2E2",
    storage_key: "clicks_AptDoor",
    button_id: "AptDoor",
  },
];

const BASE_URL_SET =
  "https://shelly-73-eu.shelly.cloud/v2/devices/api/set/switch";
const MAX_CLICKS = 3;

// In memoria (per semplicità: se vuoi persistente -> DB esterno)
let clicksMemory = {
  clicks_MainDoor: MAX_CLICKS,
  clicks_AptDoor: MAX_CLICKS,
};

exports.handler = async (event) => {
  try {
    const { deviceId } = JSON.parse(event.body);
    const device = DEVICES.find((d) => d.id === deviceId);

    if (!device) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Device not found" }),
      };
    }

    if (clicksMemory[device.storage_key] <= 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: false, clicksLeft: 0 }),
      };
    }

    // decrementa i click
    clicksMemory[device.storage_key]--;

    // chiama Shelly API
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
      clicksMemory[device.storage_key]++; // rollback click
      throw new Error("Shelly API failed");
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        clicksLeft: clicksMemory[device.storage_key],
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
