const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const fetch = require("node-fetch");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");

const app = express();

// Configurazione Shelly Cloud
const SHELLY_CONFIG = {
  CLOUD_URL: "https://shelly-73-eu.shelly.cloud",
  DEVICES: {
    MAIN_DOOR: {
      id: "e4b063f0c38c",
      auth_key:
        process.env.SHELLY_MAIN_DOOR_KEY ||
        "MWI2MDc4dWlk4908A71DA809FCEC05C5D1F360943FBFC6A7934EC0FD9E3CFEAF03F8F5A6A4A0C60665B97A1AA2E2",
      name: "MainDoor",
      relay: 0,
    },
    APT_DOOR: {
      id: "34945478d595",
      auth_key:
        process.env.SHELLY_APT_DOOR_KEY ||
        "MWI2MDc4dWlk4908A71DA809FCEC05C5D1F360943FBFC6A7934EC0FD9E3CFEAF03F8F5A6A4A0C60665B97A1AA2E2",
      name: "AptDoor",
      relay: 0,
    },
  },
};

// Configurazione applicazione
const APP_CONFIG = {
  MAX_CLICKS: 3,
  CORRECT_CODE: process.env.ACCESS_CODE || "2245",
  TIME_LIMIT_MINUTES: 60,
  PORT: process.env.PORT || 3000,
};

// Middleware
app.use(helmet());
app.use(compression());
app.use(express.json());
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://musart-check-in.netlify.app",
      "https://test2check-in.netlify.app/",
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.static("public"));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Troppe richieste da questo IP, riprova più tardi",
});
app.use(limiter);

// Storage sessioni
const sessions = new Map();

// Genera token sicuro
function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

// [Resto del codice server.js rimane identico alla versione ottimizzata...]

// Attiva dispositivo Shelly con timeout
async function activateShellyDevice(deviceConfig) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

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
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);
    const data = await response.json();
    return {
      success: response.ok,
      data: data,
    };
  } catch (error) {
    clearTimeout(timeout);
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

    if (!token || !sessions.has(token)) {
      return res.status(401).json({ error: "Token non valido" });
    }

    const session = sessions.get(token);

    if (!device || !session.clicks[device]) {
      return res.status(400).json({ error: "Dispositivo non valido" });
    }

    if (session.clicks[device] <= 0) {
      return res.status(400).json({ error: "Nessun click rimasto" });
    }

    const deviceConfig = Object.values(SHELLY_CONFIG.DEVICES).find(
      (d) => d.name === device
    );
    if (!deviceConfig) {
      return res
        .status(400)
        .json({ error: "Configurazione dispositivo non trovata" });
    }

    const activationResult = await activateShellyDevice(deviceConfig);
    if (!activationResult.success) {
      return res.status(500).json({
        error: "Errore durante l'attivazione del dispositivo",
        details: activationResult.error,
      });
    }

    session.clicks[device]--;
    sessions.set(token, session);

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

// Pulizia sessioni scadute
function cleanExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    const elapsed = (now - session.startTime) / 60000;
    if (elapsed > APP_CONFIG.TIME_LIMIT_MINUTES) {
      sessions.delete(token);
    }
  }
}

setInterval(cleanExpiredSessions, 60000);

// Avvio server
app.listen(APP_CONFIG.PORT, () => {
  console.log(`Server avviato su http://localhost:${APP_CONFIG.PORT}`);
});
