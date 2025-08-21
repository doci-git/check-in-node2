// Configurazione dispositivi Shelly (stessa di activate.js)
const SHELLY_DEVICES = {
  e4b063f0c38c: {
    name: "Main Door",
    ip: process.env.SHELLY_MAIN_DOOR_IP || "192.168.1.100",
    username: process.env.SHELLY_USERNAME || "admin",
    password: process.env.SHELLY_PASSWORD || "password",
  },
  "34945478d595": {
    name: "Apartment Door",
    ip: process.env.SHELLY_APT_DOOR_IP || "192.168.1.101",
    username: process.env.SHELLY_USERNAME || "admin",
    password: process.env.SHELLY_PASSWORD || "password",
  },
};

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { deviceId } = JSON.parse(event.body || "{}");

    if (!deviceId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "deviceId required" }),
      };
    }

    const deviceConfig = SHELLY_DEVICES[deviceId];
    if (!deviceConfig) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: "Device not configured",
          availableDevices: Object.keys(SHELLY_DEVICES),
        }),
      };
    }

    const { ip, username, password } = deviceConfig;

    console.log(`[DEBUG] Test connessione Shelly ${deviceId} (${ip})`);

    // Prova un ping semplice allo status
    const pingUrl = `http://${ip}/rpc/Switch.GetStatus?id=0`;
    const auth = Buffer.from(`${username}:${password}`).toString("base64");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(pingUrl, {
        method: "GET",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        return {
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            reachable: true,
            device: deviceId,
            ip: ip,
            response: data,
          }),
        };
      } else {
        return {
          statusCode: 200,
          body: JSON.stringify({
            success: false,
            reachable: false,
            device: deviceId,
            ip: ip,
            status: response.status,
            statusText: response.statusText,
          }),
        };
      }
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === "AbortError") {
        return {
          statusCode: 200,
          body: JSON.stringify({
            success: false,
            reachable: false,
            device: deviceId,
            ip: ip,
            error: "Timeout: dispositivo non raggiungibile dopo 5 secondi",
          }),
        };
      }

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: false,
          reachable: false,
          device: deviceId,
          ip: ip,
          error: error.message,
        }),
      };
    }
  } catch (error) {
    console.error("[ERROR] test-shelly:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Internal server error",
        details: error.message,
      }),
    };
  }
}
