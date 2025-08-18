// Configurazioni
const CONFIG = {
  API_BASE_URL: "https://test2check-in.netlify.app/api",
  UPDATE_INTERVAL: 5000,
  DEVICES: {
    MAIN_DOOR: {
      id: "e4b063f0c38c",
      name: "MainDoor",
    },
    APT_DOOR: {
      id: "34945478d595",
      name: "AptDoor",
    },
  },
};

// Cache
const CACHE = {
  status: null,
  lastUpdated: 0,
  ttl: 3000, // 3 secondi di cache
};

// Stato applicazione
const AppState = {
  token: null,
  timeLimit: 0,
  updateInterval: null,
};

// Elementi DOM
const DOM = {
  authCode: document.getElementById("authCode"),
  btnCheckCode: document.getElementById("btnCheckCode"),
  controlPanel: document.getElementById("controlPanel"),
  timeLeft: document.getElementById("timeRemaining"),
  mainClicks: document.getElementById("mainDoorClicks"),
  aptClicks: document.getElementById("aptDoorClicks"),
  msg: document.getElementById("msg"),
  mainDoorBtn: document.getElementById("MainDoor"),
  aptDoorBtn: document.getElementById("AptDoor"),
};

// Inizializzazione
function init() {
  setupEventListeners();
  setupOfflineDetection();
}

// Configura event listeners
function setupEventListeners() {
  DOM.btnCheckCode.addEventListener("click", handleLogin);
  DOM.mainDoorBtn.addEventListener("click", () =>
    activateDevice(CONFIG.DEVICES.MAIN_DOOR)
  );
  DOM.aptDoorBtn.addEventListener("click", () =>
    activateDevice(CONFIG.DEVICES.APT_DOOR)
  );
}

// Gestione stato offline/online
function setupOfflineDetection() {
  window.addEventListener("offline", () => {
    showAlert(
      "Connessione persa. Alcune funzionalità potrebbero non essere disponibili.",
      "warning"
    );
  });

  window.addEventListener("online", () => {
    showAlert("Connessione ripristinata.", "success");
    if (AppState.token) updateStatus();
  });
}

// Gestione login
async function handleLogin() {
  const code = DOM.authCode.value.trim();

  if (!code) {
    showAlert("Inserire un codice di autorizzazione");
    return;
  }

  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    const data = await parseResponse(response);

    if (data.error) {
      throw new Error(data.error);
    }

    AppState.token = data.token;
    AppState.timeLimit = data.timeLimit;

    showControlPanel();
    startStatusUpdates();
    showAlert(data.message, "success");
  } catch (error) {
    console.error("Login error:", error);
    showAlert(error.message);
  }
}

// Mostra pannello di controllo
function showControlPanel() {
  DOM.controlPanel.style.display = "block";
  updateStatus();
}

// Avvia aggiornamenti stato
function startStatusUpdates() {
  stopStatusUpdates();
  AppState.updateInterval = setInterval(updateStatus, CONFIG.UPDATE_INTERVAL);
}

// Ferma aggiornamenti
function stopStatusUpdates() {
  if (AppState.updateInterval) {
    clearInterval(AppState.updateInterval);
    AppState.updateInterval = null;
  }
}

// Aggiorna stato con cache
async function updateStatus() {
  if (!AppState.token) return;

  const now = Date.now();
  if (CACHE.status && now - CACHE.lastUpdated < CACHE.ttl) {
    updateUI(CACHE.status, calculateTimeLeft(CACHE.status.startTime));
    return;
  }

  try {
    const response = await fetch(
      `${CONFIG.API_BASE_URL}/status?token=${AppState.token}`
    );
    const data = await parseResponse(response);

    if (data.error) {
      throw new Error(data.error);
    }

    CACHE.status = data;
    CACHE.lastUpdated = now;

    updateUI(data, calculateTimeLeft(data.startTime));
  } catch (error) {
    console.error("Update status error:", error);
    handleSessionError(error.message);
  }
}

function calculateTimeLeft(startTime) {
  return Math.max(
    0,
    AppState.timeLimit - Math.floor((Date.now() - startTime) / (1000 * 60))
  );
}

// Gestione errori sessione
function handleSessionError(errorMessage) {
  DOM.msg.textContent = errorMessage;

  if (errorMessage.includes("non valido") || errorMessage.includes("scaduto")) {
    DOM.controlPanel.style.display = "none";
    stopStatusUpdates();
    AppState.token = null;
    CACHE.status = null;
  }
}

// Aggiorna UI
function updateUI(data, minutesLeft) {
  DOM.timeLeft.textContent = formatTime(minutesLeft);
  DOM.mainClicks.textContent = data.clicks.MainDoor;
  DOM.aptClicks.textContent = data.clicks.AptDoor;

  // Disabilita pulsanti se non ci sono click disponibili
  DOM.mainDoorBtn.disabled = data.clicks.MainDoor <= 0;
  DOM.aptDoorBtn.disabled = data.clicks.AptDoor <= 0;
}

// Formatta tempo
function formatTime(minutes) {
  const mins = Math.floor(minutes);
  const secs = Math.floor((minutes - mins) * 60);
  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}

// Attiva dispositivo
async function activateDevice(deviceConfig) {
  if (!AppState.token) {
    showAlert("Sessione non valida");
    return;
  }

  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}/activate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        device: deviceConfig.name,
        token: AppState.token,
      }),
    });

    const data = await parseResponse(response);

    if (data.error) {
      throw new Error(data.error);
    }

    showAlert(data.message, "success");
    // Invalida cache dopo attivazione
    CACHE.status = null;
    updateStatus();
  } catch (error) {
    console.error(`Activate ${deviceConfig.name} error:`, error);
    showAlert(error.message);
  }
}

// Parsing risposta
async function parseResponse(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { error: text || `HTTP error! Status: ${response.status}` };
  }
}

// Mostra alert migliorato
function showAlert(message, type = "error") {
  const alertBox = document.createElement("div");
  alertBox.className = `custom-alert ${type}`;
  alertBox.innerHTML = `
    <div class="alert-content">
      <p>${message}</p>
      <button onclick="this.parentElement.parentElement.remove()">OK</button>
    </div>
  `;

  document.body.appendChild(alertBox);
  setTimeout(() => {
    alertBox.classList.add("fade-out");
    setTimeout(() => alertBox.remove(), 500);
  }, 5000);
}

// Inizializza app
document.addEventListener("DOMContentLoaded", init);
