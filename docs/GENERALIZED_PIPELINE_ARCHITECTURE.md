# Automated Generalized Product Demo Video Pipeline
## Architectural Blueprint & System Specification

This document defines the production-grade architecture and implementation blueprint for an automated, generalized pipeline that accepts any target URL (localhost, staging environments, auth-walled SaaS, or public landing pages) and produces an end-to-end, high-converting product demo video with zero human intervention.

---

## 1. System Architecture Overview

The system is decoupled into an **Asynchronous Control Plane** (FastAPI, Redis Job Queue, WebSocket Broadcaster) and a **Distributed Media Execution Plane** (Playwright Session Workers, LLM Intent Engine, Audio Synthesizer, and Remotion/FFmpeg Render Nodes).

### 1.1 Architecture Diagram

```
                       +-----------------------------------+
                       |    CLIENT (Web UI / API / CLI)    |
                       +-----------------+-----------------+
                                         | POST /api/v1/demos
                                         | WS   /api/v1/demos/{id}/ws
                                         v
                 +-----------------------------------------------+
                 |              FASTAPI GATEWAY                  |
                 |  - URL Authorization & SSRF Filtering         |
                 |  - Session Auth & State DB (Postgres/SQLite)  |
                 |  - WebSocket Progress Dispatcher              |
                 +-----------------------+-----------------------+
                                         | Enqueue Job Payload
                                         v
                         +-------------------------------+
                         |   REDIS QUEUE / EVENT BROKER  |
                         +---------------+---------------+
                                         |
               +-------------------------+-------------------------+
               |                                                   |
               v                                                   v
+-----------------------------+                     +-----------------------------+
|    PIPELINE WORKER #1       |                     |    PIPELINE WORKER #N       |
|  (Celery / BullMQ Worker)   |                     |  (Horizontally Scaled Pod)  |
+--------------+--------------+                     +--------------+--------------+
               |                                                   |
               +===================================================+
                                         |
                                         v
========================================================================================
                                 5-STAGE PIPELINE
========================================================================================

[ STAGE 1: INTENT & SCRIPTING ]
   Target URL
       |
       +--> [ Headless Inspector (Playwright) ] --> Extract Accessibility Tree, Landmarks, CTAs
       |
       +--> [ LLM Director (GPT-4o/Claude 3.5) ] --> Structured Output: Script, Scenes, Voiceover

[ STAGE 2: SESSION & INTERACTION CAPTURE ]
   Script Spec
       |
       +--> [ Session Orchestrator ] --> Inject Auth Cookies / LocalStorage / Responsive Viewport
       |
       +--> [ Humanized Interaction Engine ] --> Cubic Bezier Cursor, Paced Scroll, Form Typing
       |
       +--> [ Virtual Frame Buffer (Xvfb + GPU) ] --> High-FPS Lossless Raw Capture (.mp4/.raw)

[ STAGE 3: AUDIO SYNTHESIS & ALIGNMENT ]
   Voiceover Script
       |
       +--> [ TTS Engine (Kokoro / ElevenLabs) ] --> Clean Narration Audio (.wav)
       |
       +--> [ Forced Aligner (Whisper/MFA) ] ------> Word-Level JSON Timestamps

[ STAGE 4: DYNAMIC MOTION & STYLING ]
   Raw Footage + Timestamps
       |
       +--> [ Camera Motion Director ] ------------> Spring-Physics Zooms & Pans (active clicks)
       |
       +--> [ Kinetic Overlay Generator ] ---------> Subtitles, Device Frames, Action Badges

[ STAGE 5: RENDERING & MULTI-FORMAT EXPORT ]
   Compositor Input
       |
       +--> [ Remotion / FFmpeg Compositor ] ------> Audio Ducking (Narration vs Background Score)
       |                                             16:9 Landscape (YouTube, Web)
       |                                             9:16 Vertical (Reels, TikTok, Shorts)
       |                                             Lightweight Animated GIF Preview
       v
+---------------------------------------------------------------------------------------+
| S3 / MinIO Storage Object Bucket  <-- [ Artifacts, Source Hashes, MP4s, Metadata ]    |
+---------------------------------------------------------------------------------------+
                                         |
                                         +--> Public CDN / Presigned Download URLs
```

---

## 2. Recommended Tech Stack & Library Evaluation

| Layer | Recommended Choice | Primary Alternatives | Rationale & Tradeoffs |
|---|---|---|---|
| **API & Gateway** | **FastAPI (Python 3.11+)** | Node.js (NestJS), Go (Fiber) | Native Pydantic v2 validation contracts; high concurrency; unified with Python AI/ML ecosystem; WebSocket support out of the box. |
| **Job Queue & Broker** | **Redis + Celery / ARQ** | BullMQ (Node), RabbitMQ | Battle-tested task distribution, atomic locks, priority queues, and simple status persistence. ARQ provides lightweight native async Python execution. |
| **Browser Automation** | **Playwright (Chromium)** | Puppeteer, Selenium | Superior CDP interception, native support for multi-page storage states (cookies/tokens), CSS/text/role locators, and virtual screen emulation. |
| **Interaction Synthesis** | **Custom Bezier Engine (`pyautogui`/CDP Input)** | Ghost-Cursor (Node) | Generates natural velocity profiles ($F(t) = \text{Bezier}(P_0, P_1, P_2, P_3)$) with micro-jitter to prevent mechanical linear cursor paths. |
| **Audio & TTS Engine** | **Kokoro-82M / ElevenLabs API / Edge-TTS** | Coqui XTTS-v2, OpenAI TTS | Kokoro provides fast, high-quality open-source local inference; ElevenLabs provides state-of-the-art SaaS voice fidelity; Edge-TTS offers zero-cost rapid prototyping. |
| **Forced Word Alignment**| **faster-whisper (CTranslate2)** | Gentle, Montreal Forced Aligner | Extracts exact millisecond timestamps for each spoken word from the synthesized audio to drive synchronized kinetic captions. |
| **Video Compositing** | **Remotion (React/TypeScript)** | FFmpeg (Pure CLI), MoviePy | Declarative React rendering; spring physics (`spring()`, `interpolate()`); CSS transforms for Mac frames; frame-accurate timeline; multi-format outputs. |
| **Capture Framebuffer** | **Xvfb + FFmpeg NVENC (Linux)** | Direct CDP Screencast | In containerized Linux environments, Xvfb provides an unconstrained virtual display with hardware GPU encoding directly to H.264/HEVC. |
| **Object Storage** | **MinIO (Local) / Amazon S3 (Prod)**| Google Cloud Storage, Cloudflare R2 | S3-compatible API across both local development and cloud multi-tenant deployment; presigned URL generation. |

---

## 3. Comprehensive 5-Stage Pipeline Specification

### Stage 1: Discovery & Scripting (Intent Engine)
- **Crawler**: Headless Playwright crawls the target URL, extracts DOM hierarchy, headings, input forms, and primary buttons.
- **LLM Director**: Accepts sanitized DOM landmarks, user goals, and audience profile; outputs structured `DemoScriptSpec` with timestamped scenes, voiceover copy, and camera targets.

### Stage 2: Screen Capture & Interaction Automation
- **Session Orchestrator**: Injects authentication cookies/tokens, configures viewports (1080p, 4K, 9:16), sets up user mock state.
- **Synthesized Interactions**: Executes cubic Bezier mouse paths with realistic human jitter, natural scroll deceleration, and form typing simulation.
- **High-FPS Capture**: Streams frames directly from Xvfb/GPU or CDP screencast into lossless intermediate video.

### Stage 3: Audio Synthesis & Word-Level Timestamp Alignment
- **TTS Synthesis**: Synthesizes narration audio from the voiceover script using high-fidelity TTS (Kokoro/ElevenLabs).
- **Forced Alignment**: Uses faster-whisper to compute exact start/end timestamps for each spoken word, enabling frame-accurate kinetic subtitles.

### Stage 4: Post-Processing & Visual Polish
- **Dynamic Motion & Framing**: Bounded auto-zoom (1.12x - 1.25x) with spring physics centering on active clicks.
- **Visual Overlays**: macOS window chrome, kinetic captions with active word glow, callout step badges, and animated progress track.

### Stage 5: Rendering & Multi-Format Export Engine
- **Remotion Compositor**: Renders the complete React composition with GPU acceleration.
- **Audio Ducking**: Merges voiceover and background score, automatically ducking music by -14dB during speech.
- **Multi-Format Presets**: Outputs 16:9 Landscape MP4, 9:16 Vertical MP4, and animated preview GIF.
