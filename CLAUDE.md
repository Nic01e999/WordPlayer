# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

English Dictation Tool - a web-based English learning application with two modes:
- **Dictation Mode**: Listen to words and type them (spelling practice)
- **Repeater Mode**: Auto-play words with translations for vocabulary review

## Running the Application

```bash
# Start the Flask backend server (runs on port 5001)
python server.py
```

Access at `http://127.0.0.1:5001` or via LAN IP shown in console.

**Requirements**: macOS (uses system `say` command for TTS), Flask, flask-cors, deep-translator

## Architecture

### Backend (server.py)
Flask server providing:
- `/api/translate` - English to Chinese translation (MyMemory API)
- `/api/tts` - Text-to-speech using macOS `say` command (offline, returns AIFF audio)
- Static file serving for frontend

### Frontend (ES Modules)

```
js/
├── app.js        # Entry point, initializes modules and exposes to window
├── state.js      # Global state management (currentRepeaterState, preloadCache)
├── api.js        # Backend API calls (translate, TTS URL generation)
├── audio.js      # Audio playback control
├── preload.js    # Background preloading of translations and audio
├── dictation.js  # Dictation mode (Dictation class)
├── repeater.js   # Repeater mode (Repeater class)
└── utils.js      # DOM helpers, settings reader, shuffle algorithm
```

**Key patterns**:
- Circular dependency between Dictation/Repeater resolved via `setDictationRef`/`setRepeaterRef`
- `playId` counter pattern used to cancel async operations when mode changes
- Preload system caches translations and audio Blob URLs on textarea input change

### Word Input Format
Words in textarea support `word:definition` format. If no definition provided, translation API is called.

## CSS Structure

```
css/
├── main.css       # Imports all other CSS files
├── base.css       # Base styles
├── menu.css       # Header and sidebar
├── dictation.css  # Dictation mode popup
├── repeater.css   # Repeater mode scroll view
├── components.css # Shared components
└── responsive.css # Mobile breakpoints
```
