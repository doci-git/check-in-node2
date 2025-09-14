const express = require("express");
const bodyParser = require("body-parser");
const fetch = require("node-fetch");
const { BASE_URL_SET, TIME_LIMIT_MINUTES } = require("./config");
const DEVICES = require("./devices");
const {
  createSession,
  getSession,
  isExpired,
  useClick,
} = require("./sessionManager");

const app = express();
app.use(bodyParser.json());

// Avvio sessione
app.post("/api/start", (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "userId mancante" });

  const session = createSession(userId);
  res.json({ message: "Sessione avviata", expiresIn: TIME_LIMIT_MINUTES });
});

// Stato sessione
app.get("/api/status/:userId", (req, res) => {
  const session = getSession(req.params.userId);
  if (!session) return res.status(404).json({ error: "Sessione non trovata" });

  res.json({
    clicks: session.clicks,
    expired: isExpired(session),
  });
});

// Attivazione device
app.post("/api/activate", async (req, res) => {
  const { userId, deviceId } = req.body;
  const session = getSession(userId);
  if (!session) return res.status(401).json({ error: "Sessione non valida" });
  if (isExpired(session))
    return res.status(403).json({ error: "Sessione scaduta" });

  const device = DEVICES.find((d) => d.id === deviceId);
  if (!device)
    return res.status(404).json({ error: "Dispositivo non trovato" });

  if (session.clicks[device.storage_key] <= 0) {
    return res.status(429).json({ error: "Nessun click rimanente" });
  }

  // Usa un click
  const clicksLeft = useClick(session, device.storage_key);

  try {
    const response = await fetch(BASE_URL_SET, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: device.id,
        auth_key: device.auth_key,
        channel: 0,
        on: true,
      }),
    });

    if (!response.ok) {
      session.clicks[device.storage_key]++; // rollback
      return res.status(500).json({ error: "Errore attivazione dispositivo" });
    }

    res.json({ message: "Dispositivo attivato", clicksLeft });
  } catch (err) {
    session.clicks[device.storage_key]++; // rollback
    res.status(500).json({ error: "Errore rete", details: err.message });
  }
});

// Avvio server
const PORT = 3000;
app.listen(PORT, () => console.log(`Backend su http://localhost:${PORT}`));
