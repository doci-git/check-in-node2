const crypto = require("crypto");

const TIME_LIMIT_MINUTES = 2;
const SECRET_KEY = "musart_secret_123";

// functions/status.js
// functions/status.js
exports.handler = async (event, context) => {
  try {
    console.log("Received event:", event); // Log dell'evento per debug

    // Simuliamo un dato, non usare una funzione non definita
    const someData = { status: "OK" }; // Dati fittizi da restituire
    
    if (!someData) {
      throw new Error("Data not found");
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Status is OK!", data: someData }),
      headers: {
        'Access-Control-Allow-Origin': '*',  // CORS per chiamate cross-origin
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
    };
  } catch (error) {
    console.error("Server Error:", error);  // Log dell'errore nel server
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error', message: error.message }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
    };
  }
};

