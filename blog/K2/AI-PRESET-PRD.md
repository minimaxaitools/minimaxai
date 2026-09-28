# AI Preset Guide — how to write new motion presets for the Kinetic Engine

**Who this is for:** give this file to any AI (ChatGPT, Gemini, Claude, a local LLM) or a human motion designer who will **extend or restyle** the kinetic-typography engine. Attach these files with it:

| File | Why the AI needs it |
|---|---|
| `AI-PRESET-PRD.md` (this file) | The contracts and rules. |
| `presets.schema.json` | Machine-readable shape of every section, with the allowed primitive values. |
| `presets.motion.json` | The existing library, so the AI can reuse names instead of re-inventing them. |
| `presets/explainer-pro.json` | A full worked example pack (cinematic eases, 3D entries, chalkboard theme, recipes). |
| *(optional)* `presets/plugin.example.js` | Only when you want new *drawing* primitives (see §11). |

The AI returns **one JSON file: a preset pack**. You drop it in `presets/`, run `node validate-presets.js` and `node build-wrappers.js`, and it works in the Studio (`index.html`) **and** in your existing app (`Index.html` through `kinetic-bridge.js`). The other way is to load it at runtime: Studio → **Presets** tab → **Load preset pack…**.

---

## 1. The mental model in 60 seconds

The engine never hard-codes a motion. Every decision is a **name that looks up a preset**:

```
text  ──►  beats (sentences)  ──►  shots (2-4 word fragments)  ──►  words ──► glyphs
             │                        │                            │
             ├ recipe                 ├ layout  (how lines sit)    ├ entry / emphasis / exit / loop (keyframes)
             ├ staging (3D path)      ├ camera move (how we arrive)├ typeStyles (colour, size, font role)
             └ scene: background, transition, theme                └ supplements (underline, circle, arrow …)
```

A **preset pack** adds new names, or changes existing ones. A **recipe** bundles several names under one *meaning* ("definition", "warning", "stat"). That is how text maps onto motion without anyone editing the text.

---

## 2. How text chooses presets (the mapping layer)

For every beat, the first rule that gives a value wins. Earlier rules override later ones:

1. **Explicit beat field**: `{ "text": "…", "entry": "inkBleed", "layout": "bigNumber" }`
2. **Beat recipe**: `{ "text": "…", "recipe": "definition" }`
3. **Scene recipe for beats**: `scene.beatRecipe`, then `scene.recipe` (scene recipes also set background, transition and staging).
4. **Auto recipe (Auto-Director)**: `auto.recipeRules` regexes are matched against the beat text. English and Hindi rules ship for question, definition, warning, step, example, summary, quote. The first short beat of the video gets `auto.titleRecipe`.
5. **Theme rotation**: `themes.<theme>.defaults.entryCycle / cameraMoves / layoutCycle / stagingCycle / transitionCycle / backgroundCycle`. The engine walks these lists so consecutive shots differ.
6. **Global `defaults`** in `presets.motion.json`.
7. **Safe fallback**: if a name is missing, the engine logs a warning in the Warnings tab and uses the category default. It never crashes.

Word-level control is set with inline tags in the text: `[word](tag tag:arg …)`.

| Inline tag | Effect |
|---|---|
| a **typeStyles** name, e.g. `big` `accent` `hand` `number` `term` | colour, size, font role, and optional emphasis/idle |
| a **supplements** name, e.g. `underline` `circle` `highlight` `arrow` `tick` | a parallel drawing layer on that span |
| a **tagAliases** name, e.g. `important` `definition` `key` | expands to several real tags |
| `in:<entry>` / `out:<exit>` / `fx:<emphasis>` | per-word override of entry / exit / emphasis |
| `counter` (on a number) | odometer / tick-up, locale-aware digits |
| `icon:check` or `icon:🚀` | icon sticker |
| `|` in the text | manual shot break (with `"split": "manual"`) |

**What authors (or an AI writing content) need to put in the text:** nothing, when recipes and auto rules cover the sentence type. For finer control they add a `recipe` on the beat, or wrap key words with a semantic alias (`[photosynthesis](term)`). Prefer **semantic** aliases (`term`, `key`, `danger`, `correct`) over visual ones (`accent big circle`). Then a new pack can restyle every video by redefining the alias, without touching any text.

Annotations from your existing app map the same way:
- `presets.annotationTypes.<typeKey>` sets `titleTags`, `supplement`, and the new `titleRecipe` / `labelRecipe` fields.
- A single annotation can override these in its `motion` object: `{ "recipe": "warning", "labelRecipe": "step", "entry": "…", "tags": "…" }`.

---

## 3. Pack file format

```json
{
  "$schema": "../presets.schema.json",
  "pack": { "name": "my-pack", "version": "1.0.0", "author": "…", "intent": "What this pack is for.", "requires": [] },

  "entry":   { "newName": { … } },          // add new presets or override existing ones (deep merge)
  "themes":  { "paperWhimsy": { "palette": { "accent": "#E4572E" } } },   // change ONE key of an existing preset

  "append":  { "themes.paperWhimsy.defaults.entryCycle": ["newName"] },   // add to an existing array (deduplicated)
  "remove":  ["entry.spinIn"]                                               // delete a preset (use rarely)
}
```

Merge rules:
- Objects deep-merge.
- Arrays **replace**. To grow a list, use `append`.
- Packs load in file-name order after `presets.motion.json`, so later packs win.
- The Studio's **Save merged** button writes one combined `presets.motion.json` if you want to bake the packs in.

---

## 4. Keyframe presets: `entry`, `emphasis`, `exit`, `loop`

```json
"inkBleed": {
  "intent": "Letters bloom out of blurred ink from the centre of the word.",
  "duration": 0.9,                     // seconds (scaled by beat speed)
  "ease": "cinematicOut",              // default ease between keys
  "anchor": "center",                  // pivot: center | baseline | top | bottom | left | right | topLeft | bottomLeft
  "stagger": { "unit": "char", "each": 0.03, "from": "center", "maxTotal": 0.35 },
  "props": {
    "blur":    [[0, 14], [0.7, 0]],
    "scale":   [[0, 1.6], [1, 1]],
    "opacity": [[0, 0], [0.4, 1]]
  }
}
```

- **Keys** are `[t, value, easeIntoThisKey?]` with `t` running 0…1 over `duration`. Before the first key the value holds; after the last key it holds too.
- **Additive channels** (identity = 0):

  | Channel | Unit |
  |---|---|
  | `x` `y` `z` | design px; z > 0 moves away from the camera |
  | `rotX` `rotY` `rotZ` | degrees |
  | `skewX` `skewY` | degrees |
  | `blur` | px |
  | `tracking` | em |
  | `lift` | extra shadow height |
  | `shade` | 0…1 darkening, for 3D turns |

- **Multiplicative channels** (identity = 1): `scale` `scaleX` `scaleY` `opacity` `reveal`. `reveal` is the 0…1 wipe of the glyph.
- **Stagger**:
  - `unit` is `char` or `word`. Complex scripts such as Hindi are always animated per word, so conjuncts never break.
  - `from` is `start | end | center | edges | random`. `random` is seeded, so it is the same every render.
  - `maxTotal` caps the total spread for long words.

**Identity rules** (checked by the validator, and required for seamless chaining):

| Category | Rule |
|---|---|
| `entry` | every track **ends** at identity |
| `exit` | every track **starts** at identity |
| `emphasis` | every track **starts and ends** at identity |
| `loop` | first value == last value; uses `period` (s) instead of `duration`; optional `phase` (`random`/`index`), `phaseStep`, `fadeIn` |

Rotations may end at any multiple of 360 (`flip360`).

`extends: "otherPreset"` inherits and overrides.

### Easings (`easings`)

| Form | Example |
|---|---|
| cubic-bezier | `[x1, y1, x2, y2]`. y outside 0…1 gives overshoot or anticipation. |
| spring | `{ "type": "spring", "stiffness": 220, "damping": 13, "mass": 1 }` |
| elastic | `{ "type": "elastic", "amplitude": 1, "period": 0.3 }` |
| bounce | `{ "type": "bounce" }` |
| anticipate | `{ "type": "anticipate", "amount": 1.6 }` |
| steps | `{ "type": "steps", "steps": 4 }`, gives a stop-motion feel |

Existing eases: smoothOut snappy overshoot bigOvershoot anticipate whip glide exitIn springy wobbly stiffSpring elastic bounce stopMotion hold swipe drift cameraMove handDrawn. Plus the pack eases: cinematicOut rubbery snapBack heavyLand lazy.

---

## 5. Camera moves (`camera`)

A camera move is how the viewer **arrives** at a new shot, and how the camera behaves while the shot is read.

```json
"heroLowAngle": {
  "intent": "Low hero angle looking up at the phrase, slow push.",
  "duration": 1.2, "ease": "cinematicOut",
  "from":    { "rotX": 30, "zoom": 1.6 },          // offset at the start of the move (eased to 0)
  "props":   { "zoom": [[0,1],[0.5,1.15],[1,1]] }, // optional mid-move bumps (0 at both ends; zoom ×1)
  "framing": { "rotX": -16, "zoom": 1.08 },        // resting angle while the phrase is read
  "drift":   { "dist": -120, "rotX": -2 },          // slow motion over the hold
  "rackFocus": { "delay": 0.5, "aperture": 3.5, "ease": "snappy" },   // optional
  "motionBlur": 0.5                                  // 0 = none, 1 = normal, 1.5 = whip
}
```

Pose channels:

| Channel | Meaning |
|---|---|
| `tx` `ty` `tz` | camera translation |
| `rotX` | tilt |
| `rotY` | orbit / pan |
| `rotZ` | dutch roll |
| `dist` | dolly |
| `fov` | field of view |
| `fx` `fy` `fz` | focus point |
| `aperture` | depth of field |
| `mblur` | motion blur |
| `zoom` | framing zoom (multiplicative, 1 = text fills the frame nicely) |

Keep `framing.rotY` within ±25° and `rotX` within ±20°, or the text becomes hard to read.

## 6. Staging (`staging`)

Staging sets where each shot lives in 3D space, which decides the path the camera travels.
- `type: "linear"` takes a cumulative `step {x,y,z,rotX,rotY,rotZ}`. `alternate: ["x","rotY"]` flips the sign on every other shot (zigzag). `jitter {…}` adds seeded randomness.
- `type: "ring"` takes `radius`, `angleStep` (°), `angleStart`, `facing` (1 = faces the centre) and an optional `step` (e.g. `{ "y": -320 }` makes a helix).

Design units: the frame is 1920×1080. A good step is 700–1900 px sideways or 250–600 px vertical.

## 7. Layouts (`layouts`)

| Key | Meaning |
|---|---|
| `mode` | `lockup` (justified kinetic lock-up) \| `center` \| `left` \| `cascade` \| `arc` \| `caption` (under a visual block) |
| `width` | share of the frame, 0–1 |
| `maxLines` | maximum number of lines |
| `lineHeight` | line spacing |
| `maxSize` | px |
| `cascadeStep` | `cascade` mode setting |
| `arcRadius`, `arcDirection` | `arc` mode settings |
| `style` | e.g. `{ "role": "hand" }` |
| `paper` | `{ strip: word\|line\|shot, pad:[y,x], torn: 0–1, entry: stripWipe\|stripDrop, ink, stagger, rotJitter, lift }` sets the paper cut-out strips behind the text |

## 8. Supplements (`supplements`)

A supplement is a drawing layer that is triggered by a tag or an annotation. It is made from `kind` (the renderer primitive) plus timing and style:

```json
"scribbleCircle": { "intent": "…", "extends": "circle", "duration": 0.55, "style": { "turns": 1.8, "wobble": 0.12 } }
```

Common fields:
- `layer`: `under` or `over`.
- `delay`, `duration`, `ease`.
- `screen: true`: draw in screen space.
- `exitScale`.

Style colours accept palette tokens. The kinds and their main style keys are:

| kind | style keys |
|---|---|
| underline | color thickness offset wobble overshoot wave double |
| highlight | color opacity height top skew blend |
| circle | color thickness pad turns wobble |
| box, bracket | color thickness pad |
| strike | color thickness |
| arrow | color color2 thickness length bend from headSize connector (straight/elbow/curve) |
| callout | color color2 thickness offset textSize textRole cardColor |
| icon | icon (name from `icons` or an emoji) color size at gap chipColor wiggle spinIn |
| burst | color rays length gap thickness squash |
| sparkle | color count size speed |
| badge | color textColor radius at textSize |
| threshold | color thickness span dash at |
| stamp | color size rotate x y fromScale opacity |
| label | color size at rotate |
| ring, bar | color color2 thickness radius / height at (data visuals) |
| counter | (no style; animates numbers) |
| shapeWipe | color band skew opacity (screen space) |

## 9. Transitions (`transitions`) and backgrounds (`backgrounds`)

Transitions (never a hard cut):

| type | params |
|---|---|
| paperWipe | angle band color jag |
| iris | ring color |
| matchCut | color |
| fold | axis x\|y |
| flyThrough | — |
| push | direction ±1 |
| shutter | bands stagger color |
| tear | color |

All transitions also take `duration` and `ease`.

Backgrounds are `{ color, gradient:{to}, layers:[…] }`. The layers sit at camera-space depths, so they parallax with the camera.

| layer type | params |
|---|---|
| paperPlanes | count depth[min,max] size colors opacity torn rotJitter drift |
| confetti | count depth size colors shapes[rect,circle,tri] fall sway spin opacity nearBlurDepth |
| sunburst | rays speed opacity color depth |
| dots | depth spacing radius opacity color |
| grid | depth spacing opacity color width |
| blobs | count colors opacity |

## 10. Themes, palette tokens, typeStyles, tagAliases, recipes

**Themes** hold the look:
- `palette`: paper paper2 ink accent accent2 accent3 highlight shadow back strip[].
- `typography`: roles display body hand data deva handDeva, each `{family, weight, fallback}`, plus caps and tracking. Families load from Google Fonts automatically.
- `material`: shadow, extrude, grain, vignette.
- `timing`: wordsPerSecond, minShot, shotHold, voice keys.
- `fragment`: maxWordsPerShot, isolateTags.
- `numbers`: locale, numerals.
- `defaults`: the rotation cycles.

Use `extends: "paperWhimsy"` and override only what changes.

**Palette tokens** can be used anywhere a colour is accepted: `@accent`, `@strip[2]`, `@ink.a50` (50 % alpha), `@accent.dark`, `@paper.light`.

**typeStyles** apply per word when used as a tag. Keys:
- `role`, `color`, `size` (multiplier), `caps`, `italic`, `weight`
- `outline`, `outlineColor`
- `chip`, `chipColor`, `chipPad`
- `emphasis`, `idle`

**tagAliases** are the semantic vocabulary for authors: `"danger": "accent strike fx:flash"`. When a pack redefines an alias, every video that uses it is restyled.

**recipes** are meaning → motion bundles.
- Beat keys: entry emphasis exit idle layout staging cameraMoves split strip role speed captionLayout tags.
- Scene keys: background transition staging layout exitMode outro split palette camera.
- Any recipe can be used on a beat or on a scene.

**auto.recipeRules**: `[{ "recipe": "reflect", "match": "\\b(imagine|remember)\\b|सोचिए", "intent": "…" }]`.
- `match` is a JavaScript RegExp source tested with flags `iu`.
- Use `append` to add rules without replacing the shipped ones.
- Write rules for **every language** your content uses.

---

## 11. JSON or JS? What a pack can and cannot do

JSON packs can **combine, re-time and restyle** everything that exists:
- new keyframe motions, eases, camera moves, stagings, layouts;
- new variants of any supplement, transition or background layer;
- themes, recipes, aliases and auto rules.

That covers the great majority of new looks.

A **new kind of drawing** needs a few lines of JS registered at runtime. Examples are a new supplement shape, a new transition compositor, a new background layer type, or a new visual block like a map or chart. See `presets/plugin.example.js`.

```js
KineticEngine.registerSupplement('zigzag', (R, sp, b, pr) => { /* draw in the phrase plane; pr.p = 0→1 */ });
KineticEngine.registerTransition('curtain', (ctx, A, B, p, P) => { /* composite canvas A → B */ });
KineticEngine.registerBackgroundLayer('rain', (R, L, i, t) => { /* use api.bgPoint for parallax */ });
KineticEngine.registerBlock('timeline', { tags, size, duration, draw });   // full visual shots (see charts.js)
```

After registering, JSON presets use the new names (`"kind": "zigzag"`, `"type": "curtain"`, `{ "type": "rain" }`).

Load the plug-in with a `<script>` tag right after `engine.js` in `index.html` and your `Index.html`. For CLI validation, pass it first: `node validate-presets.js presets/my-plugin.js presets/my-pack.json`.

Draw functions must be **pure functions of time**: no state kept between frames, no `Math.random()` (use `api.rng(seed)`). This keeps export frame-accurate.

---

## 12. Naming and quality rules (art direction)

1. **Names**: camelCase English, describing the motion rather than the use (`pageTurnIn`, not `definitionEntry`). The use goes in recipes.
2. **Every preset has an `intent`**: one sentence saying what it looks like and when to use it. The Studio shows it, and AIs use it to choose presets.
3. **Don't duplicate** existing names unless you mean to override them. Check `presets.motion.json` first.
4. **Timing**:
   - entries 0.35–1.0 s;
   - emphasis 0.4–1.0 s;
   - exits 0.35–0.7 s (exits faster than entries);
   - camera moves 0.6–2.0 s;
   - char stagger `each` 0.02–0.05 with a `maxTotal` cap of 0.3–0.45.
5. **Readability first**:
   - opacity reaches 1 within the first ~40 % of an entry;
   - blur reaches 0 by 70–80 %;
   - no framing angle steeper than ±25°.
6. **Paper feel**:
   - prefer `shade` on 3D turns, `lift` for pick-ups and `stopMotion`/`hold` eases for crafty jitter;
   - avoid glossy effects.
7. **Variety through cycles**: add 3–6 new names to a theme's cycles with `append`. Don't replace the cycles unless you are making a whole new theme.
8. **Hindi / complex scripts**: never rely on per-character effects for meaning, because those scripts animate per word. Test with `content.hindi.json`.
9. **Recipes carry meaning**. When adding a recipe, also add or extend an `auto.recipeRules` entry (English + Hindi) and, if useful, a semantic `tagAlias`.

## 13. Validate and install

```bash
node validate-presets.js                          # base + every presets/*.json → errors / warnings / counts
node validate-presets.js presets/my-pack.json     # just one pack
node validate-presets.js --merge merged.json      # also write the merged library
node build-wrappers.js                            # regenerate presets/packs.js so file:// pages see the pack
```

The validator checks:
- structure and identity rules;
- unknown eases, anchors and stagger values;
- camera channels;
- staging and layout modes;
- supplement kinds, transition types and background layers (against the registered renderers);
- tagAlias targets;
- typeStyle emphasis/idle names;
- recipe references and recipeRule regexes;
- theme cycles and palette tokens.

**Ship only with 0 errors.**

In the Studio: **Presets** tab →
- **Load preset pack…** (.json packs or .js plug-ins);
- **Check presets** (issues appear in the Warnings tab);
- **Save merged**.

Loaded packs are remembered in this browser.

---

## 14. Ready-to-paste prompt for another AI

> You are a senior motion designer extending a JSON-driven kinetic-typography engine (whimsical paper-motion explainers, 3D camera). Read `AI-PRESET-PRD.md`, `presets.schema.json`, `presets.motion.json` and the example `presets/explainer-pro.json`.
>
> Produce ONE preset pack JSON file named `presets/<pack-name>.json` for this goal: **<describe the style / audience / subject, e.g. "energetic science explainer for Class 8, Hindi + English, chalkboard and lab-notebook looks">**.
>
> Requirements:
> 1. A `pack` header with name, version, intent.
> 2. At least: 4 easings, 8 entry, 5 emphasis, 4 exit, 2 loop, 6 camera, 3 staging, 3 layouts, 4 supplements (variants of existing kinds), 4 transitions (existing types), 2 backgrounds (existing layer types), 1 theme (`extends` an existing theme), 6 recipes, 4 semantic tagAliases, and `append` entries that add your new names to the theme cycles and `auto.recipeRules` (with English AND Hindi regexes).
> 3. Obey the identity rules (§4), the parameter ranges (§12) and allowed primitive values (§5–§9). Reuse existing preset names where they fit; every new preset needs an `intent`.
> 4. Only use primitives that exist. If a look truly needs a new drawing primitive, ALSO return a small `presets/<name>-plugin.js` following `presets/plugin.example.js` (pure functions of time, no Math.random).
> 5. After the JSON, list: new names by category, which recipes map to which sentence types, and 3 example beats showing how an author would use the new tags/recipes.
>
> Output valid JSON only in the file block (no comments).

To have an AI **write content** that uses the presets (rather than make new presets), give it `AI-KINETIC-PROMPT.md`. Its content JSON can then say `"recipe": "definition"`, or use your aliases like `[osmosis](term)`.
