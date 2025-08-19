const crypto = require("crypto");

const CORRECT_CODE = process.env.CORRECT_CODE || "2245";
const SECRET_KEY = process.env.SECRET_KEY || "musart_secret_123";
const TIME_LIMIT_MINUTES = 2;

exports.handler = async (event) => {
  const { code } = JSON.parse(event.body || "{}");

  if (code !== CORRECT_CODE) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: "Invalid code" }),
    };
  }

  const startTime = Date.now();
  const hash = crypto
    .createHash("sha256")
    .update(startTime + SECRET_KEY)
    .digest("hex");

  return {
    statusCode: 200,
    body: JSON.stringify({
      startTime,
      hash,
      limit: TIME_LIMIT_MINUTES,
    }),
  };
};
