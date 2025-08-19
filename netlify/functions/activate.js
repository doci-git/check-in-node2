const fetch = require("node-fetch");

const DEVICES = [
  { id: "e4b063f0c38c", auth_key: process.env.DEVICE1_KEY },
  { id: "34945478d595", auth_key: process.env.DEVICE2_KEY },
];


const BASE_URL_SET =
  "https://shelly-73-eu.shelly.cloud/v2/devices/api/set/switch";

exports.handler = async (event) => {

    exports.handler = async (event) => {
      try {
        const body = JSON.parse(event.body || "{}");
        const device = DEVICES.find((d) => d.id === body.deviceId);

        if (!device)
          return {
            statusCode: 400,
            body: JSON.stringify({ error: "Device non trovato" }),
          };
        if (!device.auth_key)
          return {
            statusCode: 500,
            body: JSON.stringify({ error: "API key mancante" }),
          };

        console.log("[DEBUG] Chiamo API con auth_key:", device.auth_key);

        const res = await fetch(
          `https://api.tuadevice.com/device/${device.id}/activate`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${device.auth_key}` },
          }
        );

        console.log("[DEBUG] response status:", res.status);

        const data = await res.json().catch((e) => {
          console.error("JSON fail:", e);
          return null;
        });
        console.log("[DEBUG] response body:", data);

        if (!data)
          return {
            statusCode: 500,
            body: JSON.stringify({ error: "JSON parse fallito" }),
          };

        return { statusCode: 200, body: JSON.stringify(data) };
      } catch (err) {
        console.error("[DEBUG] Errore activate:", err);
        return {
          statusCode: 500,
          body: JSON.stringify({
            error: "Errore server",
            details: err.message,
          }),
        };
      }
    };

    // exports.handler = async (event) => {
    //   try {
    //     const body = JSON.parse(event.body || "{}");
    //     console.log("[DEBUG] body:", body);

    //     const device = DEVICES.find((d) => d.id === body.deviceId);
    //     console.log("[DEBUG] device trovato:", device);

    //     if (!device) {
    //       return {
    //         statusCode: 400,
    //         body: JSON.stringify({ error: "Device non trovato" }),
    //       };
    //     }

    //     if (!device.auth_key) {
    //       console.error("[DEBUG] Manca API key per", device.id);
    //       return {
    //         statusCode: 500,
    //         body: JSON.stringify({ error: "API key mancante" }),
    //       };
    //     }

    //     ... qui prosegue fetch reale
    //   } catch (err) {
    //     console.error("[DEBUG] Errore activate:", err);
    //     return {
    //       statusCode: 500,
    //       body: JSON.stringify({
    //         error: "Errore server",
    //         details: err.message,
    //       }),
    //     };
    //   }
    // };

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
