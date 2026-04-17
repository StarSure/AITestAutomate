import { nanoid } from "nanoid";
import { chromium } from "playwright-core";
import type { RawRequest } from "./types.js";

const chromeExecutablePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

export type CapturedElement = {
  id: string;
  tag: string;
  text: string;
  role: string | null;
  name: string | null;
  placeholder: string | null;
  selectorHint: string;
};

export type CaptureSession = {
  finalUrl: string;
  title: string;
  requests: RawRequest[];
  elements: CapturedElement[];
  loginAttempted: boolean;
};

export async function capturePageSession(input: {
  url: string;
  username?: string;
  password?: string;
}): Promise<CaptureSession> {
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromeExecutablePath
  });

  const page = await browser.newPage();
  const capturedRequests: RawRequest[] = [];

  page.on("response", async (response) => {
    const request = response.request();
    const method = request.method().toUpperCase();
    if (!["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"].includes(method)) {
      return;
    }

    const requestBody = request.postData();
    let responseBody: unknown;
    try {
      const contentType = response.headers()["content-type"] ?? "";
      if (contentType.includes("application/json")) {
        responseBody = await response.json();
      } else {
        responseBody = (await response.text()).slice(0, 2000);
      }
    } catch {
      responseBody = undefined;
    }

    capturedRequests.push({
      id: nanoid(),
      method: method as RawRequest["method"],
      url: response.url(),
      status: response.status(),
      requestHeaders: request.headers(),
      responseHeaders: response.headers(),
      requestBody: safeJson(requestBody),
      responseBody,
      source: "manual"
    });
  });

  await page.goto(input.url, { waitUntil: "networkidle", timeout: 30000 });

  const loginAttempted = Boolean(input.username && input.password);
  if (loginAttempted) {
    await tryLogin(page, input.username!, input.password!);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);
  }

  const elements = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll("button, input, textarea, select, a, [role], h1, h2, h3, form"))
      .slice(0, 120)
      .map((element, index) => {
        const html = element as HTMLElement;
        const text = (html.innerText || html.textContent || "").trim().replace(/\s+/g, " ").slice(0, 120);
        const placeholder = html.getAttribute("placeholder");
        const role = html.getAttribute("role");
        const name = html.getAttribute("name");
        const id = html.getAttribute("id");
        const className = typeof html.className === "string" ? html.className.split(" ").filter(Boolean).slice(0, 2).join(".") : "";
        const selectorHint = id
          ? `#${id}`
          : className
            ? `${html.tagName.toLowerCase()}.${className}`
            : `${html.tagName.toLowerCase()}:nth-of-type(${index + 1})`;

        return {
          id: `${html.tagName.toLowerCase()}-${index + 1}`,
          tag: html.tagName.toLowerCase(),
          text,
          role,
          name,
          placeholder,
          selectorHint
        };
      });

    return candidates;
  });

  const title = await page.title();
  const finalUrl = page.url();

  await browser.close();

  return {
    finalUrl,
    title,
    requests: capturedRequests,
    elements,
    loginAttempted
  };
}

async function tryLogin(page: import("playwright-core").Page, username: string, password: string) {
  const usernameSelectors = [
    'input[name="username"]',
    'input[name="userName"]',
    'input[placeholder*="用户名"]',
    'input[placeholder*="账号"]',
    'input[type="text"]'
  ];

  const passwordSelectors = [
    'input[type="password"]',
    'input[name="password"]',
    'input[placeholder*="密码"]'
  ];

  const submitSelectors = [
    'button[type="submit"]',
    'button:has-text("登录")',
    'button:has-text("Login")',
    'input[type="submit"]'
  ];

  for (const selector of usernameSelectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) > 0) {
      await locator.fill(username).catch(() => undefined);
      break;
    }
  }

  for (const selector of passwordSelectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) > 0) {
      await locator.fill(password).catch(() => undefined);
      break;
    }
  }

  for (const selector of submitSelectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) > 0) {
      await locator.click().catch(() => undefined);
      return;
    }
  }

  await page.keyboard.press("Enter").catch(() => undefined);
}

function safeJson(value?: string | null) {
  if (!value) {
    return undefined;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
