#!/usr/bin/env node

/**
 * Injects build information into the TypeScript build-info.ts file
 * Reads build properties from the build system and replaces placeholders
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const BUILD_INFO_FILE = 'src/lib/build-info.ts';

function readPropertiesFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`Properties file not found: ${filePath}`);
    return {};
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const props = {};
  
  for (const line of content.split('\n')) {
    if (line.includes('=')) {
      const [key, ...valueParts] = line.split('=');
      props[key.trim()] = valueParts.join('=').trim();
    }
  }
  
  return props;
}

function getGitInfo() {
  try {
    const gitCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
    const gitHeadline = execSync('git log -1 --pretty=%s', { encoding: 'utf-8' }).trim();
    const buildTime = new Date().toISOString();
    
    return { gitCommit, gitHeadline, buildTime };
  } catch (error) {
    console.warn('Failed to get git info:', error.message);
    return {
      gitCommit: 'unknown',
      gitHeadline: 'unknown',
      buildTime: new Date().toISOString()
    };
  }
}

function generateFingerprint() {
  try {
    // Simple fingerprint based on current timestamp and git commit
    const { gitCommit } = getGitInfo();
    const timestamp = Date.now();
    return `ui-${gitCommit}-${timestamp.toString(36)}`;
  } catch (error) {
    return `ui-dev-${Date.now().toString(36)}`;
  }
}

function main() {
  console.log('🔧 Injecting build information...');
  
  // Load dependency build info
  const mcpCoreProps = readPropertiesFile('/tmp/build-mcp-core.properties');
  const bindingGenProps = readPropertiesFile('/tmp/build-binding-generator.properties');
  
  // Get current build info
  const { gitCommit, gitHeadline, buildTime } = getGitInfo();
  const fingerprint = generateFingerprint();
  
  // Read the template file
  if (!fs.existsSync(BUILD_INFO_FILE)) {
    console.error(`Build info template not found: ${BUILD_INFO_FILE}`);
    process.exit(1);
  }
  
  let content = fs.readFileSync(BUILD_INFO_FILE, 'utf-8');
  
  // Replace placeholders
  content = content.replace('__BUILD_FINGERPRINT__', fingerprint);
  content = content.replace('__GIT_COMMIT__', gitCommit);
  content = content.replace('__GIT_HEADLINE__', gitHeadline);
  content = content.replace('__BUILD_TIME__', buildTime);
  content = content.replace('__MCP_CORE_FINGERPRINT__', mcpCoreProps.FINGERPRINT || 'unknown');
  content = content.replace('__BINDING_GEN_FINGERPRINT__', bindingGenProps.FINGERPRINT || 'unknown');
  
  // Write the updated file
  fs.writeFileSync(BUILD_INFO_FILE, content, 'utf-8');
  
  console.log(`✅ Build info injected successfully:`);
  console.log(`   Fingerprint: ${fingerprint}`);
  console.log(`   Git commit: ${gitCommit}`);
  console.log(`   Build time: ${buildTime}`);
  console.log(`   MCP Core: ${mcpCoreProps.FINGERPRINT?.substring(0, 8) || 'unknown'}...`);
  console.log(`   Binding Gen: ${bindingGenProps.FINGERPRINT?.substring(0, 8) || 'unknown'}...`);
}

main();