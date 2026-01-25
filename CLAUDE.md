# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

English Dictation Tool - a web-based English learning application with two modes:
- **Dictation Mode**: Listen to words and type them (spelling practice)
- **Repeater Mode**: Auto-play words with translations for vocabulary review

## Running the Application

```bash
python3 run.py
```

Access at `http://127.0.0.1:5001` or via LAN IP shown in console.

**Requirements**: macOS, Flask, flask-cors, requests

## Architecture

### Backend (server/)

```
server/
├── app.py        # Flask entry, static files, _get_lan_ip()
├── deepseek.py   # DeepSeek API for word info, _validate_word()
├── tts.py        # Youdao TTS API (US/UK accents)
└── cache.py      # Word cache management
```

**API Endpoints:**
- `/api/wordinfo/batch` - Batch word info (translation, definitions, examples, synonyms)
- `/api/tts` - Text-to-speech

### Frontend (ES Modules)

```
js/
├── app.js        # Entry point, exposes to window
├── api.js        # API calls, getTtsUrl()
├── audio.js      # Audio playback
├── state.js      # Global state (currentRepeaterState, preloadCache)
├── preload.js    # Background preloading
├── utils.js      # DOM helpers, settings
├── theme.js      # Theme switching
│
├── wordlist.js   → re-export
├── wordlist/
│   ├── storage.js   # localStorage ops
│   ├── layout.js    # Layout persistence
│   ├── render.js    # Card rendering
│   ├── drag.js      # Drag & drop
│   ├── folder.js    # Folder ops
│   └── index.js     # Module entry
│
├── repeater.js   → re-export
├── repeater/
│   ├── state.js     # Static props
│   ├── keyboard.js  # Keyboard nav
│   ├── slider.js    # Apple-style slider
│   ├── scroll.js    # Scroll control
│   ├── playback.js  # Play logic
│   ├── render.js    # UI render
│   └── index.js     # Repeater class
│
├── dictation.js  → re-export
└── dictation/
    ├── drag.js      # Popup drag
    ├── quiz.js      # Quiz logic
    └── index.js     # Dictation class
```

**Key Patterns:**
- Lazy binding for circular deps (`setRenderDeps`, `setDragDeps`, etc.)
- `playId` counter to cancel async ops on mode change
- Re-export files for backward compatibility

### CSS Structure

```
css/
├── main.css       # Imports (order: colors→base→components→home→menu→repeater→dictation→responsive)
├── colors.css     # CSS variables (theme colors)
├── base.css       # Base styles
├── components.css # Shared components (buttons, status colors)
├── home.css       # Home view (wordlist cards, folders, drag & drop)
├── menu.css       # Header & sidebar
├── repeater.css   # Repeater mode
├── dictation.css  # Dictation mode
└── responsive.css # Mobile breakpoints
```

### Word Input Format

Textarea supports `word:definition` format. Without definition, translation API is called.

## Plan Mode Rules

When the user reports a bug in Plan mode, always end the plan with:
1. **Bug Summary** - Restate the bug in your own words
2. **Fix Approach** - Explain what you plan to change
