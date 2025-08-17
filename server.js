const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const fetch = require("node-fetch");

const app = express();

// Configurazione Shelly Cloud
const SHELLY_CONFIG = {
  CLOUD_URL: "https://shelly-73-eu.shelly.cloud",
  DEVICES: {
    MAIN_DOOR: {
      id: "e4b063f0c38c",
      auth_key:
        "MWI2MDc4dWlk4908A71DA809FCEC05C5D1F360943FBFC6A7934EC0FD9E3CFEAF03F8F5A6A4A0C60665B97A1AA2E2",
      name: "MainDoor",
      relay: 0,
    },
    APT_DOOR: {
      id: "34945478d595",
      auth_key:
        "MWI2MDc4dWlk4908A71DA809FCEC05C5D1F360943FBFC6A7934EC0FD9E3CFEAF03F8F5A6A4A0C60665B97A1AA2E2",
      name: "AptDoor",
      relay: 0,
    },
  },
};

// Configurazione applicazione
const APP_CONFIG = {
  MAX_CLICKS: 3,
  CORRECT_CODE: "2245",
  TIME_LIMIT_MINUTES: 2,
  PORT: process.env.PORT || 3000,
};

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  })
);
app.use(express.static("public"));

// Storage sessioni
const sessions = new Map();

// Genera token sicuro
function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

// Attiva dispositivo Shelly
async function activateShellyDevice(deviceConfig) {
  try {
    const response = await fetch(
      `${SHELLY_CONFIG.CLOUD_URL}/device/relay/control`,
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
    return {
      success: response.ok,
      data: data,
    };
  } catch (error) {
    console.error("Shelly activation error:", error);
    return { success: false, error: error.message };
  }
}

// Endpoint: Login
app.post("/api/login", (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: "Codice mancante" });
    }

    if (code !== APP_CONFIG.CORRECT_CODE) {
      return res.status(401).json({ error: "Codice errato" });
    }

    const token = generateToken();
    sessions.set(token, {
      startTime: Date.now(),
      clicks: {
        MainDoor: APP_CONFIG.MAX_CLICKS,
        AptDoor: APP_CONFIG.MAX_CLICKS,
      },
    });

    res.json({
      token,
      timeLimit: APP_CONFIG.TIME_LIMIT_MINUTES,
      message: "Autenticazione riuscita",
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Errore durante l'autenticazione" });
  }
});

// Endpoint: Stato
app.get("/api/status", (req, res) => {
  try {
    const token = req.query.token;
    if (!token || !sessions.has(token)) {
      return res.status(401).json({ error: "Token non valido" });
    }

    const session = sessions.get(token);
    const timeLeft = Math.max(
      0,
      APP_CONFIG.TIME_LIMIT_MINUTES -
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

// Endpoint: Attivazione dispositivo
app.post("/api/activate", async (req, res) => {
  try {
    const { device, token } = req.body;

    // Verifica token
    if (!token || !sessions.has(token)) {
      return res.status(401).json({ error: "Token non valido" });
    }

    const session = sessions.get(token);

    // Verifica dispositivo
    if (!device || !session.clicks[device]) {
      return res.status(400).json({ error: "Dispositivo non valido" });
    }

    if (session.clicks[device] <= 0) {
      return res.status(400).json({ error: "Nessun click rimasto" });
    }

    // Trova configurazione dispositivo
    const deviceConfig = Object.values(SHELLY_CONFIG.DEVICES).find(
      (d) => d.name === device
    );
    if (!deviceConfig) {
      return res
        .status(400)
        .json({ error: "Configurazione dispositivo non trovata" });
    }

    // Attiva dispositivo Shelly
    const activationResult = await activateShellyDevice(deviceConfig);
    if (!activationResult.success) {
      return res.status(500).json({
        error: "Errore durante l'attivazione del dispositivo",
        details: activationResult.error,
      });
    }

    // Aggiorna sessioni
    session.clicks[device]--;

    res.json({
      message: `Dispositivo ${device} attivato con successo`,
      clicksLeft: session.clicks[device],
      deviceStatus: activationResult.data,
    });
  } catch (error) {
    console.error("Activation error:", error);
    res.status(500).json({ error: "Errore durante l'attivazione" });
  }
});

// Avvio server
app.listen(APP_CONFIG.PORT, () => {
  console.log(`Server avviato su http://localhost:${APP_CONFIG.PORT}`);
});
