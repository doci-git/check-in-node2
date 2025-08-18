
    const DEVICES = [
      { id: "e4b063f0c38c", storage_key: "clicks_MainDoor", button_id: "MainDoor" },
      { id: "34945478d595", storage_key: "clicks_AptDoor", button_id: "AptDoor" },
    ];

    let session = null;
    let timeCheckInterval;

    async function getStatus() {
  try {
    const response = await fetch('/.netlify/functions/status', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer YOUR_API_TOKEN',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // Se la risposta non è OK, genera un errore
      const errorData = await response.json();
      console.error('API Error:', errorData);
      throw new Error(errorData.message || 'Something went wrong');
    }

    // Se la risposta è OK, prova a parsare il corpo JSON
    const data = await response.json();
    console.log('API Response:', data);
  } catch (error) {
    console.error('Request failed:', error);
    alert('An error occurred while fetching the status');
  }
}


    // --- Gestione codice di accesso ---
    async function handleCodeSubmit() {
      const insertedCode = document.getElementById("authCode").value.trim();
      const res = await fetch("/api/checkCode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: insertedCode }),
      });

      if (!res.ok) {
        alert("Codice errato! Riprova.");
        return;
      }

      session = await res.json();

      // mostra pannello
      document.getElementById("controlPanel").style.display = "block";
      document.getElementById("auth-form").style.display = "none";

      // Aggiorna stato pulsanti
      DEVICES.forEach(updateButtonState);

      // Avvia controllo tempo
      checkTimeLimit();
      timeCheckInterval = setInterval(checkTimeLimit, 10000);
    }

    // --- Controlla tempo residuo ---
    async function checkTimeLimit() {
      if (!session) return;
      const res = await fetch("/api/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startTime: session.startTime, hash: session.hash }),
      });
      const data = await res.json();

      if (data.expired) {
        showFatalError(data.reason || "Sessione scaduta!");
        return;
      }

      document.getElementById("timeRemaining").textContent =
        `${String(data.minutesLeft).padStart(2,"0")}:${String(data.secondsLeft).padStart(2,"0")}`;
    }

    // --- Attiva dispositivo ---
    async function activateDevice(device) {
      if (!session) return;

      const res = await fetch("/api/activateDevice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: device.id }),
      });

      const data = await res.json();
      const clicksLeft = data.clicksLeft ?? 0;

      if (data.success) {
        showDevicePopup(device, clicksLeft);
      } else {
        showDevicePopup(device, clicksLeft);
      }

      updateButtonState(device, clicksLeft);
    }

    // --- UI helpers ---
    function updateButtonState(device, clicksLeft = null) {
      const btn = document.getElementById(device.button_id);
      if (!btn) return;
      if (clicksLeft === null) return; // se non abbiamo dati nuovi, non aggiorniamo
      btn.disabled = clicksLeft <= 0;
      if (device.button_id === "MainDoor") {
        document.getElementById("mainDoorClicks").textContent = clicksLeft;
      } else {
        document.getElementById("aptDoorClicks").textContent = clicksLeft;
      }
    }

    function showDevicePopup(device, clicksLeft) {
      const popup = document.getElementById(`popup-${device.button_id}`);
      const text = document.getElementById(`popup-text-${device.button_id}`);

      if (clicksLeft > 0) {
        text.innerHTML = `
          <i class="fas fa-check-circle" style="color:#4CAF50; font-size:2.5rem;"></i>
          <div>Hai ancora <strong>${clicksLeft}</strong> click disponibili</div>
          <div>La porta è stata sbloccata!</div>`;
      } else {
        text.innerHTML = `
          <i class="fas fa-exclamation-triangle" style="color:#FFC107; font-size:2.5rem;"></i>
          <div><strong>Nessun click rimanente!</strong></div>`;
      }

      popup.style.display = "flex";
      if (clicksLeft > 0) {
        setTimeout(() => closePopup(device.button_id), 3000);
      }
    }

    function closePopup(buttonId) {
      const popup = document.getElementById(`popup-${buttonId}`);
      if (popup) popup.style.display = "none";
    }

    function showFatalError(message) {
      clearInterval(timeCheckInterval);
      document.body.innerHTML = `
        <div style="
          position:fixed; top:0; left:0; width:100%; height:100vh;
          display:flex; justify-content:center; align-items:center;
          background:#121111; color:#ff6b6b; font-size:24px;
          text-align:center; padding:20px; z-index:9999;">
          ${message}
        </div>`;
    }

    // --- Inizializzazione ---
    function init() {
      document.getElementById("btnCheckCode")
        .addEventListener("click", handleCodeSubmit);

      DEVICES.forEach(device => {
        const btn = document.getElementById(device.button_id);
        if (btn) {
          btn.addEventListener("click", () => activateDevice(device));
        }
      });

      document.querySelectorAll(".popup .btn").forEach(button => {
        button.addEventListener("click", function() {
          const popup = this.closest(".popup");
          if (popup) closePopup(popup.id.replace("popup-",""));
        });
      });
    }

    document.addEventListener("DOMContentLoaded", init);
