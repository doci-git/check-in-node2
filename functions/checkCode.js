const crypto = require("crypto");

const CORRECT_CODE = "2245";
const TIME_LIMIT_MINUTES = 2;
const SECRET_KEY = "musart_secret_123";
exports.handler = async function (event, context) {
  try {
    const body = JSON.parse(event.body); // Assumiamo che il codice venga passato nel body
    const insertedCode = body.code;

    const CORRECT_CODE = "2245";

    // Verifica se il codice inserito è corretto
    if (insertedCode !== CORRECT_CODE) {
      return {
        statusCode: 400, // Codice di errore
        body: JSON.stringify({ message: "Incorrect code! Please try again." }),
      };
    }

    // Se il codice è corretto
    return {
      statusCode: 200, // Codice di successo
      body: JSON.stringify({ message: "Code is correct! Access granted." }),
    };
  } catch (error) {
    console.error("Error in checkCode function:", error); // Log dell'errore
    return {
      statusCode: 500, // Codice di errore interno
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};
