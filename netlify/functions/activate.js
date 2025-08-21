import jwt from "jsonwebtoken";

// Memory store condiviso globale
if (!global.memoryStore) {
  global.memoryStore = new Map();
}

function getStore() {
  try {
    if (process.env.NETLIFY) {
      return require("@netlify/kv");
    }
  } catch (e) {
    console.warn("[DEBUG] KV non disponibile, uso memory store");
  }

  return {
    get: async (k) => {
      const value = global.memoryStore.get(k);
      console.log(`[DEBUG] Lettura chiave: ${k}`, value);
      return value;
    },
    set: async (k, v) => {
      console.log(`[DEBUG] Salvando chiave: ${k}`, v);
      global.memoryStore.set(k, v);
    },
  };
}

const kv = getStore();

const SECRET_KEY = process.env.SECRET_KEY || "supersecret";

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const authHeader = event.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Token required" }),
      };
    }

    let decoded;
    try {
      decoded = jwt.verify(token, SECRET_KEY);
      console.log("[DEBUG] Token decodificato:", decoded);
    } catch (e) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Token non valido" }),
      };
    }

    const { deviceId } = decoded;
    const deviceKey = `device:${deviceId}`;
    const deviceData = await kv.get(deviceKey);

    console.log(`[DEBUG] Device per attivazione: ${deviceKey}`, deviceData);

    if (!deviceData || deviceData.blocked) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: "Device bloccato" }),
      };
    }

    // Logica per attivare il dispositivo reale
    const { deviceId: requestedDevice } = JSON.parse(event.body || "{}");
    console.log(
      `[DEBUG] Attivo dispositivo ${requestedDevice} per deviceId ${deviceId}`
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        deviceId: deviceData.deviceId,
      }),
    };
  } catch (err) {
    console.error("[ERROR] activate:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
}
