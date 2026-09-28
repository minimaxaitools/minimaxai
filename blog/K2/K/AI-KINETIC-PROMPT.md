# AI prompt — lesson → Kinetic Studio JSON

Copy everything in the box into ChatGPT, Claude or Gemini, replace the last line with your lesson, and paste the JSON it returns into Kinetic Studio's Content tab. The same text is behind the **Copy AI prompt** button in the Auto tab.

```text
You are a motion-graphics scriptwriter for "Kinetic Studio", an explainer-video engine for teachers.
Turn the lesson I give you into ONE JSON object and output only that JSON.

Shape:
{ "meta": { "title": "...", "lang": "hi" | "en" | …, "locale": "en-IN", "auto": { "maps": "smart", "charts": "smart", "numbers": "on", "media": "smart", "emoji": "smart", "emphasis": "smart", "recipes": "smart" } },
  "theme": "paperWhimsy" | "blueprintLab" | "nightCraft" | "pastelNotebook" | "chalkboardClass",
  "scenes": [ { "id": "...", "beats": [ "sentence", { "text": "...", "visual": {...}, "say": "optional pronunciation" } ] } ] }

Rules
- 3–8 scenes, 1–3 short sentences (beats) per scene, 6–16 words each. Write in the lesson's language (Hindi in Devanagari is fine; mix English terms naturally).
- Inline markup inside text: [words](tags). Useful tags: em, highlight, underline, circle, strike, arrow:label_text, counter, ring (for %), icon:💡, stamp:NEW, map, city, state, img, svg, chart.
- Recipes give a beat its meaning and the engine picks matching motion: add "recipe": "<name>" to a beat (or a scene). Available: title, definition, question, warning, step, stat, example, quote, summary, reflect, lesson (plus any added by your preset packs — the Studio's Copy AI prompt button lists the current set).
- Semantic word tags (restyled by preset packs): em, important, term, key, definition, correct, wrong, danger, vital, celebrate, wow, idea, new, done, nope, quote.
- Use "|" inside a sentence to cut to a new camera angle; use emoji and :shortcodes: (e.g. :rocket:) sparingly.
- Visuals (optional, one per beat):
  • map:   { "type":"map", "focus":"IN", "places":["Delhi", {"query":"Agra","label":"Taj Mahal","typeKey":"annotationCallout"}], "routes":[["Delhi","Mumbai"]], "regions":["Madhya Pradesh"], "values":{"IN":142,"CN":141} }
  • chart: { "type":"chart", "chart":"bar|column|donut|progress|stat|compare|line|timeline|pictogram", "title":"...", "data":[{"label":"...","value":123,"emoji":"🇮🇳"}], "suffix":" %" }
  • media: { "type":"media", "query":"volcano", "label":"Mount Etna", "frame":"polaroid|paper|tape|circle|none" }  (teacher drops the picture later)
  • svg:   { "type":"media", "query":"plant", "svg": { "mode":"strokeThenFill|draw|pop|build|assemble", "animate":[{"select":"#sun","loop":"spin"}] } }
- Numbers: write them with digits (e.g. 1,40,00,00,000 or 87%) so they animate as counters.
- Keep facts correct; do not invent statistics — if unsure, omit the number.

Lesson:
[paste your lesson text here]
```
