import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUT_DIR = "d:\\Projects\\DealFlow360\\DealFlow360\\docs\\screenshots";

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

// 1. Launch Chrome with remote debugging
const chromeProc = spawn(CHROME_PATH, [
  '--headless=new',
  '--remote-debugging-port=9222',
  '--window-size=1440,900',
  '--hide-scrollbars',
  '--disable-gpu',
  '--no-sandbox',
  '--user-data-dir=' + path.join(process.cwd(), '.chrome-tmp')
], { stdio: 'ignore' });

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForCdp() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9222/json/version');
      if (res.ok) {
        const data = await res.json();
        return data.webSocketDebuggerUrl;
      }
    } catch (e) {}
    await sleep(300);
  }
  throw new Error("Failed to connect to Chrome debugging port 9222");
}

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const cb = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) cb.reject(msg.error);
        else cb.resolve(msg.result);
      }
    };
  }

  async ready() {
    if (this.ws.readyState === WebSocket.OPEN) return;
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = reject;
    });
  }

  async send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async close() {
    this.ws.close();
  }
}

async function run() {
  try {
    console.log("Waiting for Chrome CDP...");
    const wsUrl = await waitForCdp();
    console.log("Connected to Chrome:", wsUrl);

    // Get list of targets / pages
    const targetsRes = await fetch('http://127.0.0.1:9222/json');
    const targets = await targetsRes.json();
    const pageTarget = targets.find(t => t.type === 'page') || targets[0];
    console.log("Using page target:", pageTarget.webSocketDebuggerUrl);

    const client = new CdpClient(pageTarget.webSocketDebuggerUrl);
    await client.ready();

    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1.5,
      mobile: false
    });

    // Helper to capture screenshot
    async function capture(url, filename, waitMs = 2000, evaluateFn = null) {
      console.log(`Navigating to ${url}...`);
      await client.send('Page.navigate', { url });
      await sleep(waitMs);

      if (evaluateFn) {
        await client.send('Runtime.evaluate', {
          expression: `(${evaluateFn.toString()})()`,
          awaitPromise: true
        });
        await sleep(1000);
      }

      console.log(`Capturing ${filename}...`);
      const { data } = await client.send('Page.captureScreenshot', { format: 'png' });
      const filePath = path.join(OUT_DIR, filename);
      fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
      console.log(`Saved ${filePath} (${Math.round(data.length * 0.75 / 1024)} KB)`);
    }

    // 1. Login Page
    await capture('http://localhost:5173/login', '01_login_portal.png', 1500);

    // 2. Perform Login via fetch & sessionStorage injection
    console.log("Injecting Auth tokens for aanand.admin...");
    await client.send('Page.navigate', { url: 'http://localhost:5173/login' });
    await sleep(1500);
    await client.send('Runtime.evaluate', {
      expression: `(async () => {
        const res = await fetch('http://127.0.0.1:8000/api/auth/login/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'aanand.admin', password: 'admin123' })
        });
        const data = await res.json();
        sessionStorage.setItem('access_token', data.tokens.access);
        sessionStorage.setItem('refresh_token', data.tokens.refresh);
        return data.user.username;
      })()`,
      awaitPromise: true
    });

    // 3. Executive Sales Dashboard
    await capture('http://localhost:5173/dashboard', '02_executive_dashboard.png', 3000);

    // 4. Kanban Pipeline
    await capture('http://localhost:5173/quotations', '03_pipeline_kanban.png', 2500);

    // 5. Quotation Builder / Deal Desk
    await capture('http://localhost:5173/quotations/43', '04_quotation_builder.png', 3000);

    // 6. Approval SLA Desk
    await capture('http://localhost:5173/approvals', '05_approval_sla_desk.png', 2500);

    // 7. Multi-Warehouse Fulfillment
    await capture('http://localhost:5173/fulfillment', '06_fulfillment_split.png', 2500);

    // 8. Invoices & Billing
    await capture('http://localhost:5173/invoices', '07_invoices_ledger.png', 2500);

    // 9. Deal Health Anomaly Radar
    await capture('http://localhost:5173/deal-health', '08_deal_health_radar.png', 3000);

    // 10. External Customer Negotiation Portal
    await capture('http://localhost:5173/portal/quotations/67dac306-fe74-4f58-b5d1-459ba3879bed', '09_customer_portal.png', 2500);

    // 11. Public Cryptographic Verification
    await capture('http://localhost:5173/verify/Q-E2E-3247DA', '10_cryptographic_verification.png', 2500);

    await client.close();
    console.log("All screenshots captured successfully!");
  } catch (err) {
    console.error("Screenshot error:", err);
  } finally {
    try {
      chromeProc.kill('SIGTERM');
    } catch (e) {}
  }
}

run();
