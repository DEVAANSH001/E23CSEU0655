import { Log, setAccessToken } from "../logging_middleware/src/index.js";

process.loadEnvFile?.(".env");

const API = process.env.NOTIFICATION_API_URL
  || "http://4.224.186.213/evaluation-service/notifications";
const token = process.env.AFFORDMED_ACCESS_TOKEN;

if (!token) {
  console.error("env miss");
  process.exit(1);
}

setAccessToken(token);

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

async function main() {
  try {
    await safeLog("info", "fetching notifications for priority inbox");

    const response = await fetch(API, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `failed to fetch notifications: ${response.status} ${response.statusText} ${body}`
      );
    }

    const data = await response.json();
    const top10 = topNotifications(data.notifications, 10);

    await safeLog("info", "priority inbox top 10 generated");
    console.table(top10);
  } catch (error) {
    const message = error.cause?.message
      ? `${error.message}: ${error.cause.message}`
      : error.message;

    await safeLog("error", message);
    console.error(message);
  }
}

main();
