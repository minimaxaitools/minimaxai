# Kinetic Motion Engine

A data-driven kinetic typography engine for D3 Annotation Studio. You swap the **content JSON** (or just use your existing annotation projects) and get a new whimsical, paper-craft explainer video: every sentence is broken into words and letters, each fragment gets its own 3D camera angle, and underlines, highlights, arrows, counters, icons and badges are generated alongside the text.

Nothing about topic, colour, font or timing lives in `engine.js`. It all comes from `presets.motion.json`, a theme, and your content.

---

## Files

| File | What it is |
| --- | --- |
| `engine.js` | Runtime: easing (bezier, spring, elastic, bounce, anticipate, steps), keyframe tracks, sentence fragmentation, layout solver, 3D camera rig, paper renderer, supplementary layers, transitions, player, frame-accurate export, adapters for your existing formats. |
| `presets.motion.json` | The motion library: easings, entry / emphasis / exit / loop presets, camera moves, 3D staging, layouts, supplements, transitions, backgrounds, themes, tag aliases, icon paths, and the mapping from your `typeKey`s to kinetic behaviour. Every preset has an `intent` line. |
| `content.schema.json` | JSON Schema for content. Accepts native scenes **and** your existing project saves, d3 JSON, pattern results and plain text. |
| `content.sample.json` | A complete example (topic: how a paper plane flies) that uses every schema feature. Look for `_demo` notes. |
| `index.html`, `studio.css`, `studio.js` | Kinetic Studio: play, pause, scrub, loop, frame-step, seek-to-scene, speed, preset browser with Try buttons, warnings list, and export. |
| `kinetic-bridge.js` | Adds a **🎬 Kinetic Motion** panel to your existing `Index.html`. |
| `geo.js` + `geo/` | Map plug-in: world and India-state maps (amCharts 5 geodata), 257 countries with names in English, Hindi and 10 more languages, 1,600+ cities (GeoNames). Upload your own GeoJSON or places. |
| `media.js` + `assets/` | Pictures, emoji stickers and **SVG vector animation** (draw-on, sketch-then-colour, pop, build, assemble, per-part loops). Missing pictures become labelled placeholders. |
| `charts.js` | Paper-craft infographics: bar, column, donut, pie, progress, pictogram, stat, compare, line, timeline. |
| `director.js` | Auto-Director: turns plain text into maps, charts, counters, pictures, emoji and emphasis. Every switch is on / off / smart. |
| `voice.js` | Voice-over: ElevenLabs (word-timed), OpenAI-compatible, custom endpoint, free browser voices, or your recordings. Cached, mixed with ducked music, exported with the video. |
| `studio-smart.js` | Studio tabs for Auto, Media, Maps and Voice. |
| `content.hindi.json` | Hindi + English sample written as plain sentences; the Auto-Director adds every visual. |
| `AI-KINETIC-PROMPT.md` | Prompt that makes ChatGPT / Claude / Gemini write content JSON from a lesson. |
| `AI-PRESET-PRD.md` + `presets.schema.json` | Give these to another AI (or a designer) to **write new preset packs**: every contract, allowed value, naming rule and a ready-to-paste prompt. |
| `presets/` | Preset packs merged over `presets.motion.json` (`explainer-pro.json`: cinematic eases, 3D page-turn / card / depth entries, documentary camera moves, chalkboard theme, richer recipes) and `plugin.example.js` (how to add new drawing primitives in JS). |
| `validate-presets.js` | `node validate-presets.js` checks the library and every pack (identity rules, names, primitives, regexes). |
| `*.js` wrappers (`presets.motion.js`, `content.*.js`, `geo/geo-data.js`, `assets/assets.manifest.js`) | Generated so everything works from `file://`. Rebuild with `node build-wrappers.js` after editing JSON, maps or the assets folder. |
---

## Install next to your existing app

```
your-app/
├── Index.html
├── fixed_script.js, pattern_engine.js, …
├── patterns/custom/…
└── kinetic/            ← put this folder here
```

Add one line to `Index.html`, after `x_monetization_features.js`:

```html
<script src="kinetic/kinetic-bridge.js"></script>
```

Nothing else in your app changes. The bridge talks only to `window.AppStore`.

**In the app** you now get:

- **▶ Play canvas as kinetic video** – every annotation becomes a scene. Title → headline beat, label lines or bullets → follow-up beats. Reading order: your auto-numbering, then badge numbers, then top-to-bottom / left-to-right.
- **Open in Kinetic Studio** – hands the current canvas to `kinetic/index.html` for fine-tuning and export.
- **Download motion JSON** – the canvas converted to editable native scenes.
- **Auto-Director** checkbox – annotations that mention places become maps (your `typeKey` styles the markers), numbers count up, emoji and pictures from `kinetic/assets/` are added.
- **Motion for selected annotation** – pick entry / emphasis / exit / camera / staging / layout / transition / background and add tags. Stored on the annotation as `motion`, so 💾 Save, Open and Undo keep it.

**Opening the studio directly:** double-click `kinetic/index.html`, or serve the folder (`npx serve .` or `python -m http.server`) so edits to the `.json` files are picked up without rebuilding wrappers.

---

## Smart features

### Auto-Director (Auto tab)

Write plain sentences; the director reads each one and adds what an editor would:

| Switch | What it does |
| --- | --- |
| Maps | Countries, Indian states and cities (English or Hindi names) → an animated map shot: the world draws on, the view flies to the place, the country fills, pins drop with ripples. "from Delhi to Mumbai" / "दिल्ली से मुंबई" → a great-circle route with a travelling ✈️. |
| Charts | Two or more label–value pairs in one sentence ("India 142 crore, China 141 crore and USA 34 crore") → bar, donut, compare, progress or line chart picked by the data. |
| Numbers | Counters for every number, rolling odometer digits for big ones, a progress ring around percentages, the `number` data style. |
| Pictures | Words that match your asset library become a picture or SVG card. |
| Placeholders | (off by default) one "drop image here" card per scene for its key noun. |
| Emoji | Keyword → emoji placed as its own word (water 💧, पानी 💧, earth 🌍, idea 💡 …). The list is `auto.emojiKeywords` in the presets. |
| Emphasis | One key word per sentence gets accent / highlight / underline / circle in rotation. |

**Smart** means no repeats: if two sentences in a row are about India, only the first gets the map and the second highlights the word. Words you tagged yourself are never touched. **Bake into JSON** writes the director's choices as ordinary tags so you can edit them (and sets `meta.auto: false`).

### Maps (geo.js)

```json
{ "text": "Paper travelled west along the Silk Road.",
  "visual": { "type": "map", "focus": "CN",
    "places": [ { "query": "Xi'an", "label": "Chang'an", "typeKey": "annotationBadge", "badgeText": "1" },
                { "lat": 39.654, "lon": 66.975, "label": "Samarkand", "typeKey": "annotationCalloutCircle" },
                { "query": "Baghdad", "typeKey": "annotationCallout", "title": "First paper mill", "label": "794 CE" } ],
    "routes": [ ["Xi'an", "Baghdad"] ], "highlight": ["UZ", "IQ"] } }
```

- Inline: `[India](map)`, `[Delhi](city)`, `[Madhya Pradesh](state)`, `[21.8_80.2](place:Balaghat)`.
- `focus`, `places`, `routes`, `regions`, `highlight`, `values` (choropleth, e.g. `{"IN":142,"CN":141}`), `region` (subdivision map such as `indiaLow`; others like `usaLow` load from `geo/regions/` or jsDelivr), `style` (`paper`, `blueprint`, `night`), `projection` (`naturalEarth`, `mercator`, `equirect`), `lang` (`hi` labels).
- Place markers use your annotation types: `annotationBadge` → numbered badge, `annotationCallout/Elbow/Curve` → note card with connector (your `dx`, `dy`, `title`, `label`), `annotationCalloutCircle` / `Rect` → drawn ring / box, `annotationXYThreshold` → a latitude line (Tropic of Cancer…), `annotationLabel` → label only.
- **Your own data (Maps tab):** upload any GeoJSON (name it `world` to replace the world map), add places as CSV `name, lat, lon, country, aliases`, or load any amCharts map by name.
- Map credits (amCharts linkware licence, GeoNames CC BY 4.0) are drawn small on each map; keep them.

### Pictures, emoji and SVG (media.js)

- Drop files into the **Media** tab or put them in `kinetic/assets/` (+ optional keywords in `assets/assets.json`) and run `node build-wrappers.js`.
- Inline: `[volcano](img)`, `[heart](svg)`, `[rocket](img:🚀)`, `[photo](img:taj-mahal,tape)`.
- Visual: `{ "type": "media", "asset": "plant", "frame": "polaroid|paper|tape|circle|sticker|none", "entry": "drop|flip|unfold|zoom|slide", "label": "…" }`.
- **SVG** files are split into their paths, shapes and text (with computed styles and transforms) and animated part by part: `draw` (pen draw-on), `strokeThenFill` (sketch then colour — the classic explainer look), `pop`, `build`, `assemble`, `fade`. `auto` picks one from the drawing itself. Add per-part rules with CSS-style selectors:
  `"svg": { "mode": "strokeThenFill", "animate": [ { "select": "#sun", "loop": "pulse" }, { "select": ".leaf", "loop": "wiggle" } ] }`
- Anything missing is drawn as a "Drop image: …" placeholder and listed in the Media tab, where you can drop the file straight onto it.

### Charts (charts.js)

`{ "type": "chart", "chart": "bar|column|donut|pie|progress|pictogram|stat|compare|line|timeline", "title": "…", "data": [ { "label": "India", "value": 142, "emoji": "🇮🇳" } ], "suffix": " crore", "decimals": 0 }` or inline `[India 142 crore, China 141 crore](chart)`.

### Numbers, Hindi and emoji

- `meta.locale` formats numbers (`en-IN` → 1,40,00,00,000); `meta.numerals: "deva"` shows ०१२३. Devanagari digits in text work as counters too.
- Counter modes: `[1,400](counter)` ticks, `[1,40,00,00,000](counter:,,odometer)` rolls digits, `counter:40-87` starts at 40. `ring` and `bar` tags add a progress ring / bar.
- **Hindi and other Indic scripts:** text is split into grapheme clusters with virama/halant merging, so conjuncts like क्ष, त्र, श्री never break. Scripts that need shaping (Devanagari, Bengali, Tamil, Arabic, Thai…) animate word by word by default (`theme.fragment.complexScript: "word"`), so matras and the shirorekha stay connected. Fonts fall back to Noto Sans Devanagari / Kalam automatically.
- Emoji keep their colour: no paper extrusion or shading is applied to them. `:rocket:` shortcodes come from the `emoji` section of the presets.

### Voice-over (voice.js, Voice tab)

| Provider | Notes |
| --- | --- |
| ElevenLabs | Best quality, Hindi and 28 more languages, male/female voice list. Uses the timestamp API so each word appears exactly as it is spoken. Needs your API key. |
| OpenAI-compatible | `/v1/audio/speech` voices (alloy, nova, onyx, shimmer…). Timing is estimated per word. |
| Custom endpoint | POST `{text, voice, lang}` to your server (Piper, Coqui, Azure proxy…); return audio or `{audio_base64, alignment}`. |
| Browser voice | Free (Chrome has हिन्दी and English voices). Preview only — browsers cannot record it, so exports are silent. |
| My recordings | `"audio": "asset-name"` per sentence. |

Per sentence: `"say"` (what to pronounce), `"voiceId"` (a second narrator), `"mute": true`. Narration paces the video: shots land on their words, and a sentence stays until its audio ends. Clips are cached in the browser (IndexedDB), so re-rendering never pays twice; generation only runs when you press **Generate voice-over** unless you tick "Generate new lines on every render". Background music from an audio asset is ducked under the voice. Exports: MP4 gets AAC audio (Chrome/Edge on Windows and macOS), WebM gets Opus, the PNG-sequence zip includes `voiceover.wav`.

API keys stay in your browser; "Remember key" stores it in this device's local storage only.

### Letting another AI write the video

**Copy AI prompt** (Auto tab) or `AI-KINETIC-PROMPT.md` gives ChatGPT, Claude or Gemini the exact JSON shape, tags and visual types. Paste its answer into the Content tab and press Render.

---

## How the motion is built

1. **Fragmentation.** Each sentence is split into *shots* (2–3 words by default, breaking at punctuation and never ending on "the/of/to…"). Every word is a layer and every character is a layer inside it. Tagged spans stay together; hero words (`big`, `huge`, counters, stickers) get their own shot.
2. **Staging.** Each shot is placed in 3D by a staging preset (zigzag, stairs, ring, stack, scatter3d, spiral, flipbook).
3. **Camera.** Between shots the camera performs a move preset (push-in, whip-pan with motion blur, orbit, crane, Dutch roll, dolly-zoom, rack focus, snap zoom, tilt, float) and frames the shot from that preset's own angle, then drifts during the hold with a little handheld noise. Earlier shots stay in the world, so you get real parallax and depth of field.
4. **Paper material.** Letters have thickness (stacked extrusion), a lift shadow that follows the light, fold shading when they rotate, a paper back when they flip over, stop-motion "boil", torn paper strips and chips, and animated grain plus vignette.
5. **Timing.** Entry presets use springs, overshoot and anticipation with per-character or per-word stagger. Emphasis presets chain after the entry. Exits start when the camera leaves. Reading time comes from `theme.timing.wordsPerSecond`.
6. **Supplementary layers.** Tags and annotations generate parallel layers timed to the words: `underline`, `underlineWavy`, `doubleUnderline`, `highlight`, `circle`, `box`, `bracket`, `strike`, `arrow`, `elbowArrow`, `curveArrow`, `callout`, `counter`, `icon`, `burst`, `sparkle`, `badge`, `threshold`, `stamp`, `label`, `shapeWipe`.
7. **Transitions.** Scene changes are always motivated: `paperWipe`, `iris` (opens from the last word you looked at), `matchCut`, `fold`, `foldUp`, `flyThrough`, `push`, `shutter`, `tear`.

If you leave choices out, the theme's `defaults.*Cycle` lists rotate through entries, camera moves, stagings, layouts, backgrounds and transitions, so a plain script still looks varied.

---

## Authoring content

### Inline markup

| Write | Result |
| --- | --- |
| `[four forces](highlight underline)` | Span with supplementary layers |
| `*flight*` | Same as `[flight](em)` → accent colour + big |
| `a | b` | Force a new camera angle between a and b |
| `\n` | Line break inside a shot |
| `[1,200](counter)` | Counts 0 → 1,200. `counter:40-87` sets a start value, `counter:0-18.6,1` sets decimals. Prefix/suffix (`$`, `%`, `m`) are kept. |
| `[bulb](icon:bulb,left)` | Icon sticker; positions `left`, `right`, `top`, `bottom` |
| `[weight](arrow:the_real_secret,bottomLeft)` | Sketch arrow with a handwritten label (`_` = space) |
| `[Nope.](in:stampIn fx:shake out:dropAway)` | Per-span entry, emphasis and exit presets |
| `[word](color:@accent2 size:1.3 font:hand)` | Style overrides |
| `[NEW](stamp:NEW)` | Rubber stamp |

Style tags come from `typeStyles` (`big`, `huge`, `small`, `accent`, `accent2`, `accent3`, `hand`, `body`, `caps`, `italic`, `heavy`, `light`, `outline`, `sticker`, `boil`, `float`). Shorthands come from `tagAliases` (`em`, `hl`, `ul`, `num`, `important`, `wow`, `idea`, `note`, `new`, `strong`, `done`, `nope`, `quote`).

### Beat options

```json
{
  "text": "Longest glide: [18.6m](counter:0-18.6,1 big)",
  "split": "auto",
  "entry": "popUpBook",
  "emphasis": ["jump", "pulse"],
  "exit": "blowAway",
  "idle": "float",
  "layout": "lockupStrips",
  "staging": "zigzag",
  "strip": "line",
  "role": "hand",
  "cameraMoves": ["snapZoom", "dutchRoll"],
  "speed": 1.2,
  "tags": "highlight",
  "annotations": [
    { "typeKey": "annotationBadge", "target": "glide", "badgeText": "3" },
    { "type": "arrow", "target": "18.6m", "label": "record!" }
  ]
}
```

`split`: `auto` · `word` · `phrase` · `sentence` · `manual`.

### Scene options

`beats`, `annotations`, `duration` (time-stretches to fit), `staging`, `layout`, `split`, `exitMode` (`shot` · `beat` · `scene`), `background` (name or inline object), `transition` (name or `{preset, duration, color}`, applied into the next scene), `outro` (e.g. `pullBackReveal` shows every phrase of the scene as a paper diorama), `palette`, `typography`, `theme`, `timing`, `defaults`, `pattern` (a custom-pattern id), `guides` (guideline primitives drawn on as a backdrop).

### Camera keyframes from JSON

```json
"camera": {
  "mode": "additive",
  "keyframes": [
    { "at": 0, "rotY": -18, "rotX": 8, "zoom": 1.4 },
    { "at": "shot:1", "rotY": 10, "zoom": 1.1, "ease": "glide" },
    { "at": "end", "rotY": 0, "zoom": 1.0, "ease": "glide" }
  ]
}
```

`mode: "manual"` replaces the automatic camera (fields you leave out inherit it; `"lookAt": "shot:2"` frames a shot). `mode: "additive"` layers offsets on top. `at` accepts seconds, `shot:N`, `shot:N+0.4`, `beat:N` or `end`. Keys: `tx ty tz rotX rotY rotZ zoom dist fov fx fy fz aperture mblur`.

### Your existing formats work as content

- **Project save** (`annotation-project.json`, v3.x) – drop it into the studio or pass it to `compile()`.
- **📋 d3 JSON** array.
- **Custom pattern output** `{nodes, guidelines}` – guidelines become an animated backdrop.
- **Plain text** – blank-line paragraphs become scenes, sentences become beats.

Legacy `typeKey`s map through `annotationTypes` in the presets:

| typeKey | Kinetic behaviour |
| --- | --- |
| `annotationLabel` | Underlined headline |
| `annotationCallout` | Headline with a sketch arrow; `callout` note card when attached to a beat |
| `annotationCalloutElbow` / `Curve` | Elbow / curved connector arrows (`connectorType`, `connectorEnd` honoured) |
| `annotationCalloutCircle` / `Rect` | Pen circle / rough box |
| `annotationXYThreshold` | Sweeping dashed threshold |
| `annotationBadge` | Numbered badge using your `badgeText` |

Your `color` becomes the scene accent, `titleFont` / `labelFont` become the display and body faces, and label bullets (`•`, `▸`, `→`, `✓`, `1.`, …) become one beat each.

---

## Adding presets

Every category in `presets.motion.json` is open. Add a key, then reference it by name.

```json
"entry": {
  "peelOn": {
    "intent": "Letters peel onto the page like stickers from the top-left corner.",
    "duration": 0.7, "ease": "wobbly", "anchor": "topLeft",
    "stagger": { "unit": "char", "each": 0.03, "from": "start", "maxTotal": 0.4 },
    "props": { "rotX": [[0, -80], [1, 0]], "rotZ": [[0, -20], [1, 0]], "lift": [[0, 20], [1, 0]] }
  }
}
```

- **Keyframes** are `[time 0–1, value, optionalEase]`. The ease on a key applies to the segment arriving at it.
- **Additive channels:** `x y z rotX rotY rotZ skewX skewY blur tracking lift shade`. **Multiplicative:** `scale scaleX scaleY opacity reveal`.
- Entry presets end at identity (0 / 1), exits start at identity, emphasis starts and ends at identity, loops repeat every `period`.
- `stagger.from`: `start` · `end` · `center` · `edges` · `random`. `stagger.unit`: `char` · `word`.
- `"extends": "popUp"` inherits from another preset in the same category.
- **Easings:** a bezier array, or `{ "type": "spring", "stiffness", "damping" }`, `elastic`, `bounce`, `anticipate`, `steps`.
- **Camera moves:** `from` (opening offsets), `props` (mid-move bumps), `framing` (the viewing angle of the new shot), `drift`, `rackFocus`, `motionBlur`.
- **Themes:** `"extends": "paperWhimsy"` and override only `palette`, `typography`, `material`, `camera`, `timing`, `fragment`, `layout` or `defaults`. Colours anywhere accept tokens such as `@accent`, `@strip[2]`, `@ink.dark`, `@accent.a50`.
- **Icons:** add a 24×24 SVG path under `icons` and use `icon:name`.

If a name is missing, the engine logs a warning, falls back to `defaults`, and keeps playing. The studio lists every warning in the **Warnings** tab.

## Preset packs and recipes

A **preset pack** is a JSON file in `presets/` that adds or overrides presets without editing `presets.motion.json`:

```json
{
  "pack": { "name": "my-look", "version": "1.0.0", "intent": "…" },
  "entry": { "inkBleed": { … } },
  "recipes": { "definition": { "entry": "pageTurnIn", "emphasis": "spotlight", "cameraMoves": ["heroLowAngle"] } },
  "append": { "themes.paperWhimsy.defaults.entryCycle": ["inkBleed"], "auto.recipeRules": [ { "recipe": "reflect", "match": "\\bimagine\\b|सोचिए" } ] },
  "remove": ["entry.spinIn"]
}
```

Objects deep-merge, arrays replace, `append` grows arrays, `remove` deletes keys. Install a pack in either of two ways:

- **Permanently:** drop it in `presets/`, then run `node validate-presets.js` (must show 0 errors) and `node build-wrappers.js`. Both the Studio and your `Index.html` (through `kinetic-bridge.js`) pick it up.
- **In the Studio:** **Presets** tab → **Load preset pack…**. The browser remembers it. **Check presets** lists any problems. **Save merged** writes one combined `presets.motion.json`.

**How text finds its motion** (first match wins):

1. explicit beat fields;
2. `beat.recipe`;
3. `scene.beatRecipe` / `scene.recipe`;
4. Auto-Director `auto.recipeRules` (regex on the sentence, English + Hindi);
5. the theme's `defaults.*Cycle` rotations;
6. `defaults`.

Words are styled with semantic tags such as `[osmosis](term)`, defined in `tagAliases` / `typeStyles`. A pack can therefore restyle every video without anyone editing the text.

Annotations can pick recipes too:
- per type with `annotationTypes.<typeKey>.titleRecipe` / `labelRecipe`;
- per annotation with `motion: { "recipe": "warning" }`.

The full contract for writing packs (by hand or with an AI) is in **`AI-PRESET-PRD.md`**.

## Extending the engine

JSON packs can only use drawing primitives that exist. To add a new *kind* of drawing, register it in a small script loaded after `engine.js` (full example: `presets/plugin.example.js`):

```js
KineticEngine.registerSupplement('scribble', (R, sp, box, progress) => { /* draw in shot-plane coords */ });
KineticEngine.registerTransition('ripple', (ctx, A, B, p, P) => { /* composite two frames */ });
KineticEngine.registerBackgroundLayer('stars', (R, layer, index, t) => { /* camera-space layer; api.bgPoint for parallax */ });
```

Then reference them from JSON (`"kind": "scribble"`, `"type": "ripple"`, `{ "type": "stars" }`).

New visual shot types (like the map, media and chart plug-ins) register with `KineticEngine.registerBlock(kind, { tags, fromTag, merge, size, duration, preload, prepare, draw })`; see `charts.js` for a compact example. `KineticEngine.api` exposes the renderer helpers (plane transforms, torn paper, hand-drawn strokes, number formatting).

## Scripting API

```js
const player = new KineticEngine.Player(canvas, { previewWidth: 1280 });
await player.load(content, presets, { theme: 'nightCraft' });
player.play(); player.seek(12.5); player.seekScene(2); player.setSpeed(0.5); player.setLoop(false);
player.on('scene', i => …).on('time', t => …);

const tl = KineticEngine.compile(content, presets, { width: 1920, height: 1080 });
KineticEngine.renderFrame(tl, 3.2, ctx);                        // pure function of time

await KineticEngine.Export.pngSequence(content, presets, { fps: 30 });
await KineticEngine.Export.encoded(content, presets, { format: 'mp4' });   // or 'webm'
```

## Export

Rendering is frame-by-frame from the timeline, so every frame is exact on any machine.

- **MP4 (H.264) / WebM (VP9)** use WebCodecs plus the muxer scripts loaded from jsDelivr. Chrome and Edge on Windows/macOS encode H.264; some Chromium builds on Linux only have VP9, in which case choose WebM.
- **PNG sequence (.zip)** works in every browser and imports into After Effects or Premiere as an image sequence.
- **MediaRecorder WebM** is a real-time fallback.
- Use the Export tab's width/height for 4K, vertical 1080×1920 or square output. Layout adapts to the aspect ratio.

---

## How to author a new video

1. **Start from what you have.** Paste lesson text (Hindi, English or mixed), build the infographic in Annotation Studio and press ▶ Play canvas as kinetic video, or let another AI draft the JSON with the prompt from the Auto tab.
2. **Leave the Auto-Director on.** It adds maps for places, charts for compared numbers, counters, pictures from your library, emoji and emphasis. Change any switch to Off or On in the Auto tab.
3. **Add pictures.** Open the Media tab; every "Needs a picture" row is a placeholder in the video. Drop an image or SVG onto it.
4. **Mark anything the director missed** with tags such as `[Nile](map)`, `[87%](counter ring)`, `[cell](svg)`, `*key word*`, and `|` for a new camera angle.
5. **Add narration.** Voice tab → pick a provider and voice → Generate voice-over. The video re-times itself to the speech.
6. **Pick a theme**, press Ctrl/Cmd + Enter, scrub with the arrow keys and check the Warnings tab.
7. **Export** MP4 (with voice and music) for YouTube, or a PNG sequence + `voiceover.wav` for After Effects / Premiere.
