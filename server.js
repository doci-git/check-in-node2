require("dotenv").config();
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const fetch = require("node-fetch");

const app = express();

// Configurazione
const CONFIG = {
  PORT: process.env.PORT || 3000,
  SECRET_KEY: process.env.SECRET_KEY || "default-secret-key",
  SHELLY_CLOUD_URL:
    process.env.SHELLY_CLOUD_URL || "https://shelly-XX.cloud/api/v2",
  DEVICES: [
    {
      id: process.env.MAIN_DOOR_ID || "e4b063f0c38c",
      auth_key:
        process.env.MAIN_DOOR_AUTH_KEY ||
        "MWI2MDc4dWlk4908A71DA809FCEC05C5D1F360943FBFC6A7934EC0FD9E3CFEAF03F8F5A6A4A0C60665B97A1AA2E2",
      name: "MainDoor",
      relay: 0,
      localIP: process.env.MAIN_DOOR_IP || "192.168.1.100",
    },
    {
      id: process.env.APT_DOOR_ID || "34945478d595",
      auth_key:
        process.env.APT_DOOR_AUTH_KEY ||
        "MWI2MDc4dWlk4908A71DA809FCEC05C5D1F360943FBFC6A7934EC0FD9E3CFEAF03F8F5A6A4A0C60665B97A1AA2E2",
      name: "AptDoor",
      relay: 0,
      localIP: process.env.APT_DOOR_IP || "192.168.1.101",
    },
  ],
  MAX_CLICKS: 3,
  TIME_LIMIT_MINUTES: 60,
  CORRECT_CODE: process.env.ACCESS_CODE || "2245",
};

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST"],
  })
);
app.use(express.static("public"));

// Storage sessioni
const sessions = new Map();

// Helper functions
function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

async function activateShellyDevice(deviceConfig) {
  try {
    // Try Shelly Cloud first
    const cloudResponse = await fetch(
      `${CONFIG.SHELLY_CLOUD_URL}/device/relay/control`,
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
          timer: 5,
        }),
        timeout: 5000,
      }
    );

    if (cloudResponse.ok) {
      return { success: true, data: await cloudResponse.json() };
    }

    // Fallback to local IP if available
    if (deviceConfig.localIP) {
      const localResponse = await fetch(
        `http://${deviceConfig.localIP}/relay/${deviceConfig.relay}?turn=on`,
        {
          method: "GET",
          timeout: 3000,
        }
      );

      if (localResponse.ok) {
        return { success: true, data: await localResponse.json() };
      }
    }

    throw new Error(`Shelly API error: ${cloudResponse.statusText}`);
  } catch (error) {
    console.error(`Shelly activation error for ${deviceConfig.name}:`, error);
    return {
      success: false,
      error: error.message,
      device: deviceConfig,
    };
  }
}

// API Routes
app.post("/api/login", (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: "Codice mancante" });
    }

    if (code !== CONFIG.CORRECT_CODE) {
      return res.status(401).json({ error: "Codice errato" });
    }

    const token = generateToken();
    sessions.set(token, {
      startTime: Date.now(),
      clicks: {
        MainDoor: CONFIG.MAX_CLICKS,
        AptDoor: CONFIG.MAX_CLICKS,
      },
    });

    res.json({
      token,
      timeLimit: CONFIG.TIME_LIMIT_MINUTES,
      message: "Autenticazione riuscita",
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Errore durante l'autenticazione" });
  }
});

app.get("/api/status", (req, res) => {
  try {
    const token = req.query.token;
    if (!token || !sessions.has(token)) {
      return res.status(401).json({ error: "Token non valido" });
    }

    const session = sessions.get(token);
    const timeLeft = Math.max(
      0,
      CONFIG.TIME_LIMIT_MINUTES -
        Math.floor((Date.now() - session.startTime) / 60000)
    );

    res.json({
      clicks: session.clicks,
      startTime: session.startTime,
      timeLeft: timeLeft,
    });
  } catch (error) {
    console.error("Status error:", error);
    res.status(500).json({ error: "Errore durante il recupero dello stato" });
  }
});

app.post("/api/activate", async (req, res) => {
  try {
    const { device, token } = req.body;

    if (!token || !sessions.has(token)) {
      return res.status(401).json({ error: "Token non valido" });
    }

    const session = sessions.get(token);

    if (!device || !session.clicks[device]) {
      return res.status(400).json({
        error: "Dispositivo non valido",
        validDevices: Object.keys(session.clicks),
      });
    }

    if (session.clicks[device] <= 0) {
      return res.status(400).json({
        error: "Nessun click rimasto",
        clicksLeft: session.clicks,
      });
    }

    const deviceConfig = CONFIG.DEVICES.find((d) => d.name === device);
    if (!deviceConfig) {
      return res.status(400).json({
        error: "Configurazione dispositivo non trovata",
        availableDevices: CONFIG.DEVICES.map((d) => d.name),
      });
    }

    const activationResult = await activateShellyDevice(deviceConfig);

    if (!activationResult.success) {
      return res.status(502).json({
        error: "Errore durante l'attivazione del dispositivo",
        details: activationResult.error,
      });
    }

    session.clicks[device]--;

    res.json({
      success: true,
      message: `${device} attivato correttamente`,
      clicksLeft: session.clicks,
      shellyResponse: activationResult.data,
    });
  } catch (error) {
    console.error("Activation error:", error);
    res.status(500).json({
      error: "Errore interno del server",
      details: error.message,
    });
  }
});

// Debug endpoint
app.get("/api/debug", (req, res) => {
  res.json({
    status: "OK",
    sessions: Array.from(sessions.keys()).length,
    devices: CONFIG.DEVICES.map((d) => ({ name: d.name, id: d.id })),
    config: {
      maxClicks: CONFIG.MAX_CLICKS,
      timeLimit: CONFIG.TIME_LIMIT_MINUTES,
    },
  });
});

// Start server
app.listen(CONFIG.PORT, () => {
  console.log(`Server avviato su http://localhost:${CONFIG.PORT}`);
  console.log(
    `Dispositivi configurati: ${CONFIG.DEVICES.map((d) => d.name).join(", ")}`
  );
});
