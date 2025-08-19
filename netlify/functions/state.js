const crypto = require("crypto");

const SECRET_KEY = process.env.SECRET_KEY || "musart_secret_123";
const TIME_LIMIT_MINUTES = 2;

exports.handler = async (event) => {
  const { startTime, hash } = JSON.parse(event.body || "{}");

  if (!startTime || !hash) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing data" }) };
  }

  const calcHash = crypto
    .createHash("sha256")
    .update(startTime + SECRET_KEY)
    .digest("hex");

  if (calcHash !== hash) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: "Security violation" }),
    };
  }

  const now = Date.now();
  const minutesPassed = (now - parseInt(startTime, 10)) / (1000 * 60);

  if (minutesPassed >= TIME_LIMIT_MINUTES) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: "Session expired" }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      minutesLeft: Math.max(0, TIME_LIMIT_MINUTES - Math.floor(minutesPassed)),
      secondsLeft: Math.max(0, 60 - Math.floor((minutesPassed % 1) * 60)),
    }),
  };
};
