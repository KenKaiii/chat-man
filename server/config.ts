/**
 * Chat Man - Configuration Loader
 * Loads system prompt, knowledge base, and settings from config files
 */

import { readFile } from 'fs/promises';
import { join } from 'path';

const CONFIG_DIR = join(process.cwd(), 'config');

export interface ModelConfig {
  name: string;
  temperature: number;
  top_p: number;
  top_k: number;
  max_tokens: number;
}

export interface SystemConfig {
  enableKnowledgeBase: boolean;
  enableSystemPrompt: boolean;
  streamingEnabled: boolean;
}

export interface UIConfig {
  appName: string;
  welcomeMessage: string;
  placeholder: string;
  theme: string;
}

export interface Settings {
  model: ModelConfig;
  system: SystemConfig;
  ui: UIConfig;
}

/**
 * Load system prompt from file
 */
export async function loadSystemPrompt(): Promise<string> {
  try {
    const path = join(CONFIG_DIR, 'system-prompt.txt');
    return await readFile(path, 'utf-8');
  } catch (error) {
    console.warn('⚠️  Could not load system-prompt.txt, using default');
    return 'You are a helpful AI assistant.';
  }
}

/**
 * Load knowledge base from file
 */
export async function loadKnowledge(): Promise<string> {
  try {
    const path = join(CONFIG_DIR, 'knowledge.md');
    return await readFile(path, 'utf-8');
  } catch (error) {
    console.warn('⚠️  Could not load knowledge.md, skipping');
    return '';
  }
}

/**
 * Load settings from JSON file
 */
export async function loadSettings(): Promise<Settings> {
  try {
    const path = join(CONFIG_DIR, 'settings.json');
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.warn('⚠️  Could not load settings.json, using defaults');
    return {
      model: {
        name: 'llama3.2:3b',
        temperature: 0.7,
        top_p: 0.9,
        top_k: 40,
        max_tokens: 2048,
      },
      system: {
        enableKnowledgeBase: true,
        enableSystemPrompt: true,
        streamingEnabled: true,
      },
      ui: {
        appName: 'Chat Man',
        welcomeMessage: 'Welcome! How can I help you today?',
        placeholder: 'Type a message...',
        theme: 'dark',
      },
    };
  }
}

/**
 * Build complete system context (system prompt + knowledge)
 */
export async function buildSystemContext(): Promise<string> {
  const settings = await loadSettings();
  const parts: string[] = [];

  // Add system prompt if enabled
  if (settings.system.enableSystemPrompt) {
    const systemPrompt = await loadSystemPrompt();
    if (systemPrompt) {
      parts.push(systemPrompt);
    }
  }

  // Add knowledge base if enabled
  if (settings.system.enableKnowledgeBase) {
    const knowledge = await loadKnowledge();
    if (knowledge && knowledge.trim().length > 0) {
      parts.push('\n\n---\n\n# Knowledge Base\n\n' + knowledge);
    }
  }

  return parts.join('\n').trim();
}

/**
 * Get model configuration with overrides
 */
export async function getModelConfig(): Promise<ModelConfig> {
  const settings = await loadSettings();
  return settings.model;
}

/**
 * Reload configuration (useful for hot-reloading)
 */
export async function reloadConfig() {
  console.log('🔄 Reloading configuration...');
  const systemContext = await buildSystemContext();
  const settings = await loadSettings();
  console.log('✅ Configuration reloaded');
  return { systemContext, settings };
}
