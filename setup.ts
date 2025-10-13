#!/usr/bin/env bun
/**
 * Chat Man - Automated Setup Script
 * Installs Ollama and downloads recommended model
 */

import { $ } from 'bun';

const RECOMMENDED_MODEL = 'llama3.2:3b';
const OLLAMA_DOWNLOAD_URL = 'https://ollama.ai/download';

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function heading(message: string) {
  console.log();
  log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, colors.cyan);
  log(`  ${message}`, colors.cyan);
  log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, colors.cyan);
  console.log();
}

/**
 * Check if Ollama is installed
 */
async function checkOllamaInstalled(): Promise<boolean> {
  try {
    await $`which ollama`.quiet();
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if Ollama service is running
 */
async function checkOllamaRunning(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Install Ollama
 */
async function installOllama(): Promise<boolean> {
  const platform = process.platform;

  if (platform === 'darwin') {
    log('Installing Ollama via Homebrew...', colors.blue);
    try {
      await $`brew install ollama`;
      log('✅ Ollama installed successfully!', colors.green);
      return true;
    } catch (_error) {
      log('❌ Failed to install via Homebrew', colors.red);
      log(`Please install manually from: ${OLLAMA_DOWNLOAD_URL}`, colors.yellow);
      return false;
    }
  } else if (platform === 'linux') {
    log('Installing Ollama via curl...', colors.blue);
    try {
      await $`curl -fsSL https://ollama.ai/install.sh | sh`;
      log('✅ Ollama installed successfully!', colors.green);
      return true;
    } catch (_error) {
      log('❌ Failed to install Ollama', colors.red);
      log(`Please install manually from: ${OLLAMA_DOWNLOAD_URL}`, colors.yellow);
      return false;
    }
  } else {
    log('❌ Windows detected - please install Ollama manually', colors.red);
    log(`Download from: ${OLLAMA_DOWNLOAD_URL}`, colors.yellow);
    return false;
  }
}

/**
 * Start Ollama service
 */
async function startOllama(): Promise<boolean> {
  log('Starting Ollama service...', colors.blue);

  // Try to start as background process
  try {
    // Check if already running
    if (await checkOllamaRunning()) {
      log('✅ Ollama is already running', colors.green);
      return true;
    }

    // Start Ollama in background
    Bun.spawn(['ollama', 'serve'], {
      stdout: 'ignore',
      stderr: 'ignore',
    });

    // Wait for service to start
    let attempts = 0;
    while (attempts < 10) {
      await Bun.sleep(1000);
      if (await checkOllamaRunning()) {
        log('✅ Ollama service started', colors.green);
        return true;
      }
      attempts++;
    }

    log('⚠️  Ollama may not have started correctly', colors.yellow);
    log('You can start it manually with: ollama serve', colors.yellow);
    return false;
  } catch (_error) {
    log('⚠️  Could not start Ollama automatically', colors.yellow);
    log('Please run in a separate terminal: ollama serve', colors.yellow);
    return false;
  }
}

/**
 * Check if model is already downloaded
 */
async function checkModelExists(modelName: string): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    if (!response.ok) return false;

    interface ModelData {
      models: Array<{ name: string }>;
    }

    const data = await response.json() as ModelData;
    return data.models.some((m) => m.name.includes(modelName));
  } catch {
    return false;
  }
}

/**
 * Pull Ollama model
 */
async function pullModel(modelName: string): Promise<boolean> {
  // Check if already exists
  if (await checkModelExists(modelName)) {
    log(`✅ Model ${modelName} is already downloaded`, colors.green);
    return true;
  }

  log(`Downloading model: ${modelName}`, colors.blue);
  log('This may take a few minutes (model size: ~2GB)...', colors.yellow);

  try {
    // Use ollama pull command
    await $`ollama pull ${modelName}`;
    log(`✅ Model ${modelName} downloaded successfully!`, colors.green);
    return true;
  } catch (_error) {
    log(`❌ Failed to download model: ${modelName}`, colors.red);
    return false;
  }
}

/**
 * Main setup function
 */
async function main() {
  heading('🚀 Chat Man Setup');

  log('This script will set up your local LLM environment:', colors.blue);
  log('  1. Install Ollama (if needed)', colors.blue);
  log('  2. Start Ollama service', colors.blue);
  log(`  3. Download recommended model: ${RECOMMENDED_MODEL}`, colors.blue);
  console.log();

  // Step 1: Check Ollama installation
  heading('📦 Step 1: Check Ollama');

  const isInstalled = await checkOllamaInstalled();

  if (isInstalled) {
    log('✅ Ollama is already installed', colors.green);
  } else {
    log('⚠️  Ollama is not installed', colors.yellow);

    // Ask user if they want to install
    const shouldInstall = prompt('Would you like to install Ollama now? (y/n): ');

    if (shouldInstall?.toLowerCase() === 'y') {
      const installed = await installOllama();
      if (!installed) {
        log('Setup aborted. Please install Ollama manually and run setup again.', colors.red);
        process.exit(1);
      }
    } else {
      log('Setup aborted. Please install Ollama manually from:', colors.yellow);
      log(OLLAMA_DOWNLOAD_URL, colors.cyan);
      process.exit(0);
    }
  }

  // Step 2: Start Ollama
  heading('🔌 Step 2: Start Ollama Service');

  const isRunning = await checkOllamaRunning();

  if (!isRunning) {
    await startOllama();

    // Give it time to fully start
    await Bun.sleep(2000);

    // Check again
    if (!(await checkOllamaRunning())) {
      log('⚠️  Please start Ollama manually:', colors.yellow);
      log('  Run in a separate terminal: ollama serve', colors.yellow);
      log('  Then run setup again: bun run setup', colors.yellow);
      process.exit(1);
    }
  } else {
    log('✅ Ollama service is running', colors.green);
  }

  // Step 3: Download model
  heading('🤖 Step 3: Download AI Model');

  const modelDownloaded = await pullModel(RECOMMENDED_MODEL);

  if (!modelDownloaded) {
    log('⚠️  Model download failed. You can try manually:', colors.yellow);
    log(`  ollama pull ${RECOMMENDED_MODEL}`, colors.cyan);
    process.exit(1);
  }

  // Success!
  heading('✅ Setup Complete!');

  log('Your local LLM environment is ready to use!', colors.green);
  console.log();
  log('Next steps:', colors.blue);
  log('  1. Start the server: bun run dev:full', colors.cyan);
  log('  2. Open browser: http://localhost:5173', colors.cyan);
  console.log();
  log('Model Information:', colors.blue);
  log(`  • Name: ${RECOMMENDED_MODEL}`, colors.cyan);
  log('  • RAM Required: ~4-5GB', colors.cyan);
  log('  • Features: Tool calling, RAG, fast inference', colors.cyan);
  console.log();
  log('Need a different model? See: ollama.com/library', colors.yellow);
  console.log();
}

// Run setup
main().catch((error) => {
  console.error('Setup failed:', error);
  process.exit(1);
});
