const DEVICES = [
  { id: "e4b063f0c38c", storage_key: "clicks_MainDoor", button_id: "MainDoor" },
  { id: "34945478d595", storage_key: "clicks_AptDoor", button_id: "AptDoor" },
];

const MAX_CLICKS = 3;
let timeCheckInterval;
let sessionData = getStorage("sessionData")
  ? JSON.parse(getStorage("sessionData"))
  : null;
let isFatalError = false;

// --- Gestione storage ---
function setStorage(key, value) {
  localStorage.setItem(key, value);
}
function getStorage(key) {
  return localStorage.getItem(key);
}
function removeStorage(key) {
  localStorage.removeItem(key);
}

// --- Controllo sessione esistente ---
function checkExistingSession() {
  const savedSession = getStorage("sessionData");
  if (savedSession) {
    try {
      sessionData = JSON.parse(savedSession);
      console.log(
        "[DEBUG] Sessione esistente trovata, ripristino...",
        sessionData
      );

      showControlPanel();

      DEVICES.forEach(updateButtonState);
      updateStatusBar();

      timeCheckInterval = setInterval(checkTimeLimit, 10000);
      checkTimeLimit();
    } catch (e) {
      console.error("[DEBUG] Errore nel parsing della sessione:", e);
      clearSession();
    }
  }
}

// --- Mostra pannello di controllo ---
function showControlPanel() {
  if (isFatalError) return;

  const controlPanel = document.getElementById("controlPanel");
  const authForm = document.getElementById("auth-form");
  const btnCheckCode = document.getElementById("btnCheckCode");
  const important = document.getElementById("important");
  const hh2 = document.getElementById("hh2");

  if (controlPanel) controlPanel.style.display = "block";
  if (authForm) authForm.style.display = "none";
  if (btnCheckCode) btnCheckCode.style.display = "none";
  if (important) important.style.display = "none";
  if (hh2) hh2.style.display = "none";
}

// --- Mostra form di autenticazione ---
function showAuthForm() {
  if (isFatalError) return;

  const controlPanel = document.getElementById("controlPanel");
  const authForm = document.getElementById("auth-form");
  const btnCheckCode = document.getElementById("btnCheckCode");
  const important = document.getElementById("important");
  const hh2 = document.getElementById("hh2");

  if (controlPanel) controlPanel.style.display = "none";
  if (authForm) authForm.style.display = "block";
  if (btnCheckCode) btnCheckCode.style.display = "block";
  if (important) important.style.display = "block";
  if (hh2) hh2.style.display = "block";
}

// --- Pulisci sessione ---
function clearSession() {
  if (isFatalError) return;

  sessionData = null;
  removeStorage("sessionData");
  clearInterval(timeCheckInterval);

  showAuthForm();
  document.getElementById("authCode").value = "";
}

function showFatalError(message) {
  isFatalError = true;
  clearInterval(timeCheckInterval);
  document.body.innerHTML = `<div style="display:flex;justify-content:center;align-items:center;height:100vh;background:#121111;color:#ff6b6b;font-size:24px;">${message}</div>`;
}

// --- Controllo tempo ---
async function checkTimeLimit() {
  if (isFatalError) return true;

  if (!sessionData || !sessionData.startTime || !sessionData.hash) {
    console.log("[DEBUG] Sessione non valida, pulizia...");
    clearSession();
    return true;
  }

  console.log("[DEBUG] Check session →", sessionData);

  try {
    const response = await fetch("/.netlify/functions/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startTime: sessionData.startTime,
        hash: sessionData.hash,
      }),
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

    const timeRemaining = document.getElementById("timeRemaining");
    if (timeRemaining) {
      timeRemaining.textContent = `${result.minutesLeft
        .toString()
        .padStart(2, "0")}:${result.secondsLeft.toString().padStart(2, "0")}`;
    }

    return false;
  } catch (err) {
    console.error("[DEBUG] Errore fetch /state:", err);
    // Non mostrare errore fatale per errori di connessione temporanei
    return false;
  }
}

// --- Gestione click ---
function getClicksLeft(key) {
  const stored = getStorage(key);
  return stored === null ? MAX_CLICKS : parseInt(stored, 10);
}

function setClicksLeft(key, count) {
  setStorage(key, count.toString());
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

// --- Accesso ---
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

    sessionData = result;
    setStorage("sessionData", JSON.stringify(sessionData));
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

// --- Init ---
function init() {
  console.log("[DEBUG] Inizializzazione app...");

  // Inizializza i click se non presenti
  if (getStorage("clicks_MainDoor") === null) {
    setStorage("clicks_MainDoor", MAX_CLICKS.toString());
  }
  if (getStorage("clicks_AptDoor") === null) {
    setStorage("clicks_AptDoor", MAX_CLICKS.toString());
  }

  // Controlla subito se c'è una sessione attiva
  checkExistingSession();

  const btnCheckCode = document.getElementById("btnCheckCode");
  const authCode = document.getElementById("authCode");

  if (btnCheckCode) {
    btnCheckCode.addEventListener("click", handleCodeSubmit);
  }

  // Aggiungi evento per il tasto Enter
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

  // Inizializza la status bar
  updateStatusBar();

  console.log("[DEBUG] App inizializzata correttamente");
}

document.addEventListener("DOMContentLoaded", init);
