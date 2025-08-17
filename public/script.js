// Configurazione
const CONFIG = {
  API_BASE_URL: "http://localhost:3000/api",
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

// Stato applicazione
const AppState = {
  token: null,
  timeLimit: 0,
  updateInterval: null,
};

// Cache elementi DOM
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
  checkExistingSession();
}

function setupEventListeners() {
  DOM.btnCheckCode.addEventListener("click", handleLogin);
  DOM.mainDoorBtn.addEventListener("click", () =>
    activateDevice(CONFIG.DEVICES.MAIN_DOOR)
  );
  DOM.aptDoorBtn.addEventListener("click", () =>
    activateDevice(CONFIG.DEVICES.APT_DOOR)
  );
}

function checkExistingSession() {
  const savedToken = localStorage.getItem("shelly_token");
  if (savedToken) {
    AppState.token = savedToken;
    verifyToken();
  }
}

async function verifyToken() {
  try {
    const response = await fetch(
      `${CONFIG.API_BASE_URL}/status?token=${AppState.token}`
    );
    const data = await parseResponse(response);

    if (data.error) {
      throw new Error(data.error);
    }

    AppState.timeLimit = CONFIG.TIME_LIMIT_MINUTES;
    showControlPanel();
    startStatusUpdates();
  } catch (error) {
    localStorage.removeItem("shelly_token");
    console.error("Token verification failed:", error);
  }
}

async function handleLogin() {
  const code = DOM.authCode.value.trim();

  if (!code) {
    showAlert("Inserire un codice di autorizzazione");
    return;
  }

  try {
    DOM.btnCheckCode.disabled = true;
    DOM.btnCheckCode.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Verifica...';

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
    localStorage.setItem("shelly_token", data.token);

    showControlPanel();
    startStatusUpdates();
  } catch (error) {
    console.error("Login error:", error);
    showAlert(error.message);
  } finally {
    DOM.btnCheckCode.disabled = false;
    DOM.btnCheckCode.innerHTML =
      '<i class="fas fa-unlock-alt"></i> Submit Code';
  }
}

function showControlPanel() {
  DOM.controlPanel.style.display = "block";
  updateStatus();
}

function startStatusUpdates() {
  stopStatusUpdates();
  updateStatus();
  AppState.updateInterval = setInterval(updateStatus, CONFIG.UPDATE_INTERVAL);
}

function stopStatusUpdates() {
  if (AppState.updateInterval) {
    clearInterval(AppState.updateInterval);
    AppState.updateInterval = null;
  }
}

async function updateStatus() {
  if (!AppState.token) return;

  try {
    const response = await fetch(
      `${CONFIG.API_BASE_URL}/status?token=${AppState.token}`
    );
    const data = await parseResponse(response);

    if (data.error) {
      throw new Error(data.error);
    }

    const minutesLeft = Math.max(
      0,
      AppState.timeLimit -
        Math.floor((Date.now() - data.startTime) / (1000 * 60))
    );
    updateUI(data, minutesLeft);
  } catch (error) {
    console.error("Update status error:", error);
    handleSessionError(error.message);
  }
}

function updateUI(data, minutesLeft) {
  DOM.timeLeft.textContent = formatTime(minutesLeft);
  DOM.mainClicks.textContent = data.clicks.MainDoor;
  DOM.aptClicks.textContent = data.clicks.AptDoor;

  DOM.mainDoorBtn.disabled = data.clicks.MainDoor <= 0;
  DOM.aptDoorBtn.disabled = data.clicks.AptDoor <= 0;
}

function formatTime(minutes) {
  const mins = Math.floor(minutes);
  const secs = Math.floor((minutes - mins) * 60);
  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}

async function activateDevice(deviceConfig) {
  if (!AppState.token) {
    showAlert("❌ Sessione scaduta o non valida");
    handleSessionError("Sessione non valida");
    return;
  }

  try {
    const btn =
      deviceConfig.name === "MainDoor" ? DOM.mainDoorBtn : DOM.aptDoorBtn;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Attivazione...';

    const response = await fetch(`${CONFIG.API_BASE_URL}/activate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AppState.token}`,
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

    showAlert(
      `✅ ${data.message}\nClick rimasti: ${data.clicksLeft[deviceConfig.name]}`
    );
    updateStatus();
  } catch (error) {
    console.error(`Activate ${deviceConfig.name} error:`, error);
    showAlert(
      `❌ Errore durante l'attivazione di ${deviceConfig.name}:\n${error.message}`
    );
  } finally {
    const btn =
      deviceConfig.name === "MainDoor" ? DOM.mainDoorBtn : DOM.aptDoorBtn;
    btn.disabled = false;
    btn.innerHTML = `<i class="fas fa-key"></i> Sblocca ${deviceConfig.name}`;
  }
}

function handleSessionError(errorMessage) {
  DOM.msg.textContent = errorMessage;

  if (errorMessage.includes("non valido") || errorMessage.includes("scaduto")) {
    DOM.controlPanel.style.display = "none";
    stopStatusUpdates();
    AppState.token = null;
    localStorage.removeItem("shelly_token");
  }
}

async function parseResponse(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { error: text || `HTTP error! Status: ${response.status}` };
  }
}

function showAlert(message) {
  alert(message);
}

// Avvia l'applicazione
document.addEventListener("DOMContentLoaded", init);
