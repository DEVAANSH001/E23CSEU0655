const LOG_API = "http://4.224.186.213/evaluation-service/logs";

let accessToken = "";

export function setAccessToken(token) {
  accessToken = token;
}

export async function Log(stack, level, packageName, message) {
  const token = accessToken || globalThis.process?.env?.AFFORDMED_ACCESS_TOKEN;

  const response = await fetch(LOG_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      stack,
      level,
      package: packageName,
      message
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Logging failed");
  }

  return data;
}
