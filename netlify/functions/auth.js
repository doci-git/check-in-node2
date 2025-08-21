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
    get: async (k) => global.memoryStore.get(k),
    set: async (k, v) => {
      console.log(`[DEBUG] Salvando chiave: ${k}`, v);
      global.memoryStore.set(k, v);
    },
  };
}

const kv = getStore();

const SECRET_KEY = process.env.SECRET_KEY || "musart_secret_123";
const CORRECT_CODE = process.env.CORRECT_CODE || "2245";
const TIME_LIMIT_MINUTES = 22;

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { code, deviceId } = JSON.parse(event.body || "{}");
    if (!code || !deviceId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Code and deviceId required" }),
      };
    }

    console.log(
      `[DEBUG] Auth richiesta per device: ${deviceId}, codice: ${code}`
    );

    if (code !== CORRECT_CODE) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Codice errato" }),
      };
    }

    // Controlla se il device è già bloccato
    const deviceKey = `device:${deviceId}`;
    const existing = await kv.get(deviceKey);
    console.log(`[DEBUG] Device esistente per ${deviceKey}:`, existing);

    if (existing && existing.blocked) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: "Device bloccato definitivamente" }),
      };
    }

    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + TIME_LIMIT_MINUTES * 60;

    const token = jwt.sign({ deviceId }, SECRET_KEY, {
      expiresIn: TIME_LIMIT_MINUTES * 60,
    });

    // Salva nel KV/memory
    const deviceData = { expiresAt, blocked: false, deviceId };
    await kv.set(deviceKey, deviceData);
    console.log(`[DEBUG] Device salvato: ${deviceKey}`, deviceData);

    return {
      statusCode: 200,
      body: JSON.stringify({
        token,
        expiresAt: expiresAt * 1000,
        deviceId,
      }),
    };
  } catch (err) {
    console.error("[ERROR] auth:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
}
