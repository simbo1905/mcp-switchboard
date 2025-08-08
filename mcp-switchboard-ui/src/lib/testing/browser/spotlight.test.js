/**
 * Browser Testing - Spotlight Search Behavior (Simple Start)
 * 
 * Start with basic screenshot testing, build complexity over time
 */

const puppeteer = require('puppeteer');
const path = require('path');
const { installSpotlightMock, SPOTLIGHT_MOCK_MODELS } = require('./spotlight.mock.js');

// Test configuration
const FRONTEND_URL = 'file://' + path.join(__dirname, '../../../../build/test.html');
const SCREENSHOT_DIR = path.join(__dirname, '../../../../target/test-screenshots');

describe('Spotlight Search - Basic Screenshot Testing', () => {
  let browser;
  let page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: process.env.CI ? true : false,
      slowMo: process.env.CI ? 0 : 200, // Visible for development
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--allow-file-access-from-files']
    });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });
    
    // Simple console logging
    page.on('console', msg => console.log(`[BROWSER] ${msg.text()}`));
    page.on('pageerror', error => console.error(`[ERROR] ${error.message}`));
    
    // Inject spotlight-specific Tauri mock before loading
    await page.evaluateOnNewDocument(() => {
      // Spotlight test mock - comprehensive model data for testing
      const SPOTLIGHT_MOCK_MODELS = [
        { id: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo", display_name: "Meta Llama 3.1 8B", organization: "Meta" },
        { id: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo", display_name: "Meta Llama 3.1 70B", organization: "Meta" },
        { id: "deepseek-ai/deepseek-chat", display_name: "DeepSeek Chat", organization: "DeepSeek" },
        { id: "deepseek-ai/deepseek-coder", display_name: "DeepSeek Coder", organization: "DeepSeek" },
        { id: "Qwen/Qwen2.5-7B-Instruct-Turbo", display_name: "Qwen 2.5 7B", organization: "Qwen" },
        { id: "mistralai/Mistral-7B-Instruct-v0.3", display_name: "Mistral 7B", organization: "Mistral AI" }
      ];
      let mockHasApiKey = true;
      let mockCurrentModel = SPOTLIGHT_MOCK_MODELS[0].id;
      
      if (!window.__TAURI__) {
        window.__TAURI__ = {
          core: {
            invoke: async (command, args = {}) => {
              console.log(`[SPOTLIGHT MOCK] ${command}:`, args);
              switch (command) {
                case 'has_api_config': return mockHasApiKey;
                case 'save_api_config': mockHasApiKey = true; return;
                case 'get_available_models': 
                  console.log(`[SPOTLIGHT MOCK] Returning ${SPOTLIGHT_MOCK_MODELS.length} models`);
                  return SPOTLIGHT_MOCK_MODELS;
                case 'get_current_model': return mockCurrentModel;
                case 'set_preferred_model': mockCurrentModel = args.model; return;
                default: return null;
              }
            }
          },
          event: { async listen() { return () => {}; } }
        };
        console.log('[SPOTLIGHT MOCK] Mock bridge installed for spotlight testing');
      }
    });
    
    // Navigate to built app
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterEach(async () => {
    if (page && !page.isClosed()) {
      await page.close();
    }
  });

  test('should screenshot app startup state - PROOF OF LIFE', async () => {
    const consoleMessages = [];
    
    // Capture console for proof of life
    page.on('console', msg => {
      consoleMessages.push(msg.text());
      console.log(`[CONSOLE] ${msg.text()}`);
    });
    
    // Take BEFORE screenshot
    const beforeScreenshotPath = path.join(SCREENSHOT_DIR, 'current', 'spotlight-app-before.png');
    await page.screenshot({ path: beforeScreenshotPath, fullPage: true });
    console.log(`📸 BEFORE screenshot: ${beforeScreenshotPath}`);
    
    // Wait for app to fully load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Take AFTER screenshot 
    const afterScreenshotPath = path.join(SCREENSHOT_DIR, 'current', 'spotlight-app-after.png');
    await page.screenshot({ path: afterScreenshotPath, fullPage: true });
    console.log(`📸 AFTER screenshot: ${afterScreenshotPath}`);
    
    // PROOF OF LIFE - check for startup messages
    const proofOfLife = consoleMessages.some(msg => 
      msg.includes('[STARTUP]') || 
      msg.includes('Frontend initialized') ||
      msg.includes('Debug interface')
    );
    
    console.log(`🔍 Proof of life found: ${proofOfLife}`);
    console.log(`🎯 MANUAL VERIFICATION: Compare ${beforeScreenshotPath} vs ${afterScreenshotPath}`);
    
    // Basic verification - app loaded
    const bodyText = await page.$eval('body', el => el.textContent);
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test('should screenshot spotlight opening', async () => {
    // Set up API key if needed
    await setupApiKeyIfNeeded(page);
    
    // Click input and type "/"
    await page.click('input[placeholder*="message"]');
    await page.keyboard.type('/');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Screenshot spotlight opened state
    const screenshotPath = path.join(SCREENSHOT_DIR, 'current', 'spotlight-basic-open.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot saved: ${screenshotPath}`);
    
    // Basic check - something changed on screen
    const spotlightExists = await page.$('.spotlight-overlay') !== null;
    expect(spotlightExists).toBe(true);
  });

  test('should screenshot typing in spotlight', async () => {
    await setupApiKeyIfNeeded(page);
    
    // Open spotlight and type something simple
    await page.click('input[placeholder*="message"]');
    await page.keyboard.type('/model');
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Screenshot with typing
    const screenshotPath = path.join(SCREENSHOT_DIR, 'current', 'spotlight-typed.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot saved: ${screenshotPath}`);
  });
});

/**
 * Helper function to set up API key if needed
 */
async function setupApiKeyIfNeeded(page) {
  // Check if API key setup is shown
  const setupButtonExists = await page.$('button') !== null;
  
  if (setupButtonExists) {
    const buttonText = await page.$eval('button', el => el.textContent);
    
    if (buttonText.includes('Configure')) {
      // Click setup button
      await page.click('button');
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Enter a test API key
      await page.type('input[type="password"]', 'test-api-key-12345');
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Click save
      await page.click('button:not(.secondary)');
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}

module.exports = {
  setupApiKeyIfNeeded
};