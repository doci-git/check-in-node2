const DEVICES = [
  { id: "e4b063f0c38c", button_id: "MainDoor" },
  { id: "34945478d595", button_id: "AptDoor" },
];

const MAX_CLICKS = 3;
let session = null;
let timeCheckInterval;

// UI Functions
function updateButtonState(device, clicksLeft = MAX_CLICKS) {
  const btn = document.getElementById(device.button_id);
  if (!btn) return;

  btn.disabled = clicksLeft <= 0;
  document.getElementById(`${device.button_id}Clicks`).textContent = clicksLeft;
}

function showDevicePopup(device, clicksLeft) {
  const popup = document.getElementById(`popup-${device.button_id}`);
  const text = document.getElementById(`popup-text-${device.button_id}`);

  text.innerHTML =
    clicksLeft > 0
      ? `<i class="fas fa-check-circle success-icon"></i>
       <div>Hai ancora <strong>${clicksLeft}</strong> click</div>
       <div>Porta sbloccata!</div>`
      : `<i class="fas fa-exclamation-triangle warning-icon"></i>
       <div><strong>Nessun click rimanente!</strong></div>`;

  popup.style.display = "flex";
  if (clicksLeft > 0) setTimeout(() => closePopup(device.button_id), 3000);
}

function closePopup(id) {
  document.getElementById(`popup-${id}`).style.display = "none";
}

function showMessage(type, text, duration = 3000) {
  const msg = document.getElementById("message-box");
  msg.className = type;
  msg.textContent = text;
  msg.style.display = "block";
  setTimeout(() => (msg.style.display = "none"), duration);
}

// Core Functions
async function handleCodeSubmit() {
  const code = document.getElementById("authCode").value.trim();
  if (!code) return showMessage("error", "Inserisci un codice");

  try {
    const res = await fetch("/.netlify/functions/checkCode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Codice errato");

    session = data.session;
    document.getElementById("controlPanel").style.display = "block";
    document.getElementById("auth-form").style.display = "none";

    DEVICES.forEach((d) => updateButtonState(d, MAX_CLICKS));
    checkTimeLimit();
    timeCheckInterval = setInterval(checkTimeLimit, 1000);
  } catch (error) {
    showMessage("error", error.message);
  }
}

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
      showFatalError(data.reason || "Sessione scaduta");
      return;
    }

    document.getElementById("timeRemaining").textContent = `${data.minutesLeft
      .toString()
      .padStart(2, "0")}:${data.secondsLeft.toString().padStart(2, "0")}`;
  } catch (error) {
    console.error("Time check error:", error);
  }
}

async function activateDevice(device) {
  if (!session) return showMessage("error", "Sessione non valida");

  const btn = document.getElementById(device.button_id);
  btn.disabled = true;
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

  try {
    const res = await fetch("/.netlify/functions/activateDevice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.hash}`,
      },
      body: JSON.stringify({
        deviceId: device.id,
        sessionHash: session.hash,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Attivazione fallita");

    showDevicePopup(device, data.clicksLeft);
    updateButtonState(device, data.clicksLeft);
  } catch (error) {
    showMessage("error", error.message);
    if (error.message.includes("401")) resetSession();
  } finally {
    btn.innerHTML = originalText;
  }
}

function resetSession() {
  session = null;
  clearInterval(timeCheckInterval);
  document.getElementById("auth-form").style.display = "block";
  document.getElementById("controlPanel").style.display = "none";
}

function showFatalError(message) {
  document.body.innerHTML = `
    <div class="error-screen">
      <i class="fas fa-exclamation-triangle"></i>
      <div>${message}</div>
      <button onclick="location.reload()">Riprova</button>
    </div>`;
}

// Initialization
function init() {
  // Create message box
  const msgBox = document.createElement("div");
  msgBox.id = "message-box";
  document.body.appendChild(msgBox);

  // Event listeners
  document
    .getElementById("btnCheckCode")
    .addEventListener("click", handleCodeSubmit);
  DEVICES.forEach((device) => {
    document
      .getElementById(device.button_id)
      .addEventListener("click", () => activateDevice(device));
  });
}

document.addEventListener("DOMContentLoaded", init);
