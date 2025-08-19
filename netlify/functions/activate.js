const fetch = require("node-fetch");

const DEVICES = [
  { id: "e4b063f0c38c", auth_key: process.env.DEVICE1_KEY },
  { id: "34945478d595", auth_key: process.env.DEVICE2_KEY },
];


const BASE_URL_SET =
  "https://shelly-73-eu.shelly.cloud/v2/devices/api/set/switch";


exports.handler = async function (event) {
  console.log("Body ricevuto:", event.body);

  try {
    const apiKey = process.env.SHELLY_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "API key mancante" }),
      };
    }

    // Parsiamo il body dal frontend
    const bodyData = JSON.parse(event.body);

    // Esempio: richiesta alla tua API esterna
    const response = await fetch("https://api.esterno.com/activate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bodyData),
    });

    const text = await response.text(); // leggiamo come testo
    let jsonData;
    try {
      jsonData = JSON.parse(text); // prova a fare il parse JSON
    } catch (e) {
      jsonData = { error: text }; // fallback se non è JSON
    }

    return {
      statusCode: 200,
      body: JSON.stringify(jsonData),
    };
  } catch (err) {
    console.error("Errore nella function:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};