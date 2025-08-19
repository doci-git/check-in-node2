const DEVICES = [
  { id: "e4b063f0c38c", storage_key: "clicks_MainDoor", button_id: "MainDoor" },
  { id: "34945478d595", storage_key: "clicks_AptDoor", button_id: "AptDoor" },
];

const MAX_CLICKS = 3;
let timeCheckInterval;
let sessionData = null; // conterrà startTime e hash dal server

// --- Gestione storage ---
function setStorage(key, value) {
  localStorage.setItem(key, value);
}
function getStorage(key) {
  return localStorage.getItem(key);
}

// --- Controllo tempo ---
async function checkTimeLimit() {
  if (!sessionData) return true;
  console.log("[DEBUG] Check session →", sessionData);

  try {
    const response = await fetch("/.netlify/functions/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sessionData),
    });
    console.log("[DEBUG] /state response status:", response.status);

    const result = await response.json();
    console.log("[DEBUG] /state response body:", result);

    if (!response.ok) {
      showFatalError(result.error || "Session expired");
      return true;
    }

    document.getElementById("timeRemaining").textContent = `${result.minutesLeft
      .toString()
      .padStart(2, "0")}:${result.secondsLeft.toString().padStart(2, "0")}`;

    return false;
  } catch (err) {
    console.error("[DEBUG] Errore fetch /state:", err);
    showFatalError("Connessione persa");
    return true;
  }
}

function showFatalError(message) {
  clearInterval(timeCheckInterval);
  document.body.innerHTML = `<div style="display:flex;justify-content:center;align-items:center;height:100vh;background:#121111;color:#ff6b6b;font-size:24px;">${message}</div>`;
}

// --- Click management ---
function getClicksLeft(key) {
  const stored = getStorage(key);
  return stored === null ? MAX_CLICKS : parseInt(stored, 10);
}
function setClicksLeft(key, count) {
  setStorage(key, count.toString());
  updateStatusBar();
}
function updateStatusBar() {
  document.getElementById("mainDoorClicks").textContent =
    getClicksLeft("clicks_MainDoor");
  document.getElementById("aptDoorClicks").textContent =
    getClicksLeft("clicks_AptDoor");
}

// --- Attivazione device ---
async function activateDevice(device) {
  if (await checkTimeLimit()) return;

  let clicksLeft = getClicksLeft(device.storage_key);
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
      showDevicePopup(device, clicksLeft);
    } else {
      setClicksLeft(device.storage_key, clicksLeft + 1);
      alert(result.error || "Errore attivazione");
    }
  } catch (err) {
    console.error("[DEBUG] Errore fetch /activate:", err);
    setClicksLeft(device.storage_key, clicksLeft + 1);
    alert("Errore di rete");
  }
}

// --- Popup ---
function showDevicePopup(device, clicksLeft) {
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
  const popup = document.getElementById(`popup-${buttonId}`);
  if (popup) popup.style.display = "none";
}

// --- Accesso ---
async function handleCodeSubmit() {
  const code = document.getElementById("authCode").value.trim();
  console.log("[DEBUG] Inserito codice:", code);

  try {
    const response = await fetch("/.netlify/functions/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    console.log("[DEBUG] /auth response status:", response.status);

    const result = await response.json();
    console.log("[DEBUG] /auth response body:", result);

    if (!response.ok) {
      alert("Codice errato!");
      return;
    }

    sessionData = result;
    console.log("[DEBUG] Sessione avviata:", sessionData);

    document.getElementById("controlPanel").style.display = "block";
    document.getElementById("auth-form").style.display = "none";
    document.getElementById("btnCheckCode").style.display = "none";
    document.getElementById("important").style.display = "none";
    document.getElementById("hh2").style.display = "none";

    DEVICES.forEach(updateButtonState);
    updateStatusBar();

    timeCheckInterval = setInterval(checkTimeLimit, 10000);
    checkTimeLimit();
  } catch (err) {
    console.error("[DEBUG] Errore fetch /auth:", err);
    alert("Errore di connessione");
  }
}

function updateButtonState(device) {
  const btn = document.getElementById(device.button_id);
  if (btn) btn.disabled = getClicksLeft(device.storage_key) <= 0;
}

// --- Init ---
function init() {
  document
    .getElementById("btnCheckCode")
    .addEventListener("click", handleCodeSubmit);
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
}
document.addEventListener("DOMContentLoaded", init);
