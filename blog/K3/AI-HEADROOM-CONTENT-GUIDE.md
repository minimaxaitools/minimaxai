# Headroom Motion & Presets Content Automation Guide

This guide explains how to automatically trigger the **Headroom motion presets, supplements, and physical paper/ink animations** when loading content into your app and Studio, especially when generating content from an AI (ChatGPT, Claude, Gemini, or a local LLM).

---

## 1. The 3 Levels of Automation (From Zero-Touch to Full Control)

The engine resolves motion hierarchically. You can choose how much control you want:

```
Level 1: 100% Automatic (Auto-Director) ──► Raw plain text matches regex rules (English & Hindi)
Level 2: Semantic Inline Tags           ──► AI wraps key words: [Babur](pin) or [Noise](compress)
Level 3: Explicit Beat / Scene Recipes   ──► JSON beat specifies "recipe": "breathe" or "theme": "headroomPaper"
```

---

### Level 1: 100% Zero-Touch Automation (Auto-Director)
When an author or AI provides **plain text with zero tags**, the engine's `auto.recipeRules` in `headroom-motion.json` inspects the text and automatically selects Headroom recipes:

| Plain Text Keywords (English) | Plain Text Keywords (Hindi) | Automatically Triggered Recipe | Resulting Animation |
|---|---|---|---|
| *breathe, room to breathe, headroom, expand, relief* | *साँस, राहत, विस्तार, शांति* | `breathe` | Ceiling lifts upward with harmonic resonance ($\text{ceilY}$), spacious vertical tracking, inked iris transition |
| *compress, squeeze, condense, cut the noise, reduce* | *दबाव, संक्षिप्त, छोटा करना, कम करना* | `compress` | Words squash horizontally under weight, snap into justified paper cut-out lockup |
| *organize, archive, cabinet, folder, filed, catalog* | *व्यवस्थित, फ़ाइल, संग्रह, दस्तावेज़* | `organize` | 3D filing drawer slides forward toward camera with index folder tab |
| *declutter, clean up, whirlwind, filter, distill* | *सफाई, छांटना, स्पष्टता, फ़िल्टर* | `declutter` | Scattered cards spiral inward along logarithmic vortex into center lockup |
| *token, tokens, burn rate, budget, capacity, quota* | *टोकन, बजट, क्षमता, कोटा* | `tokenEconomy` | Segmented token fuel gauge appears with illuminated level bars |
| *pinned, reminder, notice, taped, post-it* | *पिन, याद रखें, सूचना, नोट* | `pinnedNote` | Card drops and swings freely on top brass split-pin with washi tape |
| *hit the limit, crash, bonk, impact, collision* | *टकराना, सीमा, अचानक, झटका* | `impact` | Sudden downward bonk squash on headline with exponential camera rumble decay |
| *inspect, original, retrieve, examine* | *निरीक्षण, मूल प्रति, जांच* | `inspection` | Archive document pulled from drawer with handwritten citation post-it |

---

### Level 2: Semantic Tag Aliases for AI Content
When an AI generates educational scripts, have the AI wrap key words in **semantic tags**. You never need to remember low-level rendering parameters:

| Semantic Tag | Example in Script | Physical Headroom Visual Effect |
|---|---|---|
| `(pin)` | `[Key Rule](pin)` | Drops card with physical **brass split-pin fastener** and pendulum angular twitch |
| `(tape)` | `[Important](tape)` | Lays down semi-translucent **washi tape strip** with torn jagged edges |
| `(tab)` | `[Chapter 1](tab)` | Pops up an **index folder divider tab** above the card headline |
| `(meter)` | `[4,500](meter)` | Triggers **counter tick-up** inside a vertical segmented token fuel gauge |
| `(bonk)` | `[System Limit](bonk)` | Applies physical **downward squish and spring rebound** on the word |
| `(wash)` | `[Handcrafted](wash)` | Applies **watercolour wash backing** with perimeter pigment pooling |
| `(folder)` | `[Archive](folder)` | Drawer inspection nudge with drop shadow lift |
| `(compress)` | `[Noise](compress)` | Tight horizontal squeeze compression rebound |
| `(headroom)` | `[Room to breathe](headroom)` | Harmonic ceiling elevation with paper crease flutter |
| `(breathe)` | `[Clarity](breathe)` | Spacious upward ascension with soft letter tracking |

---

### Level 3: Scene Themes & Beat Recipes
To make an entire video or scene adopt the Headroom style, set the theme on the scene or beat:

```json
{
  "theme": "headroomPaper",
  "beats": [
    {
      "recipe": "breathe",
      "text": "Give your prompts [a little more headroom](headroom) to breathe."
    },
    {
      "recipe": "compress",
      "text": "It [squeezes](compress) noisy logs and boilerplate into [clean context](pin)."
    }
  ]
}
```

Available Headroom themes:
- `"theme": "headroomPaper"`: Warm cut-paper pop-up book palette (`#4F9E91` teal, `#ED834E` orange, `#F3E4C4` craft wall, `#B98E5E` kraft paper).
- `"theme": "headroomInk"`: Hand-drawn ink-and-watercolour palette (`#2F7A6E` dark teal, `#C25E2E` terracotta, `#F7F1E3` parchment, `#EBCC6E` yellow wash).

---

## 2. Copy-Paste AI Prompt for Generating Content

Give this prompt to **ChatGPT, Claude, Gemini, or any LLM** whenever you want it to write video content for your app:

```markdown
You are a motion design scriptwriter for a Kinetic Typography Explainer Engine.

Your task: Write an engaging, educational video script formatted as JSON for the Kinetic Engine.
The script must leverage the "headroom-motion" and "advance-motion-pro" preset libraries.

Guidelines:
1. Break content into scenes (10-25 seconds each) and beats (short 1-2 sentence fragments).
2. Assign a semantic recipe to each beat from:
   - "breathe" (expansion, relief, spacious conclusions)
   - "compress" (noise reduction, summaries, tightening)
   - "organize" (filing, data cataloging, structured steps)
   - "declutter" (whirlwind cleanup, focusing scattered ideas)
   - "tokenEconomy" (numbers, metrics, budgets, capacity)
   - "pinnedNote" (rules, notices, pinned advice)
   - "impact" (warnings, sudden limits, high-energy conclusions)
   - "definition" (formal explanations, academic terms)
   - "historicalEvent" (dates, battles, milestones)
   - "question" (inquiries to audience)
3. Enhance key words with semantic inline tags:
   - [term](pin) -> Brass split-pin fastener with pendulum settle
   - [phrase](tape) -> Washi paper tape strip
   - [category](tab) -> Filing folder tab
   - [number](meter) -> Animated token fuel gauge
   - [warning](bonk) -> Physical squish & rebound bonk
   - [handwritten](wash) -> Watercolor wash with pigment pooling
   - [highlight](headroom) -> Harmonic ceiling expansion
4. For Hindi content, write natural Devanagari; words will be animated cleanly per-word.
5. Return valid JSON only with this structure:

{
  "theme": "headroomPaper",
  "scenes": [
    {
      "title": "Scene 1: The Problem",
      "recipe": "breathe",
      "beats": [
        { "recipe": "question", "text": "Are your prompts drowning in [unnecessary noise](bonk)?" },
        { "recipe": "compress", "text": "Headroom [squeezes](compress) logs and JSON into [clean context](pin)." }
      ]
    }
  ]
}
```

---

## 3. Ready-to-Load Worked Content Script

Save this as a content JSON file and load it directly into your app or Studio:

```json
{
  "title": "Headroom Motion Showcase",
  "theme": "headroomPaper",
  "scenes": [
    {
      "title": "Introduction",
      "background": "headroomWorkshop",
      "transition": "pageTurnSlices",
      "beats": [
        {
          "recipe": "breathe",
          "text": "Give your creative thinking [a little more headroom](headroom) to breathe."
        },
        {
          "recipe": "question",
          "text": "Why struggle with [cluttered logs](bonk) when you can have [instant clarity](wash)?"
        }
      ]
    },
    {
      "title": "The Compression Engine",
      "background": "headroomMinimal",
      "transition": "cabinetSlide",
      "beats": [
        {
          "recipe": "declutter",
          "text": "Watch the [whirlwind](declutter) pull scattered fragments into [tight alignment](pin)."
        },
        {
          "recipe": "organize",
          "text": "Every source document is [safely filed](folder) in the background archive."
        },
        {
          "recipe": "tokenEconomy",
          "text": "Saving over [68%](meter) of token capacity on every execution."
        }
      ]
    },
    {
      "title": "Bilingual & UPSC Demo",
      "background": "headroomWorkshop",
      "transition": "headroomIris",
      "beats": [
        {
          "recipe": "pinnedNote",
          "text": "[Critical Rule](pin): Focus on the [essence](tape), not the noise."
        },
        {
          "recipe": "breathe",
          "text": "अपनी सोच को दें [खुला आसमान](headroom) और [सटीक दिशा](breathe)।"
        }
      ]
    }
  ]
}
```

---

## 4. How the App Integrates this Automatically at Runtime

1. **In `index.html` / `Index.html`**:
   Ensure `headroom-plugin.js` is loaded:
   ```html
   <script src="engine.js"></script>
   <script src="headroom-plugin.js"></script>
   ```
2. **In Studio Preset Manager**:
   - The presets file `presets/headroom-motion.json` is ready in the `presets/` folder.
   - When loading content via the **Content** tab or through `kinetic-bridge.js`, the engine automatically cross-resolves all Headroom recipes, supplements, and easings seamlessly.
