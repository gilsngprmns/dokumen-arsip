const assert = require("node:assert/strict");
const test = require("node:test");

const baseUrl = (process.env.TEST_BASE_URL || "http://localhost:5000").replace(/\/$/, "");
const username = process.env.TEST_USERNAME;
const password = process.env.TEST_PASSWORD;

const request = (path, options = {}) => fetch(`${baseUrl}${path}`, options);

 test("API health endpoint responds", async () => {
  const response = await request("/");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
});

test("protected endpoints reject missing authentication", async () => {
  const response = await request("/api/dokumen");
  assert.equal(response.status, 401);
});

test("login and authenticated workflow", { skip: !username || !password }, async () => {
  const loginResponse = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  assert.equal(loginResponse.status, 200);
  const loginBody = await loginResponse.json();
  assert.ok(loginBody.data?.token);

  const headers = { Authorization: `Bearer ${loginBody.data.token}` };
  const meResponse = await request("/api/auth/me", { headers });
  assert.equal(meResponse.status, 200);

  const documentsResponse = await request("/api/dokumen", { headers });
  assert.equal(documentsResponse.status, 200);

  const requestsResponse = await request("/api/document-requests", { headers });
  assert.equal(requestsResponse.status, 200);
});

test("public QR endpoint rejects an unknown token", async () => {
  const response = await request("/api/dokumen/public/not-a-real-token");
  assert.equal(response.status, 404);
});
