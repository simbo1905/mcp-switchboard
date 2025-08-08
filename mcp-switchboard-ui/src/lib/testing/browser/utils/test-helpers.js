/**
 * Browser Test Utilities
 */

const path = require('path');
const fs = require('fs');

/**
 * Ensure screenshot directories exist
 */
function ensureScreenshotDirs(screenshotDir) {
  const baselineDir = path.join(screenshotDir, 'baselines');
  const currentDir = path.join(screenshotDir, 'current');
  
  fs.mkdirSync(baselineDir, { recursive: true });
  fs.mkdirSync(currentDir, { recursive: true });
  
  return { baselineDir, currentDir };
}

/**
 * Take a screenshot with consistent naming
 */
async function takeScreenshot(page, screenshotDir, filename) {
  const { currentDir } = ensureScreenshotDirs(screenshotDir);
  const screenshotPath = path.join(currentDir, filename);
  
  await page.screenshot({ 
    path: screenshotPath,
    fullPage: true,
    animations: 'disabled' // Disable animations for consistent screenshots
  });
  
  console.log(`📸 Screenshot saved: ${screenshotPath}`);
  return screenshotPath;
}

/**
 * Wait for network idle with retries
 */
async function waitForNetworkIdle(page, timeout = 5000) {
  try {
    await page.waitForLoadState('networkidle', { timeout });
  } catch (error) {
    console.warn('Network idle timeout, continuing anyway');
  }
}

/**
 * Setup API key in the app if needed
 */
async function setupApiKeyIfNeeded(page) {
  try {
    // Wait a bit for app to load
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check if setup button exists
    const setupButton = await page.$('button');
    if (setupButton) {
      const buttonText = await page.$eval('button', el => el.textContent);
      
      if (buttonText && buttonText.includes('Configure')) {
        console.log('Setting up API key for testing...');
        
        // Click setup button
        await page.click('button');
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Enter test API key
        await page.type('input[type="password"]', 'test-api-key-12345');
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Click save button
        await page.click('button:not(.secondary)');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log('API key setup completed');
      }
    }
  } catch (error) {
    console.warn('API key setup failed or not needed:', error.message);
  }
}

module.exports = {
  ensureScreenshotDirs,
  takeScreenshot,
  waitForNetworkIdle,
  setupApiKeyIfNeeded
};