// functions/activate.js
const fetch = require("node-fetch");
const jwt = require("jsonwebtoken");

const SECRET_KEY = process.env.SECRET_KEY || "musart_secret_123";

// Mappa dispositivi -> chiavi Shelly
const DEVICES = [
  { id: "e4b063f0c38c", auth_key: process.env.DEVICE1_KEY },
  { id: "34945478d595", auth_key: process.env.DEVICE2_KEY },
];

const BASE_URL_SET =
  "https://shelly-73-eu.shelly.cloud/v2/devices/api/set/switch";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function getTokenFromEvent(event) {
  const auth = event.headers?.authorization || event.headers?.Authorization;
  if (auth && auth.startsWith("Bearer ")) return auth.slice(7);
  try {
    const body = JSON.parse(event.body || "{}");
    if (body.token) return body.token;
  } catch (_) {}
  return null;
}

exports.handler = async (event) => {
  console.log(
    "Received event:",
    JSON.stringify({ httpMethod: event.httpMethod })
  );

  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    // Autorizzazione via JWT
    const token = getTokenFromEvent(event);
    if (!token) {
      return {
        statusCode: 401,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Token required" }),
      };
    }

    try {
      jwt.verify(token, SECRET_KEY);
    } catch (e) {
      return {
        statusCode: 403,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Invalid or expired token" }),
      };
    }

    // Parametri richiesta
    const body = JSON.parse(event.body || "{}");
    const { deviceId } = body;

    if (!deviceId) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Device ID is required" }),
      };
    }

    const device = DEVICES.find((d) => d.id === deviceId);
    if (!device) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Device not found" }),
      };
    }

    if (!device.auth_key) {
      console.error("Auth key missing for device:", device.id);
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: "Device configuration error - auth key missing",
        }),
      };
    }

    // Corpo richiesta Shelly
    const requestBody = {
      id: device.id,
      auth_key: device.auth_key,
      channel: 0,
      on: true,
      turn: "on",
    };

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
        const textResponse = await response.text();
        responseData = { raw_response: textResponse, status: "non_json" };
      }
    } catch (parseError) {
      const textResponse = await response.text();
      responseData = { raw_response: textResponse, status: "parse_error" };
    }

    if (response.ok) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: true,
          data: responseData,
          message: "Device activated successfully",
        }),
      };
    } else {
      return {
        statusCode: 502,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: "Device error",
          shellyResponse: responseData,
          statusCode: response.status,
        }),
      };
    }
  } catch (error) {
    console.error("Unhandled error:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
