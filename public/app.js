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
  // Usa localStorage come fallback, ma preferisci session più duratura
  try {
    // Prova con sessionStorage (più persistente di localStorage in alcuni casi)
    sessionStorage.setItem(key, value);
  } catch (e) {
    // Fallback a localStorage
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
  // Salva anche un backup con timestamp
  setPersistentStorage(
    "sessionBackup",
    JSON.stringify({
      ...session,
      savedAt: Date.now(),
    })
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

// --- Controllo sessione esistente MIGLIORATO ---
function checkExistingSession() {
  const savedSession = loadSession();
  if (savedSession) {
    try {
      sessionData = savedSession;
      console.log(
        "[DEBUG] Sessione esistente trovata, ripristino...",
        sessionData
      );

      showControlPanel();

      DEVICES.forEach(updateButtonState);
      updateStatusBar();

      timeCheckInterval = setInterval(checkTimeLimit, 10000);
      checkTimeLimit();
      return true;
    } catch (e) {
      console.error("[DEBUG] Errore nel parsing della sessione:", e);
      clearSession();
    }
  }
  return false;
}

// --- Mostra pannello di controllo ---
function showControlPanel() {
  if (isFatalError) return;

  const elements = {
    controlPanel: document.getElementById("controlPanel"),
    authForm: document.getElementById("auth-form"),
    btnCheckCode: document.getElementById("btnCheckCode"),
    important: document.getElementById("important"),
    hh2: document.getElementById("hh2"),
  };

  if (elements.controlPanel) elements.controlPanel.style.display = "block";
  if (elements.authForm) elements.authForm.style.display = "none";
  if (elements.btnCheckCode) elements.btnCheckCode.style.display = "none";
  if (elements.important) elements.important.style.display = "none";
  if (elements.hh2) elements.hh2.style.display = "none";
}

// --- Mostra form di autenticazione ---
function showAuthForm() {
  if (isFatalError) return;

  const elements = {
    controlPanel: document.getElementById("controlPanel"),
    authForm: document.getElementById("auth-form"),
    btnCheckCode: document.getElementById("btnCheckCode"),
    important: document.getElementById("important"),
    hh2: document.getElementById("hh2"),
  };

  if (elements.controlPanel) elements.controlPanel.style.display = "none";
  if (elements.authForm) elements.authForm.style.display = "block";
  if (elements.btnCheckCode) elements.btnCheckCode.style.display = "block";
  if (elements.important) elements.important.style.display = "block";
  if (elements.hh2) elements.hh2.style.display = "block";
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

function showFatalError(message) {
  isFatalError = true;
  clearInterval(timeCheckInterval);
  document.body.innerHTML = `<div style="display:flex;justify-content:center;align-items:center;height:100vh;background:#121111;color:#ff6b6b;font-size:24px;">${message}</div>`;
}

// --- Controllo tempo MIGLIORATO ---
async function checkTimeLimit() {
  if (isFatalError) return true;

  if (!sessionData || !sessionData.startTime) {
    console.log("[DEBUG] Sessione non valida, pulizia...");
    clearSession();
    return true;
  }

  try {
    const requestBody = {
      startTime: sessionData.startTime,
      hash: sessionData.hash,
    };

    // Aggiungi il token persistente se disponibile
    if (sessionData.persistentToken) {
      requestBody.persistentToken = sessionData.persistentToken;
    }

    const response = await fetch("/.netlify/functions/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    console.log("[DEBUG] /state response status:", response.status);

    if (!response.ok) {
      const result = await response.json();
      console.log("[DEBUG] Sessione scaduta o errore:", result.error);
      showFatalError(result.error || "Session expired");
      return true;
    }

    const result = await response.json();
    console.log("[DEBUG] /state response body:", result);

    // Aggiorna il token persistente se restituito
    if (result.persistentToken) {
      sessionData.persistentToken = result.persistentToken;
      saveSession(sessionData);
    }

    const timeRemaining = document.getElementById("timeRemaining");
    if (timeRemaining) {
      timeRemaining.textContent = `${result.minutesLeft
        .toString()
        .padStart(2, "0")}:${result.secondsLeft.toString().padStart(2, "0")}`;
    }

    return false;
  } catch (err) {
    console.error("[DEBUG] Errore fetch /state:", err);
    // In caso di errore di rete, non invalidiamo la sessione
    // Mostriamo solo un messaggio generico
    const timeRemaining = document.getElementById("timeRemaining");
    if (timeRemaining) {
      timeRemaining.textContent = "--:--";
    }
    return false;
  }
}

// --- Gestione click PERSISTENTE ---
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

  const mainDoorClicks = document.getElementById("mainDoorClicks");
  const aptDoorClicks = document.getElementById("aptDoorClicks");

  if (mainDoorClicks) {
    mainDoorClicks.textContent = getClicksLeft("clicks_MainDoor");
  }
  if (aptDoorClicks) {
    aptDoorClicks.textContent = getClicksLeft("clicks_AptDoor");
  }

  DEVICES.forEach(updateButtonState);
}

function updateButtonState(device) {
  if (isFatalError) return;

  const btn = document.getElementById(device.button_id);
  const clicksLeft = getClicksLeft(device.storage_key);

  if (btn) {
    btn.disabled = clicksLeft <= 0;
    if (clicksLeft <= 0) {
      btn.style.opacity = "0.6";
      btn.style.cursor = "not-allowed";
    } else {
      btn.style.opacity = "1";
      btn.style.cursor = "pointer";
    }
  }
}

// --- Attivazione device ---
async function activateDevice(device) {
  if (isFatalError) return;

  console.log("[DEBUG] activateDevice chiamato con:", device);

  if (await checkTimeLimit()) {
    console.log("[DEBUG] Sessione scaduta, interrompo attivazione");
    return;
  }

  let clicksLeft = getClicksLeft(device.storage_key);
  console.log(
    "[DEBUG] Click rimanenti per",
    device.storage_key + ":",
    clicksLeft
  );

  if (clicksLeft <= 0) {
    showDevicePopup(device, clicksLeft);
    return;
  }

  setClicksLeft(device.storage_key, --clicksLeft);

  try {
    console.log("[DEBUG] Chiamata /activate →", device.id);
    const response = await fetch("/.netlify/functions/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: device.id }),
    });

    console.log("[DEBUG] /activate status:", response.status);

    const result = await response.json();
    console.log("[DEBUG] /activate body:", result);

    if (response.ok) {
      console.log("[DEBUG] Attivazione riuscita");
      showDevicePopup(device, clicksLeft);
    } else {
      // Ripristina il click se c'è errore
      console.log("[DEBUG] Errore attivazione, ripristino click");
      setClicksLeft(device.storage_key, clicksLeft + 1);

      let errorMessage = "Errore attivazione dispositivo";
      if (result.error) {
        errorMessage = result.error;
      }
      if (result.shellyResponse && result.shellyResponse.raw_response) {
        errorMessage +=
          " - Risposta dispositivo: " + result.shellyResponse.raw_response;
      }

      alert(errorMessage);
    }
  } catch (err) {
    console.error("[DEBUG] Errore fetch /activate:", err);
    setClicksLeft(device.storage_key, clicksLeft + 1);
    alert("Errore di connessione al server");
  }
}

// --- Popup ---
function showDevicePopup(device, clicksLeft) {
  if (isFatalError) return;

  const popup = document.getElementById(`popup-${device.button_id}`);
  const text = document.getElementById(`popup-text-${device.button_id}`);

  if (!popup || !text) return;

  if (clicksLeft > 0) {
    text.innerHTML = `<div>Hai ancora <strong>${clicksLeft}</strong> click disponibili.</div>`;
  } else {
    text.innerHTML = `<div><strong>Nessun click rimasto!</strong></div>`;
  }

  popup.style.display = "flex";
}

function closePopup(buttonId) {
  if (isFatalError) return;

  const popup = document.getElementById(`popup-${buttonId}`);
  if (popup) popup.style.display = "none";
}

// --- Accesso MIGLIORATO ---
async function handleCodeSubmit() {
  if (isFatalError) return;

  const code = document.getElementById("authCode").value.trim();
  console.log("[DEBUG] Inserito codice:", code);

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

    console.log("[DEBUG] /auth response status:", response.status);

    if (!response.ok) {
      const result = await response.json();
      alert(result.error || "Codice errato!");
      return;
    }

    const result = await response.json();
    console.log("[DEBUG] /auth response body:", result);

    saveSession(result);
    console.log("[DEBUG] Sessione avviata e salvata:", sessionData);

    showControlPanel();

    DEVICES.forEach(updateButtonState);
    updateStatusBar();

    timeCheckInterval = setInterval(checkTimeLimit, 10000);
    checkTimeLimit();
  } catch (err) {
    console.error("[DEBUG] Errore fetch /auth:", err);
    alert("Errore di connessione al server di autenticazione");
  }
}

// --- Recupero sessione di emergenza ---
function attemptSessionRecovery() {
  const backup = getPersistentStorage("sessionBackup");
  if (backup) {
    try {
      const backupData = JSON.parse(backup);
      // Verifica che il backup non sia troppo vecchio (max 24 ore)
      const now = Date.now();
      if (
        backupData.savedAt &&
        now - backupData.savedAt < 24 * 60 * 60 * 1000
      ) {
        console.log("[DEBUG] Tentativo recupero sessione da backup");
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

// --- Init MIGLIORATO ---
function init() {
  console.log("[DEBUG] Inizializzazione app...");

  // Inizializza i click se non presenti
  if (getPersistentStorage("clicks_MainDoor") === null) {
    setPersistentStorage("clicks_MainDoor", MAX_CLICKS.toString());
  }
  if (getPersistentStorage("clicks_AptDoor") === null) {
    setPersistentStorage("clicks_AptDoor", MAX_CLICKS.toString());
  }

  // Prima prova a recuperare la sessione normale
  if (!checkExistingSession()) {
    // Se non funziona, prova il recupero di emergenza
    attemptSessionRecovery();
  }

  const btnCheckCode = document.getElementById("btnCheckCode");
  const authCode = document.getElementById("authCode");

  if (btnCheckCode) {
    btnCheckCode.addEventListener("click", handleCodeSubmit);
  }

  if (authCode) {
    authCode.addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        handleCodeSubmit();
      }
    });
  }

  DEVICES.forEach((device) => {
    const btn = document.getElementById(device.button_id);
    if (btn) btn.addEventListener("click", () => activateDevice(device));
  });

  document.querySelectorAll(".popup .btn").forEach((button) => {
    button.addEventListener("click", function () {
      const popup = this.closest(".popup");
      if (popup) closePopup(popup.id.replace("popup-", ""));
    });
  });

  updateStatusBar();

  console.log("[DEBUG] App inizializzata correttamente");
}

document.addEventListener("DOMContentLoaded", init);
