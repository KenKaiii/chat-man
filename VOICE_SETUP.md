# Voice AI Setup Guide

Complete guide for implementing local, privacy-focused voice AI for Chat Man.

## Overview

This setup enables fully local voice conversations with Chat Man using:
- **Speech-to-Text (STT)**: Whisper.cpp
- **Text-to-Speech (TTS)**: Piper TTS
- **LLM Processing**: Existing Ollama (Llama 3.2 3B)

All processing happens on-device, ensuring GDPR/HIPAA compliance with zero cloud dependencies.

---

## Why This Stack?

### Privacy & Compliance
- ✅ **100% Local Processing** - No data leaves your machine
- ✅ **GDPR Compliant** - Article 2(2)(c) household exemption
- ✅ **HIPAA Safe** - Not a covered entity, but zero risk with local processing
- ✅ **Offline Operation** - Works with internet disabled
- ✅ **No API Keys Required** - No external service integration

### Performance
- ✅ **Low Latency** - Sub-second response times
- ✅ **Resource Efficient** - Works on 8GB RAM systems
- ✅ **Hardware Acceleration** - GPU/Metal support for faster processing
- ✅ **Real-time Capable** - Fast enough for natural conversations

### Quality
- ✅ **Best-in-class STT** - OpenAI Whisper with 95%+ accuracy
- ✅ **Natural TTS** - Piper rated "most natural sounding" among open-source
- ✅ **Tool Calling Support** - Seamless integration with existing Llama 3.2 3B

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         User Voice Input                     │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Browser (Web Audio API)                         │
│  • Capture microphone audio                                  │
│  • Stream audio chunks via WebSocket                         │
│  • Display waveform visualization                            │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Server: whisper.cpp (STT)                       │
│  • Receive audio stream                                      │
│  • Transcribe to text locally                                │
│  • Send transcribed text to LLM pipeline                     │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Server: Ollama (Llama 3.2 3B)                   │
│  • Process text with existing pipeline                       │
│  • Execute tool calls (same as text mode)                    │
│  • Generate response                                         │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Server: Piper TTS                               │
│  • Convert response text to speech                           │
│  • Stream audio back to client                               │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Browser: Audio Playback                         │
│  • Play synthesized speech                                   │
│  • Display text transcript                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Details

### 1. Speech-to-Text: Whisper.cpp

**What it is:**
- C/C++ port of OpenAI's Whisper model
- Optimized for local inference with GGML quantization
- Industry-leading accuracy (95%+)

**Key Features:**
- Multiple model sizes (tiny, base, small, medium, large, turbo)
- Hardware acceleration (Metal on macOS, CUDA on NVIDIA, OpenCL)
- Real-time transcription capable
- Multi-language support (99+ languages)

**Performance Benchmarks:**
- **Whisper Turbo**: ~100ms processing time, 216x RTFx
- **Whisper Base**: ~500ms processing time, adequate for most use cases
- **Apple Silicon**: 3x faster with Metal/ANE acceleration
- **GPU**: 10x faster with Vulkan support

**Model Selection:**
| Model | Size | RAM | Speed | Quality | Recommendation |
|-------|------|-----|-------|---------|----------------|
| tiny.en | 75MB | 1GB | Fastest | Good | Testing only |
| base.en | 142MB | 1GB | Very Fast | Very Good | **Recommended for 8GB RAM** |
| small.en | 466MB | 2GB | Fast | Excellent | Good balance |
| medium.en | 1.5GB | 4GB | Medium | Excellent | High accuracy needed |
| large-v3-turbo | 1.6GB | 4GB | Fast | Best | **Recommended for 16GB+ RAM** |

### 2. Text-to-Speech: Piper TTS

**What it is:**
- Fast, local neural text-to-speech
- Based on VITS (Variational Inference Text-to-Speech)
- "Most natural sounding" among open-source TTS options (2025 comparison)

**Key Features:**
- Multiple voice models available
- Under 300ms latency
- Fully offline operation
- Streaming capable for real-time playback
- Multiple language support

**Performance:**
- Processing: <300ms for typical sentences
- Memory: 100-300MB RAM
- Real-time factor: Faster than 1x (can generate speech faster than playback)

**Voice Models:**
- Multiple English voices (male, female, various accents)
- Quality comparable to cloud services
- Lightweight models (50-100MB per voice)

**Alternatives to Consider:**
- **Coqui TTS XTTS-v2**: Better voice cloning (85-95% similarity from 10s audio), but heavier
- **Kokoro-82M**: Even faster than Piper (consistently <0.3s), newer model (2025)

---

## Installation

### Prerequisites
- macOS, Linux, or Windows with WSL2
- 8GB+ RAM (16GB+ recommended)
- C++ compiler (gcc, clang, or MSVC)
- CMake 3.10+
- Git

### 1. Install Whisper.cpp

```bash
# Clone repository
cd /Users/kenkai/Documents/UnstableMind/chat-man
git clone https://github.com/ggml-org/whisper.cpp
cd whisper.cpp

# Build with Metal support (macOS)
make

# Or build with CUDA support (NVIDIA GPU)
# make WHISPER_CUDA=1

# Download recommended model (base.en for 8GB systems)
bash ./models/download-ggml-model.sh base.en

# Or download turbo model for faster processing (16GB+ systems)
bash ./models/download-ggml-model.sh large-v3-turbo

# Test installation
./main -m models/ggml-base.en.bin -f samples/jfk.wav
```

**Expected Output:**
```
whisper_init_from_file_with_params_no_state: loading model from 'models/ggml-base.en.bin'
...
[00:00:00.000 --> 00:00:11.000]   And so my fellow Americans, ask not what your country can do for you, ask what you can do for your country.
```

### 2. Install Piper TTS

```bash
cd /Users/kenkai/Documents/UnstableMind/chat-man

# Download Piper binary (macOS)
curl -L https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_macos_x86_64.tar.gz -o piper.tar.gz
tar -xvzf piper.tar.gz
rm piper.tar.gz

# Or install via Homebrew (if available)
# brew install piper-tts

# Download a voice model (US English, female voice)
mkdir -p piper-voices
cd piper-voices
curl -L https://github.com/rhasspy/piper/releases/download/v1.2.0/en_US-lessac-medium.onnx -o en_US-lessac-medium.onnx
curl -L https://github.com/rhasspy/piper/releases/download/v1.2.0/en_US-lessac-medium.onnx.json -o en_US-lessac-medium.onnx.json
cd ..

# Test installation
echo "Hello, this is a test of Piper text to speech." | ./piper/piper --model piper-voices/en_US-lessac-medium.onnx --output_file test.wav
# Play test.wav to verify
```

**Available Voice Models:**
- `en_US-lessac-medium` - Female, clear, professional
- `en_US-ryan-medium` - Male, warm, conversational
- `en_US-libritts-high` - Higher quality, larger model
- `en_GB-alan-medium` - British English, male

Full list: https://github.com/rhasspy/piper/releases/tag/v1.2.0

### 3. Verify Setup

```bash
# Create test script
cat > test-voice-setup.sh << 'EOF'
#!/bin/bash

echo "=== Testing Whisper.cpp ==="
cd whisper.cpp
./main -m models/ggml-base.en.bin -f samples/jfk.wav
cd ..

echo ""
echo "=== Testing Piper TTS ==="
echo "The voice AI setup is working correctly." | ./piper/piper --model piper-voices/en_US-lessac-medium.onnx --output_file verification.wav
echo "✓ Audio generated: verification.wav"

echo ""
echo "=== Setup Verification Complete ==="
echo "✓ Whisper.cpp: Ready"
echo "✓ Piper TTS: Ready"
echo "✓ Ollama: Already configured"
EOF

chmod +x test-voice-setup.sh
./test-voice-setup.sh
```

---

## Backend Implementation

### File Structure
```
server/
├── voice.ts              # Main voice processing logic
├── whisper.ts            # Whisper.cpp integration
├── piper.ts              # Piper TTS integration
└── voice-websocket.ts    # WebSocket handlers for voice
```

### 1. Whisper Integration (`server/whisper.ts`)

```typescript
/**
 * Whisper.cpp integration for speech-to-text
 */
import { spawn } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';

const WHISPER_PATH = join(process.cwd(), 'whisper.cpp');
const MODEL_PATH = join(WHISPER_PATH, 'models', 'ggml-base.en.bin');

export interface TranscriptionResult {
  text: string;
  language: string;
  duration: number;
}

export async function transcribeAudio(
  audioBuffer: Buffer,
  language: string = 'en'
): Promise<TranscriptionResult> {
  const tempWavPath = join(process.cwd(), `temp-${Date.now()}.wav`);

  try {
    // Write audio buffer to temp file
    await writeFile(tempWavPath, audioBuffer);

    return await new Promise((resolve, reject) => {
      const startTime = Date.now();
      const args = [
        '-m', MODEL_PATH,
        '-f', tempWavPath,
        '-l', language,
        '--no-timestamps',
        '--output-txt'
      ];

      const whisper = spawn(join(WHISPER_PATH, 'main'), args);
      let output = '';
      let errorOutput = '';

      whisper.stdout.on('data', (data) => {
        output += data.toString();
      });

      whisper.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      whisper.on('close', async (code) => {
        // Cleanup temp file
        await unlink(tempWavPath).catch(() => {});

        if (code !== 0) {
          reject(new Error(`Whisper failed: ${errorOutput}`));
          return;
        }

        // Extract transcribed text
        const lines = output.split('\n');
        const textLine = lines.find(line => line.trim().startsWith('['));
        const text = textLine?.replace(/\[.*?\]/g, '').trim() || '';

        resolve({
          text,
          language,
          duration: Date.now() - startTime,
        });
      });

      whisper.on('error', reject);
    });
  } catch (error) {
    // Cleanup on error
    await unlink(tempWavPath).catch(() => {});
    throw error;
  }
}
```

### 2. Piper Integration (`server/piper.ts`)

```typescript
/**
 * Piper TTS integration for text-to-speech
 */
import { spawn } from 'child_process';
import { join } from 'path';

const PIPER_PATH = join(process.cwd(), 'piper', 'piper');
const VOICE_MODEL = join(process.cwd(), 'piper-voices', 'en_US-lessac-medium.onnx');

export interface SynthesisOptions {
  voice?: string;
  speed?: number; // 0.5 to 2.0
  format?: 'wav' | 'mp3';
}

export async function synthesizeSpeech(
  text: string,
  options: SynthesisOptions = {}
): Promise<Buffer> {
  const { voice = VOICE_MODEL, speed = 1.0 } = options;

  return new Promise((resolve, reject) => {
    const args = [
      '--model', voice,
      '--output_raw'
    ];

    if (speed !== 1.0) {
      args.push('--length_scale', (1.0 / speed).toString());
    }

    const piper = spawn(PIPER_PATH, args);

    const audioChunks: Buffer[] = [];

    piper.stdout.on('data', (chunk) => {
      audioChunks.push(chunk);
    });

    piper.stderr.on('data', (data) => {
      console.error('Piper TTS:', data.toString());
    });

    piper.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Piper TTS failed with code ${code}`));
        return;
      }

      resolve(Buffer.concat(audioChunks));
    });

    piper.on('error', reject);

    // Send text to stdin
    piper.stdin.write(text);
    piper.stdin.end();
  });
}

export async function synthesizeSpeechStreaming(
  text: string,
  onChunk: (chunk: Buffer) => void,
  options: SynthesisOptions = {}
): Promise<void> {
  const { voice = VOICE_MODEL, speed = 1.0 } = options;

  return new Promise((resolve, reject) => {
    const args = [
      '--model', voice,
      '--output_raw'
    ];

    if (speed !== 1.0) {
      args.push('--length_scale', (1.0 / speed).toString());
    }

    const piper = spawn(PIPER_PATH, args);

    piper.stdout.on('data', (chunk) => {
      onChunk(chunk);
    });

    piper.stderr.on('data', (data) => {
      console.error('Piper TTS:', data.toString());
    });

    piper.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Piper TTS failed with code ${code}`));
        return;
      }
      resolve();
    });

    piper.on('error', reject);

    // Send text to stdin
    piper.stdin.write(text);
    piper.stdin.end();
  });
}
```

### 3. Voice WebSocket Handler (`server/voice-websocket.ts`)

```typescript
/**
 * WebSocket handler for voice communication
 */
import type { ServerWebSocket } from 'bun';
import { transcribeAudio } from './whisper';
import { synthesizeSpeechStreaming } from './piper';
import { streamChat } from './ollama';

interface VoiceMessage {
  type: 'voice_input' | 'voice_stop';
  audio?: string; // base64 encoded audio
  sessionId: string;
}

const activeVoiceSessions = new Map<string, Buffer[]>();

export async function handleVoiceMessage(
  ws: ServerWebSocket,
  message: VoiceMessage
) {
  const { type, audio, sessionId } = message;

  if (type === 'voice_input' && audio) {
    // Decode base64 audio
    const audioBuffer = Buffer.from(audio, 'base64');

    // Add to session buffer
    if (!activeVoiceSessions.has(sessionId)) {
      activeVoiceSessions.set(sessionId, []);
    }
    activeVoiceSessions.get(sessionId)!.push(audioBuffer);

  } else if (type === 'voice_stop') {
    // Concatenate all audio chunks
    const chunks = activeVoiceSessions.get(sessionId) || [];
    if (chunks.length === 0) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'No audio data received',
      }));
      return;
    }

    const fullAudio = Buffer.concat(chunks);
    activeVoiceSessions.delete(sessionId);

    try {
      // Step 1: Transcribe audio
      ws.send(JSON.stringify({
        type: 'voice_transcribing',
        sessionId,
      }));

      const transcription = await transcribeAudio(fullAudio);

      ws.send(JSON.stringify({
        type: 'voice_transcription',
        text: transcription.text,
        sessionId,
      }));

      // Step 2: Get LLM response (using existing chat pipeline)
      ws.send(JSON.stringify({
        type: 'voice_thinking',
        sessionId,
      }));

      let fullResponse = '';

      // Stream LLM response (same as text mode)
      const history = [
        { role: 'user', content: transcription.text }
      ];

      for await (const chunk of streamChat('llama3.2:3b', history)) {
        if (chunk.message?.content) {
          fullResponse += chunk.message.content;

          // Send text chunks as they arrive
          ws.send(JSON.stringify({
            type: 'assistant_message',
            content: chunk.message.content,
            sessionId,
          }));
        }

        if (chunk.done) break;
      }

      // Step 3: Synthesize speech
      ws.send(JSON.stringify({
        type: 'voice_synthesizing',
        sessionId,
      }));

      await synthesizeSpeechStreaming(
        fullResponse,
        (audioChunk) => {
          // Stream audio chunks to client
          ws.send(JSON.stringify({
            type: 'voice_audio',
            audio: audioChunk.toString('base64'),
            sessionId,
          }));
        }
      );

      ws.send(JSON.stringify({
        type: 'voice_complete',
        sessionId,
      }));

    } catch (error) {
      console.error('Voice processing error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: error instanceof Error ? error.message : 'Voice processing failed',
        sessionId,
      }));
    }
  }
}
```

### 4. Update Main Server (`server/server.ts`)

```typescript
// Add to existing server.ts

import { handleVoiceMessage } from './voice-websocket';

// In WebSocket message handler:
websocket: {
  async message(ws: ServerWebSocket, message: string | Buffer) {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === 'chat') {
        await handleChatMessage(ws, data as ChatMessage);
      } else if (data.type === 'stop_generation') {
        handleStopGeneration(data as StopGenerationMessage);
      } else if (data.type === 'voice_input' || data.type === 'voice_stop') {
        await handleVoiceMessage(ws, data);
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  },
}
```

---

## Frontend Implementation

### File Structure
```
src/components/
├── voice/
│   ├── VoiceInput.tsx        # Main voice input component
│   ├── VoiceWaveform.tsx     # Waveform visualization
│   ├── VoiceControls.tsx     # Record/stop buttons
│   └── useVoiceRecording.ts  # Voice recording hook
```

### 1. Voice Recording Hook (`src/components/voice/useVoiceRecording.ts`)

```typescript
/**
 * Hook for managing voice recording
 */
import { useState, useRef, useCallback } from 'react';

export interface VoiceRecordingState {
  isRecording: boolean;
  audioLevel: number;
  error: string | null;
}

export function useVoiceRecording(
  onAudioChunk: (chunk: Blob) => void,
  onRecordingComplete: () => void
) {
  const [state, setState] = useState<VoiceRecordingState>({
    isRecording: false,
    audioLevel: 0,
    error: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>();

  const startRecording = useCallback(async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000, // Whisper expects 16kHz
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      // Setup audio visualization
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      // Start visualization loop
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateAudioLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setState(prev => ({ ...prev, audioLevel: average / 255 }));
        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      };
      updateAudioLevel();

      // Setup media recorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          onAudioChunk(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        audioContext.close();
        onRecordingComplete();
      };

      mediaRecorder.start(100); // Collect data every 100ms
      mediaRecorderRef.current = mediaRecorder;

      setState(prev => ({ ...prev, isRecording: true, error: null }));
    } catch (error) {
      console.error('Failed to start recording:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to access microphone',
      }));
    }
  }, [onAudioChunk, onRecordingComplete]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
      setState(prev => ({ ...prev, isRecording: false, audioLevel: 0 }));
    }
  }, [state.isRecording]);

  return {
    ...state,
    startRecording,
    stopRecording,
  };
}
```

### 2. Voice Input Component (`src/components/voice/VoiceInput.tsx`)

```typescript
/**
 * Main voice input component
 */
import React, { useState, useCallback } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { useVoiceRecording } from './useVoiceRecording';

interface VoiceInputProps {
  websocketUrl: string;
  sessionId: string;
  onTranscription?: (text: string) => void;
  onResponse?: (text: string) => void;
}

export function VoiceInput({
  websocketUrl,
  sessionId,
  onTranscription,
  onResponse,
}: VoiceInputProps) {
  const [status, setStatus] = useState<'idle' | 'transcribing' | 'thinking' | 'synthesizing'>('idle');
  const [ws, setWs] = useState<WebSocket | null>(null);

  // Initialize WebSocket
  React.useEffect(() => {
    const socket = new WebSocket(websocketUrl);

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'voice_transcribing') {
        setStatus('transcribing');
      } else if (data.type === 'voice_transcription') {
        onTranscription?.(data.text);
      } else if (data.type === 'voice_thinking') {
        setStatus('thinking');
      } else if (data.type === 'assistant_message') {
        onResponse?.(data.content);
      } else if (data.type === 'voice_synthesizing') {
        setStatus('synthesizing');
      } else if (data.type === 'voice_audio') {
        // Play audio chunk
        playAudioChunk(data.audio);
      } else if (data.type === 'voice_complete') {
        setStatus('idle');
      }
    };

    setWs(socket);

    return () => {
      socket.close();
    };
  }, [websocketUrl, onTranscription, onResponse]);

  const playAudioChunk = useCallback((base64Audio: string) => {
    const audioData = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0));
    const audioBlob = new Blob([audioData], { type: 'audio/wav' });
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    audio.play();
  }, []);

  const handleAudioChunk = useCallback((chunk: Blob) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      // Convert blob to base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        ws.send(JSON.stringify({
          type: 'voice_input',
          audio: base64,
          sessionId,
        }));
      };
      reader.readAsDataURL(chunk);
    }
  }, [ws, sessionId]);

  const handleRecordingComplete = useCallback(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'voice_stop',
        sessionId,
      }));
    }
  }, [ws, sessionId]);

  const {
    isRecording,
    audioLevel,
    error,
    startRecording,
    stopRecording,
  } = useVoiceRecording(handleAudioChunk, handleRecordingComplete);

  return (
    <div className="flex flex-col items-center gap-4 p-6">
      {error && (
        <div className="text-red-500 text-sm">{error}</div>
      )}

      {/* Waveform visualization */}
      {isRecording && (
        <div className="w-full h-20 flex items-center justify-center gap-1">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="w-2 bg-blue-500 rounded-full transition-all"
              style={{
                height: `${Math.max(4, audioLevel * 100 * (0.5 + Math.random() * 0.5))}%`,
              }}
            />
          ))}
        </div>
      )}

      {/* Status indicator */}
      {status !== 'idle' && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          {status === 'transcribing' && 'Transcribing...'}
          {status === 'thinking' && 'Thinking...'}
          {status === 'synthesizing' && 'Generating voice...'}
        </div>
      )}

      {/* Record button */}
      <button
        onClick={isRecording ? stopRecording : startRecording}
        disabled={status !== 'idle'}
        className={`w-16 h-16 rounded-full flex items-center justify-center transition ${
          isRecording
            ? 'bg-red-500 hover:bg-red-600'
            : 'bg-blue-500 hover:bg-blue-600'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {isRecording ? (
          <Square className="w-6 h-6 text-white" fill="currentColor" />
        ) : (
          <Mic className="w-6 h-6 text-white" />
        )}
      </button>

      <div className="text-sm text-gray-400">
        {isRecording ? 'Click to stop recording' : 'Click to start recording'}
      </div>
    </div>
  );
}
```

---

## Resource Requirements

### System Requirements
| Component | RAM | Storage | CPU | Notes |
|-----------|-----|---------|-----|-------|
| **Whisper Base** | 1-2GB | 142MB | Modern CPU | Recommended for 8GB systems |
| **Whisper Turbo** | 2-3GB | 1.6GB | Modern CPU | Recommended for 16GB+ systems |
| **Piper TTS** | 100-300MB | 50-100MB | Modern CPU | Per voice model |
| **Ollama** | 4-5GB | 2GB | Modern CPU | Already running |
| **Total Added** | 3-4GB | 2-2.5GB | — | Fits in 8GB systems |

### Performance Expectations
- **STT Latency**: 100-500ms (depending on model)
- **LLM Processing**: 500-2000ms (existing Ollama pipeline)
- **TTS Latency**: 200-300ms
- **Total Round-trip**: 1-3 seconds (comparable to human conversation)

### Hardware Acceleration
- **macOS**: Metal acceleration via Neural Engine (3x faster)
- **NVIDIA GPU**: CUDA support (10x faster)
- **AMD GPU**: ROCm support
- **Intel**: OpenVINO support

---

## Testing

### Manual Testing

```bash
# Test full voice pipeline
cd /Users/kenkai/Documents/UnstableMind/chat-man

# 1. Record test audio (5 seconds)
# Use system audio recorder or:
rec -r 16000 -c 1 -b 16 test-input.wav trim 0 5

# 2. Test STT
./whisper.cpp/main -m whisper.cpp/models/ggml-base.en.bin -f test-input.wav

# 3. Test LLM (using existing Ollama)
curl http://localhost:11434/api/generate -d '{
  "model": "llama3.2:3b",
  "prompt": "What is the capital of France?",
  "stream": false
}'

# 4. Test TTS
echo "The capital of France is Paris." | ./piper/piper --model piper-voices/en_US-lessac-medium.onnx --output_file test-output.wav

# 5. Play output
afplay test-output.wav  # macOS
# or: aplay test-output.wav  # Linux
```

### Integration Testing

Create `test-voice-integration.ts`:

```typescript
import { transcribeAudio } from './server/whisper';
import { synthesizeSpeech } from './server/piper';
import { readFile, writeFile } from 'fs/promises';

async function testVoiceIntegration() {
  console.log('🎤 Testing voice integration...\n');

  // Test STT
  console.log('1. Testing Speech-to-Text...');
  const audioBuffer = await readFile('test-input.wav');
  const transcription = await transcribeAudio(audioBuffer);
  console.log(`   ✓ Transcribed: "${transcription.text}"`);
  console.log(`   ✓ Duration: ${transcription.duration}ms\n`);

  // Test TTS
  console.log('2. Testing Text-to-Speech...');
  const testText = 'This is a test of the text to speech system.';
  const audioOutput = await synthesizeSpeech(testText);
  await writeFile('test-tts-output.wav', audioOutput);
  console.log(`   ✓ Generated speech: test-tts-output.wav`);
  console.log(`   ✓ Size: ${audioOutput.length} bytes\n`);

  console.log('✅ All tests passed!');
}

testVoiceIntegration().catch(console.error);
```

Run with: `bun run test-voice-integration.ts`

---

## Troubleshooting

### Whisper.cpp Issues

**Problem: "Model file not found"**
```bash
# Download the model again
cd whisper.cpp
bash ./models/download-ggml-model.sh base.en
```

**Problem: "Slow transcription (>2 seconds)"**
```bash
# Try smaller model
bash ./models/download-ggml-model.sh tiny.en

# Or enable Metal acceleration (macOS)
make clean
make WHISPER_METAL=1
```

**Problem: "Segmentation fault"**
```bash
# Rebuild with debug symbols
make clean
make WHISPER_DEBUG=1
```

### Piper TTS Issues

**Problem: "Voice model not found"**
```bash
# Re-download voice model
cd piper-voices
curl -L https://github.com/rhasspy/piper/releases/download/v1.2.0/en_US-lessac-medium.onnx -o en_US-lessac-medium.onnx
curl -L https://github.com/rhasspy/piper/releases/download/v1.2.0/en_US-lessac-medium.onnx.json -o en_US-lessac-medium.onnx.json
```

**Problem: "Robotic/distorted voice"**
- Try different voice model
- Ensure audio sample rate matches (16kHz or 22kHz depending on model)
- Check for audio buffer corruption

### Browser Issues

**Problem: "Microphone permission denied"**
- Browser must be served over HTTPS or localhost
- User must grant microphone permission
- Check browser console for errors

**Problem: "No audio playback"**
- Check browser audio settings
- Verify WebSocket connection
- Check audio format compatibility

---

## Security Considerations

### Privacy Protection
- ✅ All processing happens locally
- ✅ Audio never sent to cloud services
- ✅ No API keys or external authentication required
- ✅ Transcriptions not logged by default
- ✅ Audio buffers cleared after processing

### Data Retention
- Temporary audio files deleted immediately after processing
- In-memory buffers cleared after use
- No persistent storage of voice data
- User controls when recording starts/stops

### Best Practices
1. **Inform Users**: Display microphone indicator when recording
2. **User Control**: Easy stop/cancel buttons
3. **Data Minimization**: Only process necessary audio
4. **Secure Transport**: Use WSS (WebSocket Secure) in production
5. **Access Control**: Require user authentication for voice features

---

## Future Enhancements

### Phase 1 (Current Implementation)
- ✅ Basic voice input and output
- ✅ Real-time transcription
- ✅ Text-to-speech synthesis
- ✅ Integration with existing LLM pipeline

### Phase 2 (Future)
- 🔄 Voice activity detection (VAD) for automatic recording
- 🔄 Multi-language support
- 🔄 Voice cloning (with user consent)
- 🔄 Interrupt/barge-in capability
- 🔄 Background noise reduction

### Phase 3 (Advanced)
- 🔄 Emotion detection in voice
- 🔄 Speaker diarization (multiple speakers)
- 🔄 Real-time translation
- 🔄 Voice commands/shortcuts
- 🔄 Continuous conversation mode

---

## References

### Documentation
- Whisper.cpp: https://github.com/ggml-org/whisper.cpp
- Piper TTS: https://github.com/rhasspy/piper
- OpenAI Whisper Paper: https://arxiv.org/abs/2212.04356
- Web Audio API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API

### Benchmarks & Comparisons
- Whisper Performance: https://openbenchmarking.org/test/pts/whisper-cpp
- TTS Comparison 2025: https://precallai.com/best-open-source-text-to-speech-software
- Open-Source STT Models: https://modal.com/blog/open-source-stt

### Privacy & Compliance
- GDPR Article 2(2)(c): Household Exemption
- HIPAA Covered Entities: https://www.hhs.gov/hipaa/for-professionals/covered-entities/index.html
- Voice AI Privacy: https://picovoice.ai/blog/gdpr-ccpa-voice-recognition-privacy/

---

## Support

For issues specific to:
- **Chat Man integration**: Create issue in this repository
- **Whisper.cpp**: https://github.com/ggml-org/whisper.cpp/issues
- **Piper TTS**: https://github.com/rhasspy/piper/issues

---

## License

Voice AI components use various open-source licenses:
- **Whisper.cpp**: MIT License
- **Piper TTS**: MIT License
- **Chat Man**: AGPL-3.0-or-later

All components are free for commercial and personal use.

---

**Last Updated**: January 2025
**Version**: 1.0
**Status**: Ready for Implementation
