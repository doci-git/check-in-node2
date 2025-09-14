const API_BASE = "/api"; // redirect Netlify
const USER_ID = "user123";
let currentDevice = null;

function updateButtonState(deviceId, clicksLeft) {
  const btn = document.getElementById(deviceId);
  if (!btn) return;
  btn.disabled = clicksLeft <= 0;
  if (clicksLeft <= 0) {
    btn.classList.add("btn-error");
    btn.classList.remove("btn-success");
  } else {
    btn.classList.add("btn-success");
    btn.classList.remove("btn-error");
  }
}

function showConfirmationPopup(deviceId) {
  currentDevice = deviceId;
  const doorName = deviceId.replace(/([A-Z])/g, " $1").trim();
  document.getElementById(
    "confirmationMessage"
  ).textContent = `Are you sure you want to unlock the ${doorName}?`;
  document.getElementById("confirmationPopup").style.display = "flex";
}

function closeConfirmationPopup() {
  document.getElementById("confirmationPopup").style.display = "none";
  currentDevice = null;
}

function showPopup(deviceId, clicksLeft) {
  const popup = document.getElementById(`popup-${deviceId}`);
  const text = document.getElementById(`popup-text-${deviceId}`);
  if (!popup || !text) return;

  if (clicksLeft > 0) {
    text.innerHTML = `<div><strong>${clicksLeft}</strong> Click Left</div><div>Door Unlocked!</div>`;
  } else {
    text.innerHTML = `<div><strong>No more clicks left!</strong></div><div>Contact for Assistance.</div>`;
  }

  popup.style.display = "flex";
  if (clicksLeft > 0) setTimeout(() => (popup.style.display = "none"), 3000);
}

async function startSession() {
  try {
    await fetch(`${API_BASE}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: USER_ID }),
    });
  } catch (err) {
    console.error("Errore avvio sessione:", err);
  }
}

async function activateDevice(deviceId) {
  try {
    const res = await fetch(`${API_BASE}/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: USER_ID, deviceId }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Errore attivazione");
      return;
    }
    updateButtonState(deviceId, data.clicksLeft);
    showPopup(deviceId, data.clicksLeft);
  } catch (err) {
    console.error("Errore:", err);
  }
}

async function refreshStatus() {
  try {
    const res = await fetch(`${API_BASE}/status/${USER_ID}`);
    const data = await res.json();
    if (data.expired) {
      document.getElementById("expiredOverlay").classList.remove("hidden");
      document.getElementById("controlPanel").classList.add("hidden");
      return;
    }
    for (let key in data.clicks) {
      const deviceId = key.replace("clicks_", "");
      updateButtonState(deviceId, data.clicks[key]);
    }
  } catch (err) {
    console.error("Errore stato:", err);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await startSession();
  await refreshStatus();

  ["MainDoor", "AptDoor", "ExtraDoor1"].forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener("click", () => showConfirmationPopup(id));
  });

  document.getElementById("confirmYes").addEventListener("click", () => {
    if (currentDevice) {
      activateDevice(currentDevice);
      closeConfirmationPopup();
    }
  });
  document
    .getElementById("confirmNo")
    .addEventListener("click", closeConfirmationPopup);

  setInterval(refreshStatus, 5000);
});
