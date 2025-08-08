/**
 * Browser Testing - App Startup Health Check
 * 
 * Verifies the application starts correctly with clean console logs
 * and proper API key configuration flow using Tauri command mocking.
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { installStartupMock, setMockHasApiKey } = require('./startup.mock.js');

// Use built frontend with Tauri mocking
const FRONTEND_URL = 'file://' + path.join(__dirname, '../../../../build/test.html');
const SCREENSHOT_DIR = path.join(__dirname, '../../../../target/test-screenshots');

describe('App Startup Health Check', () => {
  let browser;
  let page;
  let mockServer;

  beforeAll(async () => {
    console.log(`Loading frontend from: ${FRONTEND_URL}`);
    
    // Launch browser
    browser = await puppeteer.launch({
      headless: process.env.CI ? true : false, // Show browser in development
      slowMo: process.env.CI ? 0 : 50, // Slow down for visibility
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--allow-file-access-from-files']
    });
    
    // Ensure screenshot directories exist
    fs.mkdirSync(path.join(SCREENSHOT_DIR, 'baselines'), { recursive: true });
    fs.mkdirSync(path.join(SCREENSHOT_DIR, 'current'), { recursive: true });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
    // Mock API server will be stopped by just command
  });

  beforeEach(async () => {
    page = await browser.newPage();
    
    // Capture console messages
    page.on('console', msg => {
      console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`);
    });
    
    // Capture page errors
    page.on('pageerror', error => {
      console.error(`[BROWSER ERROR] ${error.message}`);
    });
    
    // Set viewport
    await page.setViewport({ width: 1200, height: 800 });
  });

  afterEach(async () => {
    if (page && !page.isClosed()) {
      await page.close();
    }
  });

  test('should start with clean console and no errors - PROOF OF LIFE', async () => {
    const consoleMessages = [];
    const errors = [];
    
    // Capture all console messages for proof of life verification
    page.on('console', msg => {
      const message = {
        type: msg.type(),
        text: msg.text()
      };
      consoleMessages.push(message);
      console.log(`[CONSOLE] ${message.type}: ${message.text}`);
    });
    
    // Capture errors
    page.on('pageerror', error => {
      errors.push(error.message);
      console.error(`[PAGE ERROR] ${error.message}`);
    });
    
    // Take BEFORE screenshot
    const beforeScreenshotPath = path.join(SCREENSHOT_DIR, 'current', 'startup-before.png');
    await page.screenshot({ path: beforeScreenshotPath, fullPage: true });
    console.log(`📸 BEFORE screenshot saved: ${beforeScreenshotPath}`);
    
    // Inject startup-specific mock Tauri bridge before loading app
    await page.evaluateOnNewDocument(() => {
      // Startup test mock - inline for reliability
      const MOCK_MODELS = [
        { id: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo", display_name: "Meta Llama 3.1 8B", organization: "Meta" },
        { id: "deepseek-ai/deepseek-chat", display_name: "DeepSeek Chat", organization: "DeepSeek" }
      ];
      let mockHasApiKey = true;
      let mockCurrentModel = MOCK_MODELS[0].id;
      
      if (typeof window !== 'undefined' && !window.__TAURI__) {
        window.__TAURI__ = {
          core: {
            invoke: async (command, args = {}) => {
              console.log(`[STARTUP MOCK] ${command}:`, args);
              switch (command) {
                case 'has_api_config': return mockHasApiKey;
                case 'save_api_config': mockHasApiKey = true; return;
                case 'get_available_models': return MOCK_MODELS;
                case 'get_current_model': return mockCurrentModel;
                case 'set_preferred_model': mockCurrentModel = args.model; return;
                case 'log_info': return;
                case 'get_build_info': return {
                  version: "0.1.0-startup-test",
                  build_time: new Date().toISOString(),
                  git_sha: "startup-test-sha",
                  fingerprint: "startup-test-fingerprint"
                };
                default: throw new Error(`Unknown command: ${command}`);
              }
            }
          },
          event: {
            async listen(eventName, callback) {
              console.log(`[STARTUP MOCK] listen(${eventName})`);
              return () => {};
            }
          }
        };
        console.log('[STARTUP MOCK] Mock bridge installed');
      }
    });
    
    // Navigate to built app
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    
    // Wait for initial app loading and proof of life messages
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Take AFTER screenshot
    const afterScreenshotPath = path.join(SCREENSHOT_DIR, 'current', 'startup-after.png');
    await page.screenshot({ path: afterScreenshotPath, fullPage: true });
    console.log(`📸 AFTER screenshot saved: ${afterScreenshotPath}`);
    
    // PROOF OF LIFE VALIDATION
    console.log(`🔍 Analyzing ${consoleMessages.length} console messages for proof of life...`);
    
    // Check for expected startup messages (PROOF OF LIFE)
    const startupMessages = consoleMessages.filter(msg => 
      msg.text.includes('[STARTUP]') || 
      msg.text.includes('Frontend initialized') ||
      msg.text.includes('Mock API server') ||
      msg.text.includes('Debug interface registered')
    );
    
    console.log(`✅ Found ${startupMessages.length} startup/proof-of-life messages`);
    startupMessages.forEach(msg => console.log(`  - ${msg.text}`));
    
    // Verify we have proof of life
    expect(startupMessages.length).toBeGreaterThan(0);
    
    // Verify no critical errors occurred
    expect(errors).toHaveLength(0);
    
    // Verify no TypeScript errors
    const tsErrors = consoleMessages.filter(msg => 
      msg.type === 'error' && (
        msg.text.includes('TypeError') ||
        msg.text.includes('ReferenceError') ||
        msg.text.includes('Cannot read property')
      )
    );
    
    if (tsErrors.length > 0) {
      console.error('❌ TypeScript errors found:', tsErrors);
    }
    expect(tsErrors).toHaveLength(0);
    
    console.log('🎯 MANUAL VERIFICATION REQUIRED:');
    console.log(`   Compare BEFORE: ${beforeScreenshotPath}`);
    console.log(`   Compare AFTER:  ${afterScreenshotPath}`);
    console.log('   Ensure test was not false positive');
  });

  test('should display API key configuration UI when no key present', async () => {
    // Navigate to app with no-API-key mock injection
    await page.evaluateOnNewDocument(() => {
      // No API key mock - for testing setup UI
      const MOCK_MODELS = [];
      let mockHasApiKey = false;
      
      if (!window.__TAURI__) {
        window.__TAURI__ = {
          core: {
            invoke: async (command, args = {}) => {
              console.log(`[NO-API-KEY MOCK] ${command}:`, args);
              switch (command) {
                case 'has_api_config': return mockHasApiKey;
                case 'save_api_config': mockHasApiKey = true; return;
                case 'get_available_models': return MOCK_MODELS;
                default: return null;
              }
            }
          },
          event: { async listen() { return () => {}; } }
        };
        console.log('[NO-API-KEY MOCK] Mock bridge installed for setup UI test');
      }
    });
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    
    // Wait for initial loading
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Should show welcome/setup UI since no API key is configured
    const welcomeText = await page.$eval('body', el => el.textContent);
    expect(welcomeText).toMatch(/configure.*api.*key/i);
    
    // Take screenshot of API key setup state
    const screenshotPath = path.join(SCREENSHOT_DIR, 'current', 'api-key-setup.png');
    await page.screenshot({ 
      path: screenshotPath,
      fullPage: true 
    });
    console.log(`Screenshot saved: ${screenshotPath}`);
  });

  test('should validate mock Tauri commands work correctly', async () => {
    // Navigate to app with mock
    await page.evaluateOnNewDocument(() => {
      if (!window.__TAURI__) {
        const MOCK_MODELS = [
          { id: "test-model", display_name: "Test Model", organization: "Test Org" }
        ];
        window.__TAURI__ = {
          core: {
            invoke: async (command) => {
              switch (command) {
                case 'has_api_config': return true;
                case 'get_available_models': return MOCK_MODELS;
                case 'get_current_model': return 'test-model';
                default: return null;
              }
            }
          },
          event: { async listen() { return () => {}; } }
        };
      }
    });
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    
    // Test that mock Tauri commands work
    const hasApiKey = await page.evaluate(async () => {
      return await window.__TAURI__.core.invoke('has_api_config');
    });
    expect(hasApiKey).toBe(true);
    
    const models = await page.evaluate(async () => {
      return await window.__TAURI__.core.invoke('get_available_models');
    });
    expect(Array.isArray(models)).toBe(true);
    expect(models.length).toBeGreaterThan(0);
    expect(models[0]).toHaveProperty('id');
    expect(models[0]).toHaveProperty('display_name');
    expect(models[0]).toHaveProperty('organization');
  });

});

module.exports = {
  SCREENSHOT_DIR
};