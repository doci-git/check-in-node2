const crypto = require("crypto");
const { SECRET_KEY, MAX_CLICKS, TIME_LIMIT_MINUTES } = require("./config");
const DEVICES = require("./devices");

// Memoria sessioni (in futuro meglio un DB tipo Redis o MongoDB)
const sessions = {};

function generateHash(value) {
  return crypto
    .createHash("sha256")
    .update(value + SECRET_KEY)
    .digest("hex");
}

function createSession(userId) {
  const startTime = Date.now();
  const hash = generateHash(startTime.toString());

  sessions[userId] = {
    startTime,
    hash,
    clicks: {},
  };

  DEVICES.forEach((d) => {
    sessions[userId].clicks[d.storage_key] = MAX_CLICKS;
  });

  return sessions[userId];
}

function getSession(userId) {
  return sessions[userId] || null;
}

function isExpired(session) {
  const now = Date.now();
  const minutesPassed = (now - session.startTime) / (1000 * 60);
  return minutesPassed >= TIME_LIMIT_MINUTES;
}

function useClick(session, storageKey) {
  if (!session.clicks[storageKey]) return 0;
  session.clicks[storageKey]--;
  return session.clicks[storageKey];
}

module.exports = {
  createSession,
  getSession,
  isExpired,
  useClick,
};
