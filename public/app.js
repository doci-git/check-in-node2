const DEVICES = [
  { id: "e4b063f0c38c", storage_key: "clicks_MainDoor", button_id: "MainDoor" },
  { id: "34945478d595", storage_key: "clicks_AptDoor", button_id: "AptDoor" },
];

const MAX_CLICKS = 3;
let timeCheckInterval;
let sessionData = null;
let isFatalError = false;

// --- Gestione storage PERSISTENTE ---
function setPersistentStorage(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch (e) {
    localStorage.setItem(key, value);
  }
}

function getPersistentStorage(key) {
  try {
    return sessionStorage.getItem(key) || localStorage.getItem(key);
  } catch (e) {
    return localStorage.getItem(key);
  }
}

function removePersistentStorage(key) {
  try {
    sessionStorage.removeItem(key);
  } catch (e) {}
  try {
    localStorage.removeItem(key);
  } catch (e) {}
}

// --- Gestione sessioni multiple ---
function saveSession(session) {
  sessionData = session;
  setPersistentStorage("sessionData", JSON.stringify(session));
  setPersistentStorage(
    "sessionBackup",
    JSON.stringify({ ...session, savedAt: Date.now() })
  );
}

function loadSession() {
  const saved = getPersistentStorage("sessionData");
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error("Error parsing session:", e);
    }
  }
  return null;
}

// --- Controllo sessione esistente ---
function checkExistingSession() {
  const savedSession = loadSession();
  if (savedSession && savedSession.token) {
    sessionData = savedSession;
    console.log("[DEBUG] Sessione esistente trovata:", sessionData);

    showControlPanel();
    DEVICES.forEach(updateButtonState);
    updateStatusBar();

    timeCheckInterval = setInterval(checkTimeLimit, 10000);
    checkTimeLimit();
    return true;
  }
  return false;
}

// --- Mostra pannello ---
function showControlPanel() {
  if (isFatalError) return;
  document
    .getElementById("controlPanel")
    ?.style.setProperty("display", "block");
  document.getElementById("auth-form")?.style.setProperty("display", "none");
  document.getElementById("btnCheckCode")?.style.setProperty("display", "none");
  document.getElementById("important")?.style.setProperty("display", "none");
  document.getElementById("hh2")?.style.setProperty("display", "none");
}

// --- Mostra form ---
function showAuthForm() {
  if (isFatalError) return;
  document.getElementById("controlPanel")?.style.setProperty("display", "none");
  document.getElementById("auth-form")?.style.setProperty("display", "block");
  document
    .getElementById("btnCheckCode")
    ?.style.setProperty("display", "block");
  document.getElementById("important")?.style.setProperty("display", "block");
  document.getElementById("hh2")?.style.setProperty("display", "block");
}

// --- Pulisci sessione ---
function clearSession() {
  if (isFatalError) return;
  sessionData = null;
  removePersistentStorage("sessionData");
  removePersistentStorage("sessionBackup");
  clearInterval(timeCheckInterval);
  showAuthForm();
  const authCode = document.getElementById("authCode");
  if (authCode) authCode.value = "";
}

// --- Errore fatale ---
function showFatalError(message) {
  isFatalError = true;
  clearInterval(timeCheckInterval);
  document.body.innerHTML = `<div style="display:flex;justify-content:center;align-items:center;height:100vh;background:#121111;color:#ff6b6b;font-size:24px;">${message}</div>`;
}

// --- Controllo tempo con JWT ---
async function checkTimeLimit() {
  if (isFatalError) return true;
  if (!sessionData || !sessionData.token) {
    console.log("[DEBUG] Nessun token salvato → clear session");
    clearSession();
    return true;
  }

  try {
    const response = await fetch("/.netlify/functions/state", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + sessionData.token,
      },
    });

    console.log("[DEBUG] /state response status:", response.status);

    const result = await response.json();
    console.log("[DEBUG] /state response body:", result);

    if (!response.ok || !result.valid) {
      showFatalError(result.error || "Session expired");
      return true;
    }

    const timeRemaining = document.getElementById("timeRemaining");
    if (timeRemaining) {
      timeRemaining.textContent =
        `${result.minutesLeft.toString().padStart(2, "0")}:` +
        `${result.secondsLeft.toString().padStart(2, "0")}`;
    }

    return false;
  } catch (err) {
    console.error("[DEBUG] Errore fetch /state:", err);
    document.getElementById("timeRemaining").textContent = "--:--";
    return false;
  }
}

// --- Click persistenti ---
function getClicksLeft(key) {
  const stored = getPersistentStorage(key);
  return stored === null ? MAX_CLICKS : parseInt(stored, 10);
}

function setClicksLeft(key, count) {
  setPersistentStorage(key, count.toString());
  updateStatusBar();
}

function updateStatusBar() {
  if (isFatalError) return;
  document.getElementById("mainDoorClicks").textContent =
    getClicksLeft("clicks_MainDoor");
  document.getElementById("aptDoorClicks").textContent =
    getClicksLeft("clicks_AptDoor");
  DEVICES.forEach(updateButtonState);
}

function updateButtonState(device) {
  if (isFatalError) return;
  const btn = document.getElementById(device.button_id);
  const clicksLeft = getClicksLeft(device.storage_key);
  if (btn) {
    btn.disabled = clicksLeft <= 0;
    btn.style.opacity = clicksLeft <= 0 ? "0.6" : "1";
    btn.style.cursor = clicksLeft <= 0 ? "not-allowed" : "pointer";
  }
}

// --- Attivazione device ---
async function activateDevice(device) {
  if (isFatalError) return;
  if (await checkTimeLimit()) return;

  let clicksLeft = getClicksLeft(device.storage_key);
  if (clicksLeft <= 0) {
    showDevicePopup(device, clicksLeft);
    return;
  }

  setClicksLeft(device.storage_key, --clicksLeft);

  try {
    const response = await fetch("/.netlify/functions/activate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + sessionData.token,
      },
      body: JSON.stringify({ deviceId: device.id }),
    });

    const result = await response.json();
    console.log("[DEBUG] /activate:", result);

    if (response.ok) {
      showDevicePopup(device, clicksLeft);
    } else {
      setClicksLeft(device.storage_key, clicksLeft + 1);
      alert(result.error || "Errore attivazione dispositivo");
    }
  } catch (err) {
    console.error("[DEBUG] Errore fetch /activate:", err);
    setClicksLeft(device.storage_key, clicksLeft + 1);
    alert("Errore di connessione al server");
  }
}

// --- Popup ---
function showDevicePopup(device, clicksLeft) {
  const popup = document.getElementById(`popup-${device.button_id}`);
  const text = document.getElementById(`popup-text-${device.button_id}`);
  if (!popup || !text) return;
  text.innerHTML =
    clicksLeft > 0
      ? `<div>Hai ancora <strong>${clicksLeft}</strong> click disponibili.</div>`
      : `<div><strong>Nessun click rimasto!</strong></div>`;
  popup.style.display = "flex";
}

function closePopup(buttonId) {
  const popup = document.getElementById(`popup-${buttonId}`);
  if (popup) popup.style.display = "none";
}

// --- Login ---
async function handleCodeSubmit() {
  const code = document.getElementById("authCode").value.trim();
  if (!code) {
    alert("Inserisci il codice di accesso");
    return;
  }

  try {
    const response = await fetch("/.netlify/functions/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      const result = await response.json();
      alert(result.error || "Codice errato!");
      return;
    }

    const result = await response.json();
    console.log("[DEBUG] /auth:", result);

    // Salva il token restituito
    saveSession({ token: result.token });
    showControlPanel();

    DEVICES.forEach(updateButtonState);
    updateStatusBar();

    timeCheckInterval = setInterval(checkTimeLimit, 10000);
    checkTimeLimit();
  } catch (err) {
    console.error("[DEBUG] Errore fetch /auth:", err);
    alert("Errore di connessione al server");
  }
}

// --- Recupero sessione backup ---
function attemptSessionRecovery() {
  const backup = getPersistentStorage("sessionBackup");
  if (backup) {
    try {
      const backupData = JSON.parse(backup);
      const now = Date.now();
      if (
        backupData.savedAt &&
        now - backupData.savedAt < 24 * 60 * 60 * 1000
      ) {
        sessionData = backupData;
        saveSession(sessionData);
        checkExistingSession();
        return true;
      }
    } catch (e) {
      console.error("[DEBUG] Errore recupero backup:", e);
    }
  }
  return false;
}

// --- Init ---
function init() {
  if (getPersistentStorage("clicks_MainDoor") === null)
    setPersistentStorage("clicks_MainDoor", MAX_CLICKS.toString());
  if (getPersistentStorage("clicks_AptDoor") === null)
    setPersistentStorage("clicks_AptDoor", MAX_CLICKS.toString());

  if (!checkExistingSession()) attemptSessionRecovery();

  document
    .getElementById("btnCheckCode")
    ?.addEventListener("click", handleCodeSubmit);

  document.getElementById("authCode")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleCodeSubmit();
  });

  DEVICES.forEach((device) => {
    document
      .getElementById(device.button_id)
      ?.addEventListener("click", () => activateDevice(device));
  });

  document.querySelectorAll(".popup .btn").forEach((button) => {
    button.addEventListener("click", function () {
      const popup = this.closest(".popup");
      if (popup) closePopup(popup.id.replace("popup-", ""));
    });
  });

  updateStatusBar();
}

document.addEventListener("DOMContentLoaded", init);
