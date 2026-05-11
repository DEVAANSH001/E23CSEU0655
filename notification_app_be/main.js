import express from "express";
import { Log, setAccessToken } from "../logging_middleware/src/index.js";

process.loadEnvFile?.(".env");

const app = express();
const PORT = process.env.PORT || 3001;

const API = process.env.NOTIFICATION_API_URL
  || "http://4.224.186.213/evaluation-service/notifications";
const token = process.env.AFFORDMED_ACCESS_TOKEN;

if (!token) {
  console.error("env miss");
  process.exit(1);
}

setAccessToken(token);

// CORS middleware
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

const weight = {
  Placement: 3,
  Result: 2,
  Event: 1
};

function score(notification) {
  return (weight[notification.Type] || 0) * 10000000000000
    + new Date(notification.Timestamp).getTime();
}

function pushHeap(heap, item) {
  heap.push(item);
  let index = heap.length - 1;

  while (index > 0) {
    const parent = Math.floor((index - 1) / 2);
    if (score(heap[parent]) >= score(heap[index])) break;

    [heap[parent], heap[index]] = [heap[index], heap[parent]];
    index = parent;
  }
}

function popHeap(heap) {
  if (heap.length === 1) return heap.pop();

  const top = heap[0];
  heap[0] = heap.pop();

  let index = 0;
  while (true) {
    const left = index * 2 + 1;
    const right = index * 2 + 2;
    let biggest = index;

    if (left < heap.length && score(heap[left]) > score(heap[biggest])) {
      biggest = left;
    }

    if (right < heap.length && score(heap[right]) > score(heap[biggest])) {
      biggest = right;
    }

    if (biggest === index) break;

    [heap[index], heap[biggest]] = [heap[biggest], heap[index]];
    index = biggest;
  }

  return top;
}

function topNotifications(notifications, n = 10) {
  const heap = [];

  for (const notification of notifications) {
    pushHeap(heap, notification);
  }

  const result = [];
  while (heap.length > 0 && result.length < n) {
    result.push(popHeap(heap));
  }

  return result;
}

async function safeLog(level, message) {
  try {
    await Log("backend", level, "service", message);
  } catch {
  }
}

// Proxy endpoint for notifications
app.get("/notifications", async (req, res) => {
  try {
    console.log("GET /notifications - params:", req.query);
    await safeLog("info", "fetching notifications");

    const params = new URLSearchParams();
    
    // Cap limit to 10 (external API constraint)
    let limit = parseInt(req.query.limit || "10");
    if (isNaN(limit) || limit > 10) limit = 10;
    if (limit < 1) limit = 1;
    params.set("limit", String(limit));
    
    if (req.query.page) params.set("page", req.query.page);
    if (req.query.notification_type) params.set("notification_type", req.query.notification_type);

    const url = `${API}?${params.toString()}`;
    console.log("Proxying to:", url);
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("External API error:", response.status, body);
      throw new Error(
        `failed to fetch notifications: ${response.status} ${response.statusText} ${body}`
      );
    }

    const data = await response.json();
    console.log("Fetched notifications count:", data.notifications?.length || 0);
    await safeLog("info", `fetched ${data.notifications?.length || 0} notifications`);
    res.json(data);
  } catch (error) {
    const message = error.cause?.message
      ? `${error.message}: ${error.cause.message}`
      : error.message;

    console.error("Proxy error:", message);
    await safeLog("error", message);
    res.status(500).json({ error: message });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Backend is running" });
});

// Test endpoint to verify external API connectivity
app.get("/test-api", async (req, res) => {
  try {
    console.log("Testing external API connectivity...");
    const response = await fetch(API, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    const isOk = response.ok;
    const status = response.status;
    const body = await response.text();
    
    res.json({
      externalAPI: API,
      status: status,
      ok: isOk,
      bodyPreview: body.substring(0, 200),
      message: isOk ? "Successfully connected to external API" : "External API returned an error"
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      message: "Failed to connect to external API"
    });
  }
});

app.listen(PORT, () => {
  console.log(` Notification proxy server running on http://localhost:${PORT}`);
});
