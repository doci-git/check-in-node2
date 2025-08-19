const fetch = require("node-fetch");

const DEVICES = [
  { id: "e4b063f0c38c", auth_key: process.env.DEVICE1_KEY },
  { id: "34945478d595", auth_key: process.env.DEVICE2_KEY },
];

const BASE_URL_SET =
  "https://shelly-73-eu.shelly.cloud/v2/devices/api/set/switch";

exports.handler = async (event, context) => {
  console.log("Received event:", JSON.stringify(event));

  // Handle CORS preflight requests
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    console.log("Parsed body:", body);

    const { deviceId } = body;

    if (!deviceId) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ error: "Device ID is required" }),
      };
    }

    const device = DEVICES.find((d) => d.id === deviceId);
    console.log("Found device:", device);

    if (!device) {
      return {
        statusCode: 404,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ error: "Device not found" }),
      };
    }

    // Verifica che la auth_key sia presente
    if (!device.auth_key) {
      console.error("Auth key missing for device:", device.id);
      return {
        statusCode: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          error: "Device configuration error - auth key missing",
        }),
      };
    }

    console.log(
      "Making request to Shelly API with auth_key:",
      device.auth_key ? "PRESENT" : "MISSING"
    );

    const requestBody = {
      id: device.id,
      auth_key: device.auth_key,
      channel: 0,
      on: true,
      turn: "on",
    };

    console.log("Request body to Shelly:", JSON.stringify(requestBody));

    const response = await fetch(BASE_URL_SET, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    let responseData;
    const contentType = response.headers.get("content-type");

    try {
      if (contentType && contentType.includes("application/json")) {
        responseData = await response.json();
      } else {
        // Se non è JSON, leggiamo come testo
        const textResponse = await response.text();
        console.log("Shelly non-JSON response:", textResponse);
        responseData = { raw_response: textResponse, status: "non_json" };
      }
    } catch (parseError) {
      console.log("Error parsing response, reading as text:", parseError);
      const textResponse = await response.text();
      responseData = { raw_response: textResponse, status: "parse_error" };
    }

    console.log("Shelly API response status:", response.status);
    console.log("Shelly API response data:", responseData);

    // Considera successo se lo status HTTP è 200-299
    if (response.ok) {
      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          success: true,
          data: responseData,
          message: "Device activated successfully",
        }),
      };
    } else {
      return {
        statusCode: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          error: "Device error",
          shellyResponse: responseData,
          statusCode: response.status,
        }),
      };
    }
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        error: "Connection failed",
        details: error.message,
      }),
    };
  }
};
