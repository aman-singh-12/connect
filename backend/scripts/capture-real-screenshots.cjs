'use strict';

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const rootDir = path.join(__dirname, '..', '..');
const screenshotsDir = path.join(rootDir, 'screenshots');

async function capture() {
  console.log('--- Launching Chrome for Authentic Web App Screenshots ---');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
    defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 2 },
  });

  const page = await browser.newPage();

  // Ensure directories exist
  fs.mkdirSync(path.join(screenshotsDir, 'auth'), { recursive: true });
  fs.mkdirSync(path.join(screenshotsDir, 'dashboard'), { recursive: true });
  fs.mkdirSync(path.join(screenshotsDir, 'mobile-view'), { recursive: true });

  try {
    // 1. Login Page
    console.log('Capturing Login page...');
    await page.goto('http://localhost:3001/login', { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(screenshotsDir, 'auth', 'login.png') });

    // 2. Register Page
    console.log('Capturing Register page...');
    await page.goto('http://localhost:3001/register', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(screenshotsDir, 'auth', 'register.png') });

    // 3. Forgot Password Page
    console.log('Capturing Forgot Password page...');
    await page.goto('http://localhost:3001/auth/forgot-password', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(screenshotsDir, 'auth', 'forgot-password.png') });

    // 4. Log in
    console.log('Logging in as demo@connect.com...');
    await page.goto('http://localhost:3001/login', { waitUntil: 'networkidle2', timeout: 30000 });
    await page.type('input[type="email"]', 'demo@connect.com');
    await page.type('input[type="password"]', 'Demo@12345');
    await page.click('button[type="submit"]');

    // Wait for navigation after login
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2500));

    // 5. Dashboard Overview
    console.log('Capturing Dashboard Overview...');
    await page.goto('http://localhost:3001/', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(screenshotsDir, 'dashboard', 'dashboard-overview.png') });
    await page.screenshot({ path: path.join(screenshotsDir, 'dashboard', '1.png') });

    // 6. Tasks / Kanban Board
    console.log('Capturing Kanban Tasks...');
    await page.goto('http://localhost:3001/tasks', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(screenshotsDir, 'dashboard', 'tasks.png') });

    // 7. Projects Directory
    console.log('Capturing Projects page...');
    await page.goto('http://localhost:3001/projects', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(screenshotsDir, 'dashboard', 'projects.png') });

    // 8. Organizations / Team Members
    console.log('Capturing Organizations page...');
    await page.goto('http://localhost:3001/organizations', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(screenshotsDir, 'dashboard', 'organization.png') });
    await page.screenshot({ path: path.join(screenshotsDir, 'dashboard', 'organization-2.png') });

    // 9. Mobile views
    console.log('Capturing Mobile Views...');
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await page.goto('http://localhost:3001/', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(screenshotsDir, 'mobile-view', 'dashboard.png') });

    await page.goto('http://localhost:3001/projects', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(screenshotsDir, 'mobile-view', 'project-list.png') });

    await page.goto('http://localhost:3001/organizations', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(screenshotsDir, 'mobile-view', 'organization.png') });

    console.log('🎉 All authentic screenshots successfully captured from the live Connect app!');
  } finally {
    await browser.close();
  }
}

capture().catch(err => {
  console.error('Error capturing screenshots:', err);
  process.exit(1);
});
