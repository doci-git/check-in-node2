const crypto = require("crypto");

const TIME_LIMIT_MINUTES = 2;
const SECRET_KEY = "musart_secret_123";

exports.handler = async (event) => {
  try {
    const { startTime, hash } = JSON.parse(event.body);

    const calcHash = crypto
      .createHash("sha256")
      .update(startTime + SECRET_KEY)
      .digest("hex");

    if (calcHash !== hash) {
      return {
        statusCode: 403,
        body: JSON.stringify({ expired: true, reason: "Security violation" }),
      };
    }

    const now = Date.now();
    const minutesPassed = (now - parseInt(startTime, 10)) / (1000 * 60);

    if (minutesPassed >= TIME_LIMIT_MINUTES) {
      return {
        statusCode: 200,
        body: JSON.stringify({ expired: true, reason: "Session expired" }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        expired: false,
        minutesLeft: Math.floor(TIME_LIMIT_MINUTES - minutesPassed),
        secondsLeft: Math.floor(60 - (minutesPassed % 1) * 60),
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
