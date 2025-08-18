// Configurazioni
const CONFIG = {
  API_BASE_URL: "/api",
  UPDATE_INTERVAL: 5000,
  DEVICES: {
    MAIN_DOOR: {
      name: "MainDoor",
    },
    APT_DOOR: {
      name: "AptDoor",
    },
  },
};

// Cache
const CACHE = {
  status: null,
  lastUpdated: 0,
  ttl: 3000,
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

// [Tutto il resto del codice rimane uguale alla versione precedente...]
