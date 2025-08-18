const DEVICES = [
  { id: "e4b063f0c38c", storage_key: "clicks_MainDoor", button_id: "MainDoor" },
  { id: "34945478d595", storage_key: "clicks_AptDoor", button_id: "AptDoor" },
];

let session = null;
let timeCheckInterval;

// Funzione per mostrare messaggi all'utente
function showMessage(type, message, duration = 3000) {
  const messageBox = document.getElementById("message-box");
  if (!messageBox) return;

  messageBox.textContent = message;
  messageBox.className = `message ${type}`;
  messageBox.style.display = "block";

  if (duration > 0) {
    setTimeout(() => {
      messageBox.style.display = "none";
    }, duration);
  }
}

// Gestione codice di accesso
async function handleCodeSubmit() {
  const insertedCode = document.getElementById("authCode").value.trim();

  if (!insertedCode) {
    showMessage("error", "Please enter an access code");
    return;
  }

  try {
    const res = await fetch("/.netlify/functions/checkCode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: insertedCode }),
    });

    const data = await res.json();

    if (!res.ok) {
      showMessage("error", data.message || "Invalid code");
      return;
    }

    session = data.session;
    showMessage("success", "Access granted! Loading controls...", 2000);

    // Mostra pannello di controllo
    document.getElementById("controlPanel").style.display = "block";
    document.getElementById("auth-form").style.display = "none";

    // Aggiorna stato iniziale
    DEVICES.forEach((device) => {
      updateButtonState(device, MAX_CLICKS);
    });

    // Avvia controllo tempo
    checkTimeLimit();
    timeCheckInterval = setInterval(checkTimeLimit, 1000);
  } catch (error) {
    console.error("Code submission error:", error);
    showMessage("error", "An error occurred. Please try again.");
  }
}

// Controllo tempo residuo
async function checkTimeLimit() {
  if (!session) return;

  try {
    const res = await fetch("/.netlify/functions/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startTime: session.startTime,
        hash: session.hash,
      }),
    });

    const data = await res.json();

    if (data.expired) {
      clearInterval(timeCheckInterval);
      showFatalError(data.reason || "Session expired!");
      return;
    }

    // Aggiorna UI
    const timeElement = document.getElementById("timeRemaining");
    if (timeElement) {
      timeElement.textContent = `${String(data.minutesLeft).padStart(
        2,
        "0"
      )}:${String(data.secondsLeft).padStart(2, "0")}`;
    }
  } catch (error) {
    console.error("Time check error:", error);
  }
}

// Attivazione dispositivo
async function activateDevice(device) {
  if (!session) {
    showMessage("error", "Session not active");
    return;
  }

  try {
    const res = await fetch("/.netlify/functions/activateDevice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: device.id,
        sessionHash: session.hash,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to activate device");
    }

    showDevicePopup(device, data.clicksLeft);
    updateButtonState(device, data.clicksLeft);
  } catch (error) {
    console.error("Activation error:", error);
    showMessage("error", error.message || "Device activation failed");
  }
}

// UI Helpers (rimangono uguali)
// ... [resto delle funzioni UI esistenti]

// Inizializzazione
function init() {
  // Aggiungi elemento per i messaggi
  const messageBox = document.createElement("div");
  messageBox.id = "message-box";
  messageBox.style.display = "none";
  document.body.appendChild(messageBox);

  // Gestione eventi
  document
    .getElementById("btnCheckCode")
    .addEventListener("click", handleCodeSubmit);

  DEVICES.forEach((device) => {
    const btn = document.getElementById(device.button_id);
    if (btn) {
      btn.addEventListener("click", () => activateDevice(device));
    }
  });

  // Gestione popup
  document.querySelectorAll(".popup .btn").forEach((button) => {
    button.addEventListener("click", function () {
      const popup = this.closest(".popup");
      if (popup) closePopup(popup.id.replace("popup-", ""));
    });
  });
}

document.addEventListener("DOMContentLoaded", init);
