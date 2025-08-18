const crypto = require("crypto");

const CORRECT_CODE = "2245";
const TIME_LIMIT_MINUTES = 2;
const SECRET_KEY = "musart_secret_123";

exports.handler = async (event) => {
  try {
    const { code } = JSON.parse(event.body);

    if (code !== CORRECT_CODE) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Invalid code" }),
      };
    }

    const now = Date.now().toString();
    const hash = crypto
      .createHash("sha256")
      .update(now + SECRET_KEY)
      .digest("hex");

    return {
      statusCode: 200,
      body: JSON.stringify({
        startTime: now,
        hash,
        expiresIn: TIME_LIMIT_MINUTES * 60,
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
