/**
 * Chat Man - Modern chat interface with local AI models
 * Copyright (C) 2025 KenKai
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Model Configuration
 *
 * Centralized definitions for all available local Ollama models.
 * Add new models here to make them available in the UI.
 */

export type ProviderType = 'ollama';

export interface ModelConfig {
  id: string;
  name: string;
  description: string;
  apiModelId: string;
  provider: ProviderType;
}

/**
 * Model status including download state
 */
export interface ModelStatus extends ModelConfig {
  downloaded: boolean;
}

/**
 * Available Models
 *
 * Optimized for business conversations, RAG, and document Q&A.
 * Models selected for HIPAA/GDPR/CCPA compliant applications in medical,
 * legal, real estate, and general business use cases.
 */
export const AVAILABLE_MODELS: ModelConfig[] = [
  {
    id: 'llama3.2:3b',
    name: 'Llama 3.2 3B',
    description: 'Fast baseline model for general business conversations (4-6GB RAM)',
    apiModelId: 'llama3.2:3b',
    provider: 'ollama',
  },
  {
    id: 'mistral:7b',
    name: 'Mistral 7B',
    description: 'Excellent for RAG, document Q&A, and customer service (8GB RAM)',
    apiModelId: 'mistral:7b',
    provider: 'ollama',
  },
  {
    id: 'llama3.1:8b',
    name: 'Llama 3.1 8B',
    description: 'Advanced reasoning for complex business queries and conversations (8-10GB RAM)',
    apiModelId: 'llama3.1:8b',
    provider: 'ollama',
  },
  {
    id: 'phi3:3.8b',
    name: 'Phi-3 Mini',
    description: 'Microsoft\'s lightweight model with strong reasoning (4-6GB RAM)',
    apiModelId: 'phi3:3.8b',
    provider: 'ollama',
  },
  {
    id: 'gemma2:9b',
    name: 'Gemma 2 9B',
    description: 'Google\'s modern model with high performance for power users (10-12GB RAM)',
    apiModelId: 'gemma2:9b',
    provider: 'ollama',
  },
];

/**
 * Get model configuration by ID
 */
export function getModelConfig(modelId: string): ModelConfig | undefined {
  return AVAILABLE_MODELS.find(m => m.id === modelId);
}

/**
 * Get the default model
 */
export function getDefaultModel(): ModelConfig {
  return AVAILABLE_MODELS[0];
}
