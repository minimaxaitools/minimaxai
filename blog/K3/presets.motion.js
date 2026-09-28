/* Generated from presets.motion.json by build-wrappers.js — edit the JSON, then run: node build-wrappers.js */
window.KineticPresets = {
  "_about": "Motion preset library for KineticEngine. Every visual and timing decision the engine makes is resolved from this file + a theme. Each preset has an 'intent' explaining what the motion is for. Keyframes are [normalisedTime, value, optionalEase]. Entry presets animate FROM the listed offsets TO identity (value 0 / factor 1 at t=1). Emphasis presets return to identity at both ends. Exit presets animate FROM identity. Additive channels: x y z rotX rotY rotZ skewX skewY blur tracking lift shade. Multiplicative channels: scale scaleX scaleY opacity reveal.",
  "version": "1.0.0",
  "defaults": {
    "_about": "Global fallbacks. Category-named keys (entry, exit, camera…) are used when a preset name is missing; singular keys drive the compiler.",
    "theme": "paperWhimsy",
    "width": 1920,
    "height": 1080,
    "fps": 30,
    "designHeight": 1080,
    "ease": "smoothOut",
    "split": "auto",
    "exitMode": "shot",
    "annotationsPerScene": 1,
    "entry": "popUp",
    "emphasis": "pulse",
    "exit": "fadeBack",
    "loop": "paperBoil",
    "idle": "paperBoil",
    "camera": "pushIn",
    "staging": "zigzag",
    "layouts": "centered",
    "layout": "centered",
    "supplements": "underline",
    "transitions": "paperWipe",
    "transition": "paperWipe",
    "backgrounds": "paperStack",
    "background": "paperStack",
    "stripEntry": "stripWipe",
    "captionLayout": "caption",
    "emojiIdle": "emojiBounce",
    "guides": {
      "depth": 2000,
      "fill": 0.95,
      "stagger": 0.08,
      "duration": 1.4,
      "delay": 0.15,
      "ease": "glide",
      "opacity": 0.55,
      "stroke": "@ink",
      "lineScale": 2
    }
  },
  "fontProvider": {
    "_about": "How the engine requests web fonts for theme typography. {families} is replaced by one familyParam per family.",
    "url": "https://fonts.googleapis.com/css2?{families}&display=swap",
    "familyParam": "family={name}:wght@{weights}"
  },
  "language": {
    "_about": "Fragmentation rules. Shots never end on a joiner word; they break after breakAfter punctuation.",
    "joiners": [
      "का",
      "की",
      "के",
      "में",
      "से",
      "है",
      "हैं",
      "और",
      "को",
      "पर",
      "ने",
      "एक",
      "यह",
      "वह",
      "भी",
      "तो",
      "ही",
      "था",
      "थी",
      "थे",
      "जो",
      "कि",
      "a",
      "an",
      "the",
      "of",
      "to",
      "in",
      "on",
      "at",
      "for",
      "and",
      "or",
      "but",
      "with",
      "from",
      "by",
      "as",
      "is",
      "are",
      "was",
      "be",
      "its",
      "your",
      "our",
      "their",
      "this",
      "that",
      "into",
      "than",
      "so",
      "if",
      "my",
      "his",
      "her"
    ],
    "joinersHi": "Hindi joiners are merged into joiners above so shots never end on का / की / के / में / से / है …",
    "breakAfter": "[,;:.!?…—–।॥]$",
    "sentenceSplit": "(?<=[.!?…।॥])\\s+(?=[\\p{Lu}\\p{N}\\p{Script=Devanagari}\"“\\[*:])"
  },
  "easings": {
    "smoothOut": {
      "intent": "Default decelerating ease for anything that simply arrives.",
      "curve": [
        0.22,
        1,
        0.36,
        1
      ]
    },
    "snappy": {
      "intent": "Very fast start, soft landing — UI-like snaps.",
      "curve": [
        0.16,
        1,
        0.3,
        1
      ]
    },
    "overshoot": {
      "intent": "Arrives past the target then settles back (back-out).",
      "curve": [
        0.34,
        1.56,
        0.64,
        1
      ]
    },
    "bigOvershoot": {
      "intent": "Cartoon overshoot for whimsical pops.",
      "curve": [
        0.3,
        1.9,
        0.5,
        1
      ]
    },
    "anticipate": {
      "intent": "Pulls back first (anticipation) then launches past and settles.",
      "curve": {
        "type": "anticipate",
        "amount": 1.6
      }
    },
    "whip": {
      "intent": "Slow–fast–slow, the classic whip-pan speed ramp.",
      "curve": [
        0.83,
        0,
        0.17,
        1
      ]
    },
    "glide": {
      "intent": "Balanced ease-in-out for long camera glides.",
      "curve": [
        0.45,
        0,
        0.2,
        1
      ]
    },
    "exitIn": {
      "intent": "Accelerating ease for things leaving frame.",
      "curve": [
        0.7,
        0,
        0.84,
        0
      ]
    },
    "springy": {
      "intent": "Physical spring with one clear bounce.",
      "curve": {
        "type": "spring",
        "stiffness": 220,
        "damping": 13
      }
    },
    "wobbly": {
      "intent": "Loose jelly spring for paper flaps.",
      "curve": {
        "type": "spring",
        "stiffness": 180,
        "damping": 8
      }
    },
    "stiffSpring": {
      "intent": "Tight spring that slams and settles fast — stamps.",
      "curve": {
        "type": "spring",
        "stiffness": 420,
        "damping": 24
      }
    },
    "elastic": {
      "intent": "Rubber-band settle.",
      "curve": {
        "type": "elastic",
        "amplitude": 1,
        "period": 0.35
      }
    },
    "bounce": {
      "intent": "Ball-drop bounce on landing.",
      "curve": {
        "type": "bounce"
      }
    },
    "stopMotion": {
      "intent": "4-step stutter for stop-motion paper feel.",
      "curve": {
        "type": "steps",
        "steps": 4
      }
    },
    "hold": {
      "intent": "Hold previous key until the next one (stepped keyframes).",
      "curve": {
        "type": "steps",
        "steps": 1
      }
    },
    "swipe": {
      "intent": "Marker/highlighter swipe: hesitates then rushes across.",
      "curve": [
        0.65,
        0,
        0.1,
        1
      ]
    },
    "drift": {
      "intent": "Gentle sine-like drift for idle camera moves.",
      "curve": [
        0.37,
        0,
        0.63,
        1
      ]
    },
    "cameraMove": {
      "intent": "Cinematic camera ease: committed start, long settle.",
      "curve": [
        0.7,
        0,
        0.15,
        1
      ]
    },
    "handDrawn": {
      "intent": "Pen-stroke draw-on: quick start, slows at the end of the stroke.",
      "curve": [
        0.25,
        0.8,
        0.3,
        1
      ]
    }
  },
  "typeStyles": {
    "_about": "Style tags usable inline: [word](big accent). Keys are merged into the word style; 'size' multiplies.",
    "big": {
      "intent": "Hero word — 1.45× size.",
      "size": 1.45
    },
    "huge": {
      "intent": "Poster word — 2× size.",
      "size": 2
    },
    "small": {
      "intent": "Aside/connective words.",
      "size": 0.7
    },
    "accent": {
      "intent": "Accent colour + a pulse after it lands.",
      "color": "@accent",
      "emphasis": "pulse"
    },
    "accent2": {
      "intent": "Secondary accent colour.",
      "color": "@accent2"
    },
    "accent3": {
      "intent": "Tertiary accent colour.",
      "color": "@accent3"
    },
    "hand": {
      "intent": "Handwritten role (sketch notes feel).",
      "role": "hand"
    },
    "body": {
      "intent": "Body typeface role.",
      "role": "body"
    },
    "caps": {
      "intent": "Force uppercase.",
      "caps": true
    },
    "lower": {
      "intent": "Disable theme caps.",
      "caps": false
    },
    "italic": {
      "intent": "Italic.",
      "italic": true
    },
    "heavy": {
      "intent": "Heaviest weight.",
      "weight": 800
    },
    "light": {
      "intent": "Light weight.",
      "weight": 400
    },
    "outline": {
      "intent": "Hollow paper letter with ink outline.",
      "outline": true,
      "color": "@paper",
      "outlineColor": "@ink",
      "outlineWidth": 0.05
    },
    "sticker": {
      "intent": "Word printed on its own torn paper chip.",
      "chip": true,
      "chipColor": "@accent",
      "color": "@paper",
      "chipPad": 0.16
    },
    "boil": {
      "intent": "Stronger stop-motion jitter on this word.",
      "idle": "boilStrong"
    },
    "float": {
      "intent": "Word keeps floating after it lands.",
      "idle": "float"
    },
    "number": {
      "intent": "Data treatment for numbers: data typeface, secondary accent, a little bigger, a lift after landing.",
      "role": "data",
      "color": "@accent2",
      "size": 1.15,
      "emphasis": "lift"
    }
  },
  "tagAliases": {
    "_about": "Shorthand tags. Values are space-separated tag lists; args after ':' are forwarded when the alias target has none.",
    "em": "accent big",
    "hl": "highlight",
    "ul": "underline",
    "num": "counter",
    "important": "accent big underline burst",
    "wow": "burst sparkle",
    "idea": "icon:bulb",
    "note": "arrow",
    "new": "stamp:NEW",
    "strong": "heavy accent",
    "done": "icon:check,left",
    "nope": "strike",
    "quote": "bracket hand"
  },
  "entry": {
    "popUp": {
      "intent": "Letters spring up from below with a squashy overshoot — the signature whimsical arrival.",
      "duration": 0.75,
      "ease": "springy",
      "anchor": "baseline",
      "stagger": {
        "unit": "char",
        "each": 0.035,
        "from": "start",
        "maxTotal": 0.4
      },
      "props": {
        "y": [
          [
            0,
            70
          ],
          [
            1,
            0
          ]
        ],
        "scale": [
          [
            0,
            0.2
          ],
          [
            1,
            1
          ]
        ],
        "scaleY": [
          [
            0,
            1.5
          ],
          [
            0.35,
            0.85,
            "smoothOut"
          ],
          [
            1,
            1
          ]
        ],
        "rotZ": [
          [
            0,
            -14
          ],
          [
            1,
            0
          ]
        ],
        "opacity": [
          [
            0,
            0
          ],
          [
            0.18,
            1,
            "smoothOut"
          ]
        ]
      }
    },
    "foldDown": {
      "intent": "Each letter is a paper flap hinged at its top edge that swings down into place and wobbles.",
      "duration": 0.9,
      "ease": "wobbly",
      "anchor": "top",
      "stagger": {
        "unit": "char",
        "each": 0.03,
        "from": "start",
        "maxTotal": 0.4
      },
      "props": {
        "rotX": [
          [
            0,
            -105
          ],
          [
            1,
            0
          ]
        ],
        "opacity": [
          [
            0,
            0
          ],
          [
            0.12,
            1,
            "smoothOut"
          ]
        ],
        "shade": [
          [
            0,
            0.35
          ],
          [
            1,
            0
          ]
        ]
      }
    },
    "flipIn": {
      "intent": "Whole words flip over like cards, revealing their printed face (you briefly see the paper back).",
      "duration": 0.8,
      "ease": "overshoot",
      "anchor": "center",
      "stagger": {
        "unit": "word",
        "each": 0.09,
        "from": "start"
      },
      "props": {
        "rotY": [
          [
            0,
            180
          ],
          [
            1,
            0
          ]
        ],
        "z": [
          [
            0,
            -120
          ],
          [
            1,
            0
          ]
        ],
        "opacity": [
          [
            0,
            0
          ],
          [
            0.1,
            1
          ]
        ]
      }
    },
    "dropBounce": {
      "intent": "Letters fall from above in random order and bounce on the baseline.",
      "duration": 0.85,
      "ease": "bounce",
      "anchor": "baseline",
      "stagger": {
        "unit": "char",
        "each": 0.03,
        "from": "random",
        "maxTotal": 0.38
      },
      "props": {
        "y": [
          [
            0,
            -520
          ],
          [
            1,
            0
          ]
        ],
        "rotZ": [
          [
            0,
            18
          ],
          [
            0.7,
            -4,
            "smoothOut"
          ],
          [
            1,
            0
          ]
        ],
        "opacity": [
          [
            0,
            0
          ],
          [
            0.1,
            1
          ]
        ]
      }
    },
    "slideSkew": {
      "intent": "Words slide in from the right with a speed-skew that straightens on arrival.",
      "duration": 0.6,
      "ease": "snappy",
      "anchor": "left",
      "stagger": {
        "unit": "word",
        "each": 0.08,
        "from": "start"
      },
      "props": {
        "x": [
          [
            0,
            280
          ],
          [
            1,
            0
          ]
        ],
        "skewX": [
          [
            0,
            -28
          ],
          [
            1,
            0
          ]
        ],
        "opacity": [
          [
            0,
            0
          ],
          [
            0.25,
            1
          ]
        ]
      }
    },
    "zoomThrough": {
      "intent": "Letters rush toward the camera from far depth, de-blurring as they lock in (from the centre outward).",
      "duration": 0.7,
      "ease": "snappy",
      "anchor": "center",
      "stagger": {
        "unit": "char",
        "each": 0.025,
        "from": "center"
      },
      "props": {
        "z": [
          [
            0,
            1400
          ],
          [
            1,
            0
          ]
        ],
        "blur": [
          [
            0,
            10
          ],
          [
            0.8,
            0
          ]
        ],
        "opacity": [
          [
            0,
            0
          ],
          [
            0.3,
            1
          ]
        ]
      }
    },
    "popUpBook": {
      "intent": "Letters stand up out of the page like a pop-up book, hinged at their feet.",
      "duration": 0.8,
      "ease": "overshoot",
      "anchor": "bottom",
      "stagger": {
        "unit": "char",
        "each": 0.03,
        "from": "start",
        "maxTotal": 0.38
      },
      "props": {
        "rotX": [
          [
            0,
            90
          ],
          [
            1,
            0
          ]
        ],
        "shade": [
          [
            0,
            0.4
          ],
          [
            1,
            0
          ]
        ],
        "opacity": [
          [
            0,
            0
          ],
          [
            0.15,
            1
          ]
        ]
      }
    },
    "spinIn": {
      "intent": "Letters pinwheel in from the centre of the word with a spring settle.",
      "duration": 0.8,
      "ease": "springy",
      "anchor": "center",
      "stagger": {
        "unit": "char",
        "each": 0.03,
        "from": "center"
      },
      "props": {
        "rotZ": [
          [
            0,
            -200
          ],
          [
            1,
            0
          ]
        ],
        "scale": [
          [
            0,
            0
          ],
          [
            1,
            1
          ]
        ]
      }
    },
    "typewriter": {
      "intent": "Stop-motion typing: each glyph stamps in slightly large and snaps to size.",
      "duration": 0.25,
      "ease": "stopMotion",
      "anchor": "baseline",
      "stagger": {
        "unit": "char",
        "each": 0.055,
        "from": "start"
      },
      "props": {
        "scale": [
          [
            0,
            1.5
          ],
          [
            1,
            1
          ]
        ],
        "opacity": [
          [
            0,
            0
          ],
          [
            0.01,
            1,
            "hold"
          ]
        ]
      }
    },
    "tumbleIn": {
      "intent": "Letters tumble in 3D from near the lens in random order and assemble — a scattered-paper feel.",
      "duration": 0.95,
      "ease": "overshoot",
      "anchor": "center",
      "stagger": {
        "unit": "char",
        "each": 0.03,
        "from": "random",
        "maxTotal": 0.38
      },
      "props": {
        "rotX": [
          [
            0,
            110
          ],
          [
            1,
            0
          ]
        ],
        "rotY": [
          [
            0,
            -70
          ],
          [
            1,
            0
          ]
        ],
        "z": [
          [
            0,
            -600
          ],
          [
            1,
            0
          ]
        ],
        "y": [
          [
            0,
            -60
          ],
          [
            1,
            0
          ]
        ],
        "opacity": [
          [
            0,
            0
          ],
          [
            0.2,
            1
          ]
        ]
      }
    },
    "stampIn": {
      "intent": "Words slam down from above the page like a rubber stamp.",
      "duration": 0.5,
      "ease": "stiffSpring",
      "anchor": "center",
      "stagger": {
        "unit": "word",
        "each": 0.14,
        "from": "start"
      },
      "props": {
        "scale": [
          [
            0,
            3.2
          ],
          [
            1,
            1
          ]
        ],
        "rotZ": [
          [
            0,
            -10
          ],
          [
            1,
            0
          ]
        ],
        "opacity": [
          [
            0,
            0
          ],
          [
            0.2,
            1
          ]
        ],
        "blur": [
          [
            0,
            6
          ],
          [
            0.6,
            0
          ]
        ]
      }
    },
    "squashStretch": {
      "intent": "Cartoon squash & stretch: letters shoot up tall and thin, then squash wide before settling.",
      "duration": 0.8,
      "ease": "smoothOut",
      "anchor": "baseline",
      "stagger": {
        "unit": "char",
        "each": 0.03,
        "from": "start",
        "maxTotal": 0.38
      },
      "props": {
        "scaleY": [
          [
            0,
            0
          ],
          [
            0.35,
            1.45,
            "snappy"
          ],
          [
            0.6,
            0.8
          ],
          [
            0.85,
            1.07
          ],
          [
            1,
            1
          ]
        ],
        "scaleX": [
          [
            0,
            1.6
          ],
          [
            0.35,
            0.7,
            "snappy"
          ],
          [
            0.6,
            1.2
          ],
          [
            0.85,
            0.96
          ],
          [
            1,
            1
          ]
        ]
      }
    },
    "whipIn": {
      "intent": "Words whip in sideways in 3D with motion blur, matching a whip-pan camera.",
      "duration": 0.55,
      "ease": "whip",
      "anchor": "center",
      "stagger": {
        "unit": "word",
        "each": 0.06,
        "from": "start"
      },
      "props": {
        "x": [
          [
            0,
            -900
          ],
          [
            1,
            0
          ]
        ],
        "rotY": [
          [
            0,
            70
          ],
          [
            1,
            0
          ]
        ],
        "blur": [
          [
            0,
            16
          ],
          [
            0.85,
            0
          ]
        ],
        "opacity": [
          [
            0,
            0
          ],
          [
            0.2,
            1
          ]
        ]
      }
    },
    "anticipateRise": {
      "intent": "Letters dip down first (anticipation), then pop up past the line and settle.",
      "duration": 0.8,
      "ease": "anticipate",
      "anchor": "baseline",
      "stagger": {
        "unit": "char",
        "each": 0.03,
        "from": "start",
        "maxTotal": 0.38
      },
      "props": {
        "y": [
          [
            0,
            90
          ],
          [
            1,
            0
          ]
        ],
        "opacity": [
          [
            0,
            0
          ],
          [
            0.3,
            1
          ]
        ]
      }
    },
    "stripWipe": {
      "intent": "Paper strip is revealed left→right like tape being laid down, with a slight settle.",
      "duration": 0.55,
      "ease": "swipe",
      "anchor": "left",
      "props": {
        "reveal": [
          [
            0,
            0
          ],
          [
            1,
            1
          ]
        ],
        "rotZ": [
          [
            0,
            -2
          ],
          [
            1,
            0,
            "overshoot"
          ]
        ]
      }
    },
    "stripDrop": {
      "intent": "Paper chip drops onto the page from the camera side and wobbles flat.",
      "duration": 0.7,
      "ease": "wobbly",
      "anchor": "center",
      "props": {
        "z": [
          [
            0,
            -500
          ],
          [
            1,
            0
          ]
        ],
        "rotZ": [
          [
            0,
            -12
          ],
          [
            1,
            0
          ]
        ],
        "rotX": [
          [
            0,
            30
          ],
          [
            1,
            0
          ]
        ],
        "opacity": [
          [
            0,
            0
          ],
          [
            0.15,
            1
          ]
        ]
      }
    }
  },
  "emphasis": {
    "pulse": {
      "intent": "Heart-beat scale pulse to say 'this matters'.",
      "duration": 0.55,
      "ease": "smoothOut",
      "props": {
        "scale": [
          [
            0,
            1
          ],
          [
            0.35,
            1.18
          ],
          [
            1,
            1
          ]
        ]
      }
    },
    "wiggle": {
      "intent": "Playful rotational wiggle, like the paper is excited.",
      "duration": 0.7,
      "ease": "smoothOut",
      "anchor": "baseline",
      "props": {
        "rotZ": [
          [
            0,
            0
          ],
          [
            0.2,
            -9
          ],
          [
            0.4,
            8
          ],
          [
            0.6,
            -5
          ],
          [
            0.8,
            3
          ],
          [
            1,
            0
          ]
        ]
      }
    },
    "jump": {
      "intent": "Letters hop one after another with squash on landing (a Mexican wave).",
      "duration": 0.55,
      "ease": "smoothOut",
      "stagger": {
        "unit": "char",
        "each": 0.04
      },
      "props": {
        "y": [
          [
            0,
            0
          ],
          [
            0.45,
            -46
          ],
          [
            1,
            0,
            "bounce"
          ]
        ],
        "scaleY": [
          [
            0,
            1
          ],
          [
            0.3,
            1.12
          ],
          [
            0.8,
            0.86
          ],
          [
            1,
            1
          ]
        ]
      }
    },
    "wave": {
      "intent": "Soft sine wave travelling through the letters.",
      "duration": 0.9,
      "ease": "drift",
      "stagger": {
        "unit": "char",
        "each": 0.05
      },
      "props": {
        "y": [
          [
            0,
            0
          ],
          [
            0.5,
            -24
          ],
          [
            1,
            0
          ]
        ]
      }
    },
    "shake": {
      "intent": "Horizontal shake for warnings / 'no!'.",
      "duration": 0.45,
      "ease": "smoothOut",
      "props": {
        "x": [
          [
            0,
            0
          ],
          [
            0.15,
            -10
          ],
          [
            0.3,
            10
          ],
          [
            0.45,
            -8
          ],
          [
            0.6,
            7
          ],
          [
            0.8,
            -3
          ],
          [
            1,
            0
          ]
        ]
      }
    },
    "flip360": {
      "intent": "Full card flip to re-present a word.",
      "duration": 0.8,
      "ease": "overshoot",
      "props": {
        "rotY": [
          [
            0,
            0
          ],
          [
            1,
            360
          ]
        ]
      }
    },
    "rubberBand": {
      "intent": "Rubber-band stretch and snap back.",
      "duration": 0.75,
      "ease": "smoothOut",
      "props": {
        "scaleX": [
          [
            0,
            1
          ],
          [
            0.3,
            1.3
          ],
          [
            0.45,
            0.8
          ],
          [
            0.6,
            1.12
          ],
          [
            0.8,
            0.96
          ],
          [
            1,
            1
          ]
        ],
        "scaleY": [
          [
            0,
            1
          ],
          [
            0.3,
            0.75
          ],
          [
            0.45,
            1.2
          ],
          [
            0.6,
            0.9
          ],
          [
            0.8,
            1.03
          ],
          [
            1,
            1
          ]
        ]
      }
    },
    "lift": {
      "intent": "Word peels up off the page (bigger shadow) then lays back down.",
      "duration": 0.8,
      "ease": "smoothOut",
      "props": {
        "lift": [
          [
            0,
            0
          ],
          [
            0.4,
            22
          ],
          [
            1,
            0
          ]
        ],
        "rotX": [
          [
            0,
            0
          ],
          [
            0.4,
            -14
          ],
          [
            1,
            0
          ]
        ],
        "scale": [
          [
            0,
            1
          ],
          [
            0.4,
            1.06
          ],
          [
            1,
            1
          ]
        ]
      }
    }
  },
  "loop": {
    "paperBoil": {
      "intent": "Subtle stop-motion jitter (12 fps feel) so paper letters never look frozen.",
      "period": 0.5,
      "ease": "hold",
      "phase": "random",
      "fadeIn": 0.3,
      "props": {
        "rotZ": [
          [
            0,
            0
          ],
          [
            0.33,
            0.9
          ],
          [
            0.66,
            -0.7
          ],
          [
            1,
            0
          ]
        ],
        "y": [
          [
            0,
            0
          ],
          [
            0.33,
            -0.8
          ],
          [
            0.66,
            0.6
          ],
          [
            1,
            0
          ]
        ]
      }
    },
    "boilStrong": {
      "intent": "Stronger boil for a hand-made emphasis word.",
      "period": 0.36,
      "ease": "hold",
      "phase": "random",
      "fadeIn": 0.2,
      "props": {
        "rotZ": [
          [
            0,
            0
          ],
          [
            0.33,
            2.4
          ],
          [
            0.66,
            -2
          ],
          [
            1,
            0
          ]
        ],
        "y": [
          [
            0,
            0
          ],
          [
            0.33,
            -2
          ],
          [
            0.66,
            1.6
          ],
          [
            1,
            0
          ]
        ]
      }
    },
    "float": {
      "intent": "Slow float as if drifting on air.",
      "period": 2.6,
      "ease": "drift",
      "phaseStep": 0.15,
      "fadeIn": 0.6,
      "props": {
        "y": [
          [
            0,
            0
          ],
          [
            0.5,
            -10
          ],
          [
            1,
            0
          ]
        ],
        "rotZ": [
          [
            0,
            0
          ],
          [
            0.5,
            1.2
          ],
          [
            1,
            0
          ]
        ]
      }
    },
    "emojiBounce": {
      "intent": "Emoji stickers keep a playful bounce.",
      "period": 1.1,
      "ease": "drift",
      "phase": "random",
      "fadeIn": 0.3,
      "props": {
        "y": [
          [
            0,
            0
          ],
          [
            0.5,
            -6
          ],
          [
            1,
            0
          ]
        ],
        "rotZ": [
          [
            0,
            -4
          ],
          [
            0.5,
            4
          ],
          [
            1,
            -4
          ]
        ]
      }
    },
    "breathe": {
      "intent": "Very slow scale breathing for held titles.",
      "period": 3.2,
      "ease": "drift",
      "fadeIn": 0.8,
      "props": {
        "scale": [
          [
            0,
            1
          ],
          [
            0.5,
            1.03
          ],
          [
            1,
            1
          ]
        ]
      }
    }
  },
  "exit": {
    "fadeBack": {
      "intent": "Recede into depth and fade while the camera moves on — keeps the parallax trail readable.",
      "duration": 0.8,
      "ease": "smoothOut",
      "stagger": {
        "unit": "word",
        "each": 0.05
      },
      "props": {
        "z": [
          [
            0,
            0
          ],
          [
            1,
            700
          ]
        ],
        "opacity": [
          [
            0,
            1
          ],
          [
            1,
            0
          ]
        ],
        "blur": [
          [
            0,
            0
          ],
          [
            1,
            5
          ]
        ]
      }
    },
    "dropAway": {
      "intent": "Letters lose their glue and fall off the page in random order.",
      "duration": 0.7,
      "ease": "exitIn",
      "anchor": "baseline",
      "stagger": {
        "unit": "char",
        "each": 0.02,
        "from": "random",
        "maxTotal": 0.3
      },
      "props": {
        "y": [
          [
            0,
            0
          ],
          [
            1,
            620
          ]
        ],
        "rotZ": [
          [
            0,
            0
          ],
          [
            1,
            40
          ]
        ],
        "opacity": [
          [
            0,
            1
          ],
          [
            0.7,
            1
          ],
          [
            1,
            0
          ]
        ]
      }
    },
    "foldAway": {
      "intent": "Letters fold flat back into the page on their hinge.",
      "duration": 0.55,
      "ease": "exitIn",
      "stagger": {
        "unit": "char",
        "each": 0.02,
        "maxTotal": 0.3
      },
      "props": {
        "rotX": [
          [
            0,
            0
          ],
          [
            1,
            92
          ]
        ],
        "shade": [
          [
            0,
            0
          ],
          [
            1,
            0.5
          ]
        ],
        "opacity": [
          [
            0,
            1
          ],
          [
            0.85,
            1
          ],
          [
            1,
            0
          ]
        ]
      }
    },
    "scatterUp": {
      "intent": "Blown toward the lens and up, blurring out — a burst exit.",
      "duration": 0.6,
      "ease": "exitIn",
      "stagger": {
        "unit": "char",
        "each": 0.015,
        "from": "center"
      },
      "props": {
        "y": [
          [
            0,
            0
          ],
          [
            1,
            -260
          ]
        ],
        "z": [
          [
            0,
            0
          ],
          [
            1,
            -700
          ]
        ],
        "blur": [
          [
            0,
            0
          ],
          [
            1,
            10
          ]
        ],
        "opacity": [
          [
            0,
            1
          ],
          [
            1,
            0
          ]
        ]
      }
    },
    "flipOut": {
      "intent": "Words flip away like cards turned face-down.",
      "duration": 0.6,
      "ease": "exitIn",
      "stagger": {
        "unit": "word",
        "each": 0.07
      },
      "props": {
        "rotY": [
          [
            0,
            0
          ],
          [
            1,
            -180
          ]
        ],
        "opacity": [
          [
            0,
            1
          ],
          [
            0.9,
            1
          ],
          [
            1,
            0
          ]
        ]
      }
    },
    "shrink": {
      "intent": "Spin and shrink to nothing.",
      "duration": 0.5,
      "ease": "exitIn",
      "stagger": {
        "unit": "char",
        "each": 0.02,
        "from": "end"
      },
      "props": {
        "scale": [
          [
            0,
            1
          ],
          [
            1,
            0
          ]
        ],
        "rotZ": [
          [
            0,
            0
          ],
          [
            1,
            120
          ]
        ]
      }
    },
    "blowAway": {
      "intent": "Letters are blown off to the right like paper in wind.",
      "duration": 0.8,
      "ease": "exitIn",
      "stagger": {
        "unit": "char",
        "each": 0.025,
        "from": "start",
        "maxTotal": 0.4
      },
      "props": {
        "x": [
          [
            0,
            0
          ],
          [
            1,
            800
          ]
        ],
        "y": [
          [
            0,
            0
          ],
          [
            0.5,
            -80
          ],
          [
            1,
            -30
          ]
        ],
        "rotZ": [
          [
            0,
            0
          ],
          [
            1,
            70
          ]
        ],
        "rotY": [
          [
            0,
            0
          ],
          [
            1,
            60
          ]
        ],
        "opacity": [
          [
            0,
            1
          ],
          [
            0.7,
            1
          ],
          [
            1,
            0
          ]
        ]
      }
    }
  },
  "camera": {
    "_about": "Camera moves between shots. from = offsets used when the move opens a scene. props = mid-move bumps (0 at both ends; zoom is multiplicative). framing = the angle the new shot is viewed from (gives each fragment a different camera angle). drift = where the camera creeps during the hold.",
    "pushIn": {
      "intent": "Steady dolly push toward the phrase, then a slow creep in.",
      "duration": 1,
      "ease": "cameraMove",
      "from": {
        "zoom": 1.9,
        "rotX": -6
      },
      "props": {
        "zoom": [
          [
            0,
            1
          ],
          [
            0.5,
            1.15
          ],
          [
            1,
            1
          ]
        ]
      },
      "framing": {
        "zoom": 1.08
      },
      "drift": {
        "dist": -140
      },
      "motionBlur": 0.6
    },
    "whipPan": {
      "intent": "Fast whip across to the next phrase with motion blur and a roll kick.",
      "duration": 0.55,
      "ease": "whip",
      "from": {
        "tx": -1600,
        "rotY": 30
      },
      "props": {
        "rotZ": [
          [
            0,
            0
          ],
          [
            0.5,
            -7
          ],
          [
            1,
            0
          ]
        ]
      },
      "framing": {
        "rotY": -14,
        "rotX": 4,
        "zoom": 1.1
      },
      "motionBlur": 1.8
    },
    "orbitLeft": {
      "intent": "Orbit around the new phrase from the left, revealing it in perspective.",
      "duration": 1.2,
      "ease": "glide",
      "from": {
        "rotY": 40
      },
      "props": {
        "rotY": [
          [
            0,
            0
          ],
          [
            0.5,
            -22
          ],
          [
            1,
            0
          ]
        ],
        "zoom": [
          [
            0,
            1
          ],
          [
            0.5,
            1.2
          ],
          [
            1,
            1
          ]
        ]
      },
      "framing": {
        "rotY": 20,
        "rotX": 3,
        "zoom": 1.12
      },
      "drift": {
        "rotY": -4,
        "dist": -60
      },
      "motionBlur": 0.8
    },
    "orbitRight": {
      "intent": "Mirror orbit from the right.",
      "duration": 1.2,
      "ease": "glide",
      "from": {
        "rotY": -40
      },
      "props": {
        "rotY": [
          [
            0,
            0
          ],
          [
            0.5,
            22
          ],
          [
            1,
            0
          ]
        ],
        "zoom": [
          [
            0,
            1
          ],
          [
            0.5,
            1.2
          ],
          [
            1,
            1
          ]
        ]
      },
      "framing": {
        "rotY": -20,
        "rotX": -3,
        "zoom": 1.12
      },
      "drift": {
        "rotY": 4,
        "dist": -60
      },
      "motionBlur": 0.8
    },
    "craneDown": {
      "intent": "Crane from above down onto the phrase, ending on a low hero angle.",
      "duration": 1.1,
      "ease": "cameraMove",
      "from": {
        "rotX": -40,
        "ty": -500
      },
      "props": {
        "rotX": [
          [
            0,
            0
          ],
          [
            0.5,
            -16
          ],
          [
            1,
            0
          ]
        ],
        "ty": [
          [
            0,
            0
          ],
          [
            0.5,
            -160
          ],
          [
            1,
            0
          ]
        ]
      },
      "framing": {
        "rotX": 12,
        "zoom": 1.1
      },
      "drift": {
        "rotX": -3,
        "dist": -80
      },
      "motionBlur": 0.7
    },
    "tiltUp": {
      "intent": "Tilt up from below to meet the words — a reveal from the floor.",
      "duration": 1,
      "ease": "cameraMove",
      "from": {
        "rotX": 35
      },
      "props": {
        "rotX": [
          [
            0,
            0
          ],
          [
            0.5,
            12
          ],
          [
            1,
            0
          ]
        ]
      },
      "framing": {
        "rotX": -10,
        "zoom": 1.1
      },
      "drift": {
        "rotX": 2
      },
      "motionBlur": 0.6
    },
    "dutchRoll": {
      "intent": "Rolls into a playful Dutch angle with an overshoot.",
      "duration": 0.9,
      "ease": "overshoot",
      "from": {
        "rotZ": 25
      },
      "props": {
        "rotZ": [
          [
            0,
            0
          ],
          [
            0.6,
            12
          ],
          [
            1,
            0
          ]
        ]
      },
      "framing": {
        "rotZ": -8,
        "rotY": 10,
        "zoom": 1.12
      },
      "drift": {
        "rotZ": 2
      },
      "motionBlur": 0.8
    },
    "dollyZoom": {
      "intent": "Vertigo dolly-zoom: FOV widens while the camera pushes, warping depth.",
      "duration": 1.3,
      "ease": "glide",
      "from": {
        "zoom": 2.2
      },
      "props": {
        "fov": [
          [
            0,
            0
          ],
          [
            0.5,
            28
          ],
          [
            1,
            0
          ]
        ],
        "zoom": [
          [
            0,
            1
          ],
          [
            0.5,
            0.6
          ],
          [
            1,
            1
          ]
        ]
      },
      "framing": {
        "rotY": 8,
        "zoom": 1.1
      },
      "drift": {
        "fov": -3
      },
      "motionBlur": 0.4
    },
    "rackFocus": {
      "intent": "Slide over while focus stays on the old phrase, then rack onto the new one.",
      "duration": 1.2,
      "ease": "glide",
      "rackFocus": {
        "delay": 0.5,
        "aperture": 3.5,
        "ease": "snappy"
      },
      "from": {
        "zoom": 1.4
      },
      "framing": {
        "rotY": -9,
        "zoom": 1.16,
        "aperture": 1.2
      },
      "drift": {
        "dist": -80
      },
      "motionBlur": 0.3
    },
    "snapZoom": {
      "intent": "Crash-zoom snap for punchlines.",
      "duration": 0.4,
      "ease": "snappy",
      "from": {
        "zoom": 3
      },
      "props": {
        "zoom": [
          [
            0,
            1
          ],
          [
            0.4,
            1.4
          ],
          [
            1,
            1
          ]
        ]
      },
      "framing": {
        "zoom": 1.02,
        "rotZ": 3
      },
      "drift": {
        "dist": -60
      },
      "motionBlur": 1.5
    },
    "floatOver": {
      "intent": "Lazy drifting glide — calm, for reflective lines.",
      "duration": 1.6,
      "ease": "glide",
      "from": {
        "ty": 300,
        "rotX": 15
      },
      "props": {
        "ty": [
          [
            0,
            0
          ],
          [
            0.5,
            -80
          ],
          [
            1,
            0
          ]
        ]
      },
      "framing": {
        "rotX": -4,
        "rotY": 6,
        "zoom": 1.15
      },
      "drift": {
        "rotY": -3,
        "ty": -30
      },
      "motionBlur": 0.3
    },
    "pullBackReveal": {
      "intent": "Outro: pulls far back and angles down to reveal every paper phrase of the scene as a diorama.",
      "duration": 1.8,
      "ease": "glide",
      "framing": {
        "rotY": -16,
        "rotX": 12,
        "zoom": 1.05
      },
      "drift": {
        "rotY": 5
      },
      "motionBlur": 0.4
    }
  },
  "staging": {
    "_about": "Where each fragment (shot) is placed in 3D. linear = cumulative step (+alternating axes) + seeded jitter. ring = around a circle so the camera orbits.",
    "zigzag": {
      "intent": "Phrases hop left/right and step toward camera, each turned to face a different angle.",
      "type": "linear",
      "step": {
        "x": 1300,
        "y": 560,
        "z": -250,
        "rotY": -28,
        "rotZ": 5
      },
      "alternate": [
        "x",
        "rotY",
        "rotZ"
      ],
      "jitter": {
        "y": 120,
        "rotZ": 3
      }
    },
    "stairs": {
      "intent": "Phrases climb a diagonal staircase — a sense of progress.",
      "type": "linear",
      "step": {
        "x": 1100,
        "y": -420,
        "z": -300,
        "rotY": -8,
        "rotZ": -3
      },
      "jitter": {
        "rotZ": 2
      }
    },
    "ring": {
      "intent": "Phrases arranged on a ring; the camera orbits the ring between them.",
      "type": "ring",
      "radius": 2300,
      "angleStep": 48,
      "facing": 1,
      "step": {
        "y": 60
      },
      "jitter": {
        "rotZ": 3
      }
    },
    "stack": {
      "intent": "Phrases stacked in depth; the camera dollies through each paper layer.",
      "type": "linear",
      "step": {
        "z": 1500
      },
      "jitter": {
        "x": 260,
        "y": 160,
        "rotZ": 8
      }
    },
    "scatter3d": {
      "intent": "Phrases scattered in a 3D cloud at wild angles — energetic, collage-like.",
      "type": "linear",
      "step": {
        "x": 0
      },
      "jitter": {
        "x": 1400,
        "y": 800,
        "z": 900,
        "rotY": 40,
        "rotX": 22,
        "rotZ": 14
      }
    },
    "spiral": {
      "intent": "A rising spiral — good for sequences and timelines.",
      "type": "ring",
      "radius": 1500,
      "angleStep": 70,
      "facing": 1,
      "step": {
        "y": -260
      }
    },
    "flipbook": {
      "intent": "Every phrase lands in almost the same spot — pages of a flipbook replacing each other.",
      "type": "linear",
      "step": {
        "z": -40
      },
      "jitter": {
        "rotZ": 6,
        "x": 60,
        "y": 40
      }
    }
  },
  "layouts": {
    "_about": "Layout solver settings per shot. mode: lockup (each line justified to the same width — classic kinetic type) | center | left | cascade | arc. paper.strip: line | word | shot | none.",
    "lockup": {
      "intent": "Justified kinetic lock-up, line sizes vary so every line fills the width.",
      "mode": "lockup",
      "width": 0.7,
      "maxLines": 3,
      "lineHeight": 0.96
    },
    "lockupStrips": {
      "intent": "Lock-up where every line sits on its own torn paper strip.",
      "mode": "lockup",
      "width": 0.66,
      "maxLines": 3,
      "lineHeight": 1.12,
      "paper": {
        "strip": "line",
        "pad": [
          0.07,
          0.1
        ],
        "torn": 0.7,
        "entry": "stripWipe",
        "ink": "@ink",
        "stagger": 0.08,
        "lift": 2
      }
    },
    "centered": {
      "intent": "Calm centred block, equal sizes.",
      "mode": "center",
      "width": 0.74,
      "maxLines": 2,
      "lineHeight": 1.02
    },
    "stickers": {
      "intent": "Every word is its own paper sticker dropped onto the page.",
      "mode": "center",
      "width": 0.72,
      "maxLines": 2,
      "lineHeight": 1.25,
      "paper": {
        "strip": "word",
        "pad": [
          0.1,
          0.12
        ],
        "torn": 0.5,
        "entry": "stripDrop",
        "ink": "@ink",
        "stagger": 0.07,
        "rotJitter": 5,
        "lift": 3
      }
    },
    "cascade": {
      "intent": "Lines step diagonally like falling paper.",
      "mode": "cascade",
      "width": 0.62,
      "maxLines": 3,
      "cascadeStep": 0.1,
      "lineHeight": 1.1,
      "paper": {
        "strip": "line",
        "pad": [
          0.06,
          0.1
        ],
        "torn": 0.6,
        "entry": "stripWipe",
        "ink": "@ink",
        "stagger": 0.1
      }
    },
    "arc": {
      "intent": "Single line bent along an arch — banner / title feel.",
      "mode": "arc",
      "width": 0.8,
      "maxLines": 1,
      "arcRadius": 0.9,
      "arcDirection": 1
    },
    "banner": {
      "intent": "Whole phrase on one big paper banner.",
      "mode": "center",
      "width": 0.7,
      "maxLines": 2,
      "lineHeight": 1.05,
      "paper": {
        "strip": "shot",
        "pad": [
          0.06,
          0.18
        ],
        "torn": 0.9,
        "entry": "stripWipe",
        "ink": "@ink"
      }
    },
    "caption": {
      "intent": "Lower-third caption under a map, picture, SVG or chart.",
      "mode": "center",
      "width": 0.8,
      "maxLines": 2,
      "lineHeight": 1.05,
      "captionHeight": 0.2,
      "captionGap": 0.035,
      "maxSize": 110,
      "paper": {
        "strip": "line",
        "pad": [
          0.05,
          0.1
        ],
        "torn": 0.5,
        "entry": "stripWipe",
        "ink": "@ink",
        "stagger": 0.06
      }
    },
    "handNote": {
      "intent": "Handwritten left-aligned note for supporting lines.",
      "mode": "left",
      "width": 0.66,
      "maxLines": 3,
      "lineHeight": 1.05,
      "style": {
        "role": "hand"
      }
    }
  },
  "supplements": {
    "_about": "Parallel motion layers generated from tags/annotations. kind = renderer primitive; style colours accept @palette tokens; layer 'under' draws beneath text; screen:true draws in screen space.",
    "underline": {
      "intent": "Hand-drawn pen underline that draws on after the words land.",
      "kind": "underline",
      "delay": 0.05,
      "duration": 0.5,
      "ease": "handDrawn",
      "style": {
        "color": "@accent",
        "thickness": 0.07,
        "offset": 0.14,
        "wobble": 0.03,
        "overshoot": 0.08
      }
    },
    "underlineWavy": {
      "intent": "Wavy underline — playful stress.",
      "extends": "underline",
      "style": {
        "wave": 0.05
      }
    },
    "doubleUnderline": {
      "intent": "Double underline for maximum stress.",
      "extends": "underline",
      "duration": 0.7,
      "style": {
        "double": true
      }
    },
    "highlight": {
      "intent": "Marker highlighter swipe behind the words (multiply blend on paper).",
      "kind": "highlight",
      "layer": "under",
      "delay": 0,
      "duration": 0.45,
      "ease": "swipe",
      "style": {
        "color": "@highlight",
        "opacity": 0.95,
        "height": 0.62,
        "top": 0.35,
        "skew": -8,
        "blend": "multiply",
        "shadow": false
      }
    },
    "circle": {
      "intent": "Loose pen circle scribbled around the phrase.",
      "kind": "circle",
      "delay": 0.1,
      "duration": 0.7,
      "ease": "handDrawn",
      "style": {
        "color": "@accent",
        "thickness": 0.055,
        "pad": 0.32,
        "turns": 1.12,
        "wobble": 0.05
      }
    },
    "box": {
      "intent": "Rough pen box — used for legacy Rect targets.",
      "kind": "box",
      "delay": 0.1,
      "duration": 0.7,
      "ease": "handDrawn",
      "style": {
        "color": "@accent2",
        "thickness": 0.045,
        "pad": 0.2
      }
    },
    "bracket": {
      "intent": "Bracket callouts that grow out from the middle.",
      "kind": "bracket",
      "delay": 0.05,
      "duration": 0.45,
      "ease": "overshoot",
      "style": {
        "color": "@accent2",
        "thickness": 0.05,
        "pad": 0.28
      }
    },
    "strike": {
      "intent": "Scribbled strike-through for myths / corrections.",
      "kind": "strike",
      "delay": 0.15,
      "duration": 0.35,
      "ease": "swipe",
      "style": {
        "color": "@accent",
        "thickness": 0.09
      }
    },
    "arrow": {
      "intent": "Curved sketch arrow pointing at the phrase, optional hand-written label at its tail.",
      "kind": "arrow",
      "delay": 0.15,
      "duration": 0.7,
      "ease": "handDrawn",
      "style": {
        "color": "@accent",
        "color2": "@ink",
        "thickness": 0.045,
        "length": 1.25,
        "bend": 0.35,
        "from": "topLeft",
        "headSize": 0.22,
        "labelSize": 0.3,
        "labelRole": "hand",
        "directions": {
          "topLeft": [
            -1,
            -1
          ],
          "topRight": [
            1,
            -1
          ],
          "bottomLeft": [
            -1,
            1
          ],
          "bottomRight": [
            1,
            1
          ],
          "left": [
            -1,
            0
          ],
          "right": [
            1,
            0
          ],
          "top": [
            0,
            -1
          ],
          "bottom": [
            0,
            1
          ]
        }
      }
    },
    "elbowArrow": {
      "intent": "Orthogonal elbow connector (legacy Elbow callout).",
      "extends": "arrow",
      "style": {
        "connector": "elbow",
        "from": "topRight"
      }
    },
    "curveArrow": {
      "intent": "Smooth curved connector (legacy Curve callout).",
      "extends": "arrow",
      "style": {
        "connector": "curve",
        "bend": 0.5,
        "from": "bottomLeft"
      }
    },
    "callout": {
      "intent": "Legacy callout: connector draws on, then a torn paper note card unfolds with the note text.",
      "kind": "callout",
      "delay": 0.2,
      "duration": 0.9,
      "ease": "handDrawn",
      "style": {
        "color": "@accent",
        "color2": "@ink",
        "thickness": 0.035,
        "offset": [
          0.7,
          -1.1
        ],
        "textSize": 0.24,
        "textRole": "hand",
        "cardColor": "@paper",
        "cardEase": "wobbly"
      }
    },
    "counter": {
      "intent": "Numbers tick up from 0 (or a given start) to the written value.",
      "kind": "counter",
      "delay": 0,
      "duration": 1.3,
      "ease": "smoothOut"
    },
    "icon": {
      "intent": "Icon sticker pops beside the phrase and keeps a gentle wiggle.",
      "kind": "icon",
      "delay": 0.1,
      "duration": 0.6,
      "ease": "springy",
      "style": {
        "color": "@accent",
        "size": 0.8,
        "at": "right",
        "gap": 0.3,
        "chipColor": "@paper",
        "wiggle": 5,
        "wiggleSpeed": 3,
        "spinIn": -60
      }
    },
    "burst": {
      "intent": "Comic-style radial burst lines that shoot out and retract.",
      "kind": "burst",
      "delay": 0,
      "duration": 0.6,
      "ease": "snappy",
      "style": {
        "color": "@accent3",
        "rays": 12,
        "length": 0.4,
        "gap": 0.1,
        "thickness": 0.05,
        "squash": 0.6,
        "shadow": false
      }
    },
    "sparkle": {
      "intent": "Twinkling four-point sparkles around the phrase until it exits.",
      "kind": "sparkle",
      "delay": 0.1,
      "duration": 0.4,
      "ease": "overshoot",
      "style": {
        "color": "@accent3",
        "count": 6,
        "size": 0.14,
        "speed": 5
      }
    },
    "badge": {
      "intent": "Numbered badge (legacy annotationBadge) spins in beside the phrase.",
      "kind": "badge",
      "delay": 0,
      "duration": 0.55,
      "ease": "springy",
      "style": {
        "color": "@accent",
        "textColor": "@paper",
        "radius": 0.36,
        "at": "left",
        "y": 0.25,
        "textSize": 1.05,
        "textRole": "display"
      }
    },
    "threshold": {
      "intent": "Long dashed threshold line sweeps out (legacy XY threshold).",
      "kind": "threshold",
      "layer": "under",
      "delay": 0.05,
      "duration": 0.7,
      "ease": "glide",
      "style": {
        "color": "@accent2",
        "thickness": 0.03,
        "span": 7,
        "dash": [
          0.18,
          0.1
        ],
        "at": 1.18,
        "shadow": false
      }
    },
    "stamp": {
      "intent": "Rubber stamp (e.g. NEW, WOW) slams onto the corner.",
      "kind": "stamp",
      "delay": 0.1,
      "duration": 0.45,
      "ease": "stiffSpring",
      "style": {
        "color": "@accent",
        "size": 0.3,
        "rotate": -12,
        "x": 1.02,
        "y": -0.1,
        "fromScale": 2.8,
        "opacity": 0.9
      }
    },
    "label": {
      "intent": "Small handwritten label under the phrase (legacy annotationLabel note).",
      "kind": "label",
      "delay": 0.15,
      "duration": 0.5,
      "ease": "springy",
      "style": {
        "color": "@accent2",
        "size": 0.3,
        "at": "below",
        "rotate": -2
      }
    },
    "ring": {
      "intent": "Progress ring that fills to the percentage around a number.",
      "kind": "ring",
      "delay": -0.4,
      "duration": 1.3,
      "ease": "smoothOut",
      "style": {
        "color": "@accent",
        "color2": "@ink",
        "thickness": 0.1,
        "radius": 0.62,
        "shadow": false
      }
    },
    "bar": {
      "intent": "Mini bar under a number that grows to value / max (arg = max).",
      "kind": "bar",
      "delay": -0.3,
      "duration": 1.2,
      "ease": "smoothOut",
      "style": {
        "color": "@accent3",
        "color2": "@ink",
        "height": 0.12,
        "at": 1.12,
        "shadow": false
      }
    },
    "shapeWipe": {
      "intent": "Full-frame accent shape swipes across behind the words for a beat change.",
      "kind": "shapeWipe",
      "screen": true,
      "delay": -0.6,
      "duration": 0.6,
      "ease": "swipe",
      "style": {
        "color": "@accent3",
        "band": 0.5,
        "skew": 16,
        "opacity": 0.9
      }
    }
  },
  "annotationTypes": {
    "_about": "Maps your existing D3 Annotation Studio typeKeys onto kinetic behaviour. titleTags/labelTags/bulletTags are inline tag strings (templated with {badgeText} {index} {title} …) used when a whole annotation becomes a scene. supplement is used when a legacy node is attached to a native beat via beat.annotations.",
    "annotationLabel": {
      "intent": "Plain label → underlined headline.",
      "titleTags": "underline",
      "supplement": "label",
      "labelLayout": "centered",
      "labelRole": "body"
    },
    "annotationCallout": {
      "intent": "Straight callout → headline pointed at by an arrow.",
      "titleTags": "arrow",
      "supplement": "callout",
      "labelRole": "body",
      "bulletTags": "done"
    },
    "annotationCalloutElbow": {
      "intent": "Elbow callout → elbow connector arrow.",
      "titleTags": "elbowArrow",
      "supplement": [
        "callout"
      ],
      "labelRole": "body"
    },
    "annotationCalloutCurve": {
      "intent": "Curve callout → curved connector arrow.",
      "titleTags": "curveArrow",
      "supplement": [
        "callout"
      ],
      "labelRole": "body"
    },
    "annotationCalloutCircle": {
      "intent": "Circle target → pen circle around the headline.",
      "titleTags": "circle",
      "supplement": [
        "circle",
        "label"
      ],
      "labelRole": "body"
    },
    "annotationCalloutRect": {
      "intent": "Rect target → rough box around the headline.",
      "titleTags": "box",
      "supplement": [
        "box",
        "label"
      ],
      "labelRole": "body"
    },
    "annotationXYThreshold": {
      "intent": "Threshold → sweeping dashed line under the headline.",
      "titleTags": "threshold",
      "supplement": "threshold",
      "labelRole": "body"
    },
    "annotationBadge": {
      "intent": "Badge → numbered badge spinning in beside the headline.",
      "titleTags": "badge:{badgeText}",
      "supplement": "badge",
      "args": [
        "{badgeText}"
      ],
      "labelRole": "body",
      "bulletTags": ""
    },
    "__default": {
      "intent": "Anything unknown → underline.",
      "titleTags": "underline",
      "supplement": "underline",
      "labelRole": "body"
    }
  },
  "transitions": {
    "_about": "Scene-to-scene transitions. Never a hard cut or crossfade. type = compositor primitive; other keys are its parameters.",
    "paperWipe": {
      "intent": "A torn paper sheet slides across the frame, carrying the next scene behind it.",
      "type": "paperWipe",
      "duration": 0.9,
      "ease": "cameraMove",
      "angle": 10,
      "band": 0.14,
      "color": "@accent"
    },
    "paperWipeDiagonal": {
      "intent": "Steeper diagonal paper wipe for more energy.",
      "type": "paperWipe",
      "duration": 0.8,
      "ease": "whip",
      "angle": 28,
      "band": 0.18,
      "color": "@accent3"
    },
    "iris": {
      "intent": "Iris opens from the last word the viewer was looking at.",
      "type": "iris",
      "duration": 0.9,
      "ease": "cameraMove",
      "ring": 22,
      "color": "@accent"
    },
    "matchCut": {
      "intent": "Accent blob grows out of the focal word, fills the frame, and opens onto the next scene (colour match-cut).",
      "type": "matchCut",
      "duration": 1,
      "ease": "glide",
      "color": "@accent2"
    },
    "fold": {
      "intent": "The scene folds away like a turning page, casting a shadow on the next one.",
      "type": "fold",
      "duration": 0.9,
      "ease": "glide",
      "axis": "x"
    },
    "foldUp": {
      "intent": "Vertical page fold (flip-chart).",
      "type": "fold",
      "duration": 0.9,
      "ease": "glide",
      "axis": "y"
    },
    "flyThrough": {
      "intent": "Camera flies through the current plane into the next scene arriving from depth.",
      "type": "flyThrough",
      "duration": 0.85,
      "ease": "whip",
      "inScale": 0.5,
      "outScale": 3.4,
      "blur": 12,
      "fadePower": 1.4
    },
    "push": {
      "intent": "Next scene pushes the current one off-screen, paper edge to paper edge.",
      "type": "push",
      "duration": 0.8,
      "ease": "cameraMove",
      "direction": -1
    },
    "shutter": {
      "intent": "Paper venetian slats flip over one after another to the next scene.",
      "type": "shutter",
      "duration": 1,
      "ease": "smoothOut",
      "bands": 7,
      "stagger": 0.55,
      "color": "@paper2"
    },
    "tear": {
      "intent": "The scene rips down a jagged seam and the halves pull apart.",
      "type": "tear",
      "duration": 1,
      "ease": "cameraMove",
      "color": "@paper"
    }
  },
  "backgrounds": {
    "_about": "Kinetic backgrounds made of camera-space layers, so they parallax with the camera. Layer types: paperPlanes, confetti, sunburst, dots, grid, blobs.",
    "paperStack": {
      "intent": "Large torn paper sheets floating at several depths — the default paper-craft world.",
      "color": "@paper",
      "layers": [
        {
          "type": "blobs",
          "count": 4,
          "colors": [
            "@paper2"
          ],
          "opacity": 0.7
        },
        {
          "type": "paperPlanes",
          "count": 8,
          "depth": [
            2600,
            5600
          ],
          "size": [
            0.14,
            0.32
          ],
          "colors": [
            "@strip[0]",
            "@strip[1]",
            "@strip[2]",
            "@strip[3]"
          ],
          "opacity": 0.38,
          "torn": 0.9,
          "rotJitter": 26,
          "drift": 14
        },
        {
          "type": "confetti",
          "count": 18,
          "depth": [
            900,
            3600
          ],
          "size": [
            10,
            22
          ],
          "colors": [
            "@accent",
            "@accent2",
            "@accent3"
          ],
          "shapes": [
            "rect",
            "circle",
            "tri"
          ],
          "opacity": 0.8,
          "fall": 26,
          "spin": 60
        }
      ]
    },
    "confettiParty": {
      "intent": "Celebratory: lots of confetti, some so close to the lens it is out of focus.",
      "color": "@paper",
      "layers": [
        {
          "type": "paperPlanes",
          "count": 5,
          "depth": [
            2600,
            5000
          ],
          "size": [
            0.2,
            0.45
          ],
          "colors": [
            "@paper2",
            "@strip[1]"
          ],
          "opacity": 0.5
        },
        {
          "type": "confetti",
          "count": 70,
          "depth": [
            380,
            4200
          ],
          "size": [
            8,
            20
          ],
          "colors": [
            "@accent",
            "@accent2",
            "@accent3",
            "@strip[1]",
            "@strip[2]"
          ],
          "shapes": [
            "rect",
            "circle",
            "tri",
            "squiggle"
          ],
          "fall": 60,
          "sway": 40,
          "spin": 120,
          "nearBlurDepth": 900
        }
      ]
    },
    "sunburst": {
      "intent": "Slowly rotating retro sunburst with a halftone dot layer for pop energy.",
      "color": "@paper",
      "layers": [
        {
          "type": "sunburst",
          "rays": 22,
          "speed": 5,
          "opacity": 0.45,
          "color": "@paper2",
          "depth": 4000
        },
        {
          "type": "dots",
          "depth": 2600,
          "spacing": 70,
          "radius": 3.5,
          "opacity": 0.18,
          "color": "@ink"
        }
      ]
    },
    "blueprint": {
      "intent": "Technical blueprint grid — good for science / how-it-works scenes.",
      "color": "@paper",
      "layers": [
        {
          "type": "grid",
          "depth": 2600,
          "spacing": 110,
          "opacity": 0.22,
          "color": "@ink",
          "width": 1.2
        },
        {
          "type": "grid",
          "depth": 4200,
          "spacing": 330,
          "opacity": 0.14,
          "color": "@ink",
          "width": 2
        },
        {
          "type": "confetti",
          "count": 10,
          "depth": [
            1400,
            3600
          ],
          "size": [
            6,
            12
          ],
          "colors": [
            "@accent"
          ],
          "shapes": [
            "circle"
          ],
          "fall": 10,
          "opacity": 0.6
        }
      ]
    },
    "quietPaper": {
      "intent": "Calm: soft blobs and faint dots only — for reflective beats.",
      "color": "@paper",
      "gradient": {
        "to": "@paper2"
      },
      "layers": [
        {
          "type": "blobs",
          "count": 5,
          "colors": [
            "@paper2",
            "@strip[4]"
          ],
          "opacity": 0.6
        },
        {
          "type": "dots",
          "depth": 3000,
          "spacing": 90,
          "radius": 3,
          "opacity": 0.12,
          "color": "@ink"
        }
      ]
    }
  },
  "themes": {
    "paperWhimsy": {
      "intent": "Warm craft-paper palette, bouncy rounded display type, hand-written notes.",
      "palette": {
        "paper": "#F7F1E3",
        "paper2": "#EBDFC6",
        "ink": "#2A2733",
        "accent": "#FF5A4E",
        "accent2": "#2F7BD9",
        "accent3": "#FFB627",
        "highlight": "#FFE066",
        "shadow": "rgba(70,45,20,0.30)",
        "back": "#E8D8BA",
        "strip": [
          "#FFD166",
          "#7FD8BE",
          "#FF9EAA",
          "#9CC9FF",
          "#FFFFFF"
        ]
      },
      "typography": {
        "defaultRole": "display",
        "display": {
          "family": "Baloo 2",
          "weight": 800,
          "fallback": "sans-serif"
        },
        "body": {
          "family": "Outfit",
          "weight": 600,
          "fallback": "sans-serif"
        },
        "hand": {
          "family": "Caveat",
          "weight": 700,
          "fallback": "\"Kalam\", cursive"
        },
        "data": {
          "family": "Baloo 2",
          "weight": 800,
          "fallback": "sans-serif"
        },
        "deva": {
          "family": "Noto Sans Devanagari",
          "weight": 700,
          "fallback": "sans-serif",
          "intent": "Loaded as a fallback so Hindi renders in every role."
        },
        "handDeva": {
          "family": "Kalam",
          "weight": 700,
          "fallback": "cursive",
          "intent": "Handwritten Devanagari fallback."
        },
        "scriptFallback": "\"Noto Sans Devanagari\", \"Kalam\", \"Hind\"",
        "emojiFallback": "\"Apple Color Emoji\", \"Segoe UI Emoji\", \"Noto Color Emoji\"",
        "minSize": 48,
        "maxSize": 270,
        "lineHeight": 0.98,
        "ascent": 0.74,
        "descent": 0.24,
        "tracking": 0,
        "wordSpacing": 1,
        "caps": false
      },
      "material": {
        "shadow": {
          "color": "@shadow",
          "blur": 6,
          "distance": 4,
          "liftScale": 0.5,
          "liftBlur": 0.4
        },
        "extrude": {
          "depth": 3,
          "steps": 2,
          "color": "auto"
        },
        "grain": {
          "amount": 0.08,
          "fps": 12,
          "blend": "overlay",
          "scale": 1
        },
        "vignette": {
          "amount": 0.22,
          "inner": 0.45,
          "color": "@shadow"
        },
        "light": {
          "x": 0.35,
          "y": 0.55,
          "z": 0.75
        },
        "shadeStrength": 0.55,
        "shadeAmount": 0.25,
        "textLift": 6
      },
      "camera": {
        "fov": 40,
        "framingZoom": 1.12,
        "near": 40,
        "handheld": {
          "amp": {
            "rotX": 0.25,
            "rotY": 0.35,
            "rotZ": 0.2,
            "tx": 4,
            "ty": 4
          },
          "freq": 0.35
        },
        "drift": {
          "dist": -90,
          "rotY": 2
        },
        "driftEase": "drift",
        "driftRef": 3,
        "establish": {
          "zoom": 1.9,
          "rotX": -18,
          "rotY": 24,
          "ty": -200
        },
        "angleJitter": {
          "rotY": 6,
          "rotX": 3,
          "rotZ": 2
        },
        "aperture": 0.6,
        "dofScale": 1,
        "maxDof": 10,
        "motionBlur": 1,
        "maxMotionBlur": 8,
        "motionBlurScale": 0.03
      },
      "timing": {
        "wordsPerSecond": 3.2,
        "minShot": 0.7,
        "shotHold": 0.3,
        "beatGap": 0.2,
        "sceneLead": 0.25,
        "sceneTail": 0.9,
        "entryAtCamera": 0.45,
        "emphasisDelay": 0.1,
        "emphasisChain": 0.7,
        "emphasisBlocking": 0.4,
        "exitDelay": 0.35,
        "voiceLead": 0.25,
        "voiceTail": 0.25,
        "voiceAnticipation": 0.1,
        "maxVoiceSqueeze": 2.2,
        "maxCaptionWords": 16
      },
      "fragment": {
        "maxWordsPerShot": 3,
        "minWordsPerShot": 1,
        "isolateTags": [
          "big",
          "huge",
          "counter",
          "sticker",
          "stamp"
        ],
        "complexScript": "word"
      },
      "numbers": {
        "locale": "en-US",
        "numerals": null
      },
      "layout": {
        "shotWidth": 0.7,
        "shotHeight": 0.6,
        "maxLines": 3,
        "portraitWidth": 0.88,
        "portraitHeight": 0.6,
        "portraitExtraLines": 1
      },
      "defaults": {
        "entry": "popUp",
        "entryCycle": [
          "popUp",
          "foldDown",
          "tumbleIn",
          "flipIn",
          "squashStretch",
          "dropBounce",
          "popUpBook",
          "slideSkew",
          "zoomThrough",
          "anticipateRise",
          "spinIn",
          "stampIn"
        ],
        "exit": "fadeBack",
        "idle": "paperBoil",
        "cameraMoves": [
          "pushIn",
          "whipPan",
          "orbitLeft",
          "craneDown",
          "dutchRoll",
          "rackFocus",
          "orbitRight",
          "snapZoom",
          "tiltUp",
          "dollyZoom",
          "floatOver"
        ],
        "stagingCycle": [
          "zigzag",
          "stairs",
          "ring",
          "stack",
          "scatter3d",
          "spiral"
        ],
        "layoutCycle": [
          "lockupStrips",
          "centered",
          "lockup",
          "stickers",
          "cascade",
          "banner"
        ],
        "transitionCycle": [
          "paperWipe",
          "iris",
          "fold",
          "flyThrough",
          "matchCut",
          "shutter",
          "tear",
          "push",
          "paperWipeDiagonal",
          "foldUp"
        ],
        "backgroundCycle": [
          "paperStack",
          "sunburst",
          "confettiParty",
          "blueprint",
          "quietPaper"
        ]
      }
    },
    "blueprintLab": {
      "intent": "Deep blueprint blue with chalk-white ink — science & engineering explainers.",
      "extends": "paperWhimsy",
      "palette": {
        "paper": "#173A63",
        "paper2": "#1E4A7C",
        "ink": "#F4F7FB",
        "accent": "#FFD447",
        "accent2": "#66E3FF",
        "accent3": "#FF7AA2",
        "highlight": "#2F6DB0",
        "shadow": "rgba(0,10,30,0.45)",
        "back": "#0F2A49",
        "strip": [
          "#24598F",
          "#2B6AA8",
          "#1B4B7E",
          "#3478BF",
          "#20507F"
        ]
      },
      "typography": {
        "display": {
          "family": "Outfit",
          "weight": 800
        },
        "body": {
          "family": "Outfit",
          "weight": 500
        },
        "hand": {
          "family": "Kalam",
          "weight": 700
        },
        "caps": true
      },
      "material": {
        "grain": {
          "amount": 0.06,
          "fps": 12,
          "blend": "soft-light"
        },
        "vignette": {
          "amount": 0.35
        },
        "extrude": {
          "depth": 2,
          "steps": 1,
          "color": "auto"
        }
      },
      "defaults": {
        "backgroundCycle": [
          "blueprint",
          "quietPaper"
        ]
      }
    },
    "nightCraft": {
      "intent": "Dark paper with neon cut-outs — punchy product / marketing videos.",
      "extends": "paperWhimsy",
      "palette": {
        "paper": "#1C1A24",
        "paper2": "#26232F",
        "ink": "#FFF6E9",
        "accent": "#FF4D8D",
        "accent2": "#3DDCFF",
        "accent3": "#C6FF4D",
        "highlight": "#6A2C8C",
        "shadow": "rgba(0,0,0,0.6)",
        "back": "#312C3D",
        "strip": [
          "#FF4D8D",
          "#3DDCFF",
          "#C6FF4D",
          "#FFB627",
          "#8F7BFF"
        ]
      },
      "typography": {
        "display": {
          "family": "Poppins",
          "weight": 800
        },
        "body": {
          "family": "Poppins",
          "weight": 600
        },
        "hand": {
          "family": "Caveat",
          "weight": 700
        }
      },
      "material": {
        "grain": {
          "amount": 0.09,
          "fps": 12,
          "blend": "overlay"
        },
        "vignette": {
          "amount": 0.45
        }
      },
      "defaults": {
        "backgroundCycle": [
          "confettiParty",
          "sunburst",
          "paperStack"
        ]
      }
    },
    "pastelNotebook": {
      "intent": "Soft pastel notebook — tutorials, education, calm narration.",
      "extends": "paperWhimsy",
      "palette": {
        "paper": "#FBF8F2",
        "paper2": "#EEF1F7",
        "ink": "#33415C",
        "accent": "#F28482",
        "accent2": "#5E9ED6",
        "accent3": "#84A59D",
        "highlight": "#FFE5A3",
        "shadow": "rgba(40,50,80,0.22)",
        "back": "#E4E8F0",
        "strip": [
          "#F6BD60",
          "#B8E0D2",
          "#F5CAC3",
          "#CDE7FF",
          "#FFFFFF"
        ]
      },
      "typography": {
        "display": {
          "family": "Fredoka",
          "weight": 700
        },
        "body": {
          "family": "Nunito",
          "weight": 700
        },
        "hand": {
          "family": "Caveat",
          "weight": 700
        }
      },
      "timing": {
        "wordsPerSecond": 2.8
      },
      "defaults": {
        "entryCycle": [
          "popUpBook",
          "foldDown",
          "popUp",
          "anticipateRise"
        ],
        "backgroundCycle": [
          "quietPaper",
          "paperStack",
          "blueprint"
        ]
      }
    }
  },
  "recipes": {
    "_about": "Recipes bundle motion choices under a meaning. Use \"recipe\": \"definition\" on a beat (or scene), or let the Auto-Director pick one with auto.recipeRules. Explicit beat fields always win. Keys: entry, emphasis, exit, idle, layout, staging, cameraMoves, split, strip, role, speed, captionLayout, tags; on scenes also background, transition, outro, exitMode, palette.",
    "title": {
      "intent": "Opening title: letters drop in, arched banner, gentle float.",
      "entry": "dropBounce",
      "emphasis": "wiggle",
      "layout": "arc",
      "cameraMoves": [
        "pushIn"
      ],
      "idle": "float",
      "split": "sentence"
    },
    "definition": {
      "intent": "A term and its meaning: calm fold-down on paper strips, rack focus onto the phrase.",
      "entry": "foldDown",
      "emphasis": "pulse",
      "layout": "lockupStrips",
      "cameraMoves": [
        "rackFocus",
        "pushIn"
      ],
      "split": "phrase"
    },
    "question": {
      "intent": "A question to the viewer: anticipation rise, playful Dutch angle, wiggle.",
      "entry": "anticipateRise",
      "emphasis": "wiggle",
      "layout": "centered",
      "cameraMoves": [
        "dutchRoll",
        "snapZoom"
      ]
    },
    "warning": {
      "intent": "A caution or common mistake: stamp in, shake, punchy snap zoom.",
      "entry": "stampIn",
      "emphasis": "shake",
      "layout": "banner",
      "cameraMoves": [
        "snapZoom"
      ],
      "idle": "boilStrong"
    },
    "step": {
      "intent": "A step in a process: slides in, climbs the staircase staging.",
      "entry": "slideSkew",
      "layout": "lockupStrips",
      "staging": "stairs",
      "cameraMoves": [
        "whipPan",
        "craneDown"
      ]
    },
    "stat": {
      "intent": "A number that matters: rush in from depth, pulse, crash zoom.",
      "entry": "zoomThrough",
      "emphasis": "pulse",
      "layout": "centered",
      "cameraMoves": [
        "snapZoom",
        "pushIn"
      ]
    },
    "example": {
      "intent": "An example: cards flip in along a cascade, orbiting camera.",
      "entry": "flipIn",
      "layout": "cascade",
      "cameraMoves": [
        "orbitRight",
        "orbitLeft"
      ]
    },
    "quote": {
      "intent": "A quotation or aside: typewriter in handwriting, lazy float camera.",
      "entry": "typewriter",
      "layout": "handNote",
      "role": "hand",
      "cameraMoves": [
        "floatOver"
      ]
    },
    "summary": {
      "intent": "A recap: pop-up-book letters on stickers, hopping emphasis, orbit.",
      "entry": "popUpBook",
      "emphasis": "jump",
      "layout": "stickers",
      "cameraMoves": [
        "orbitLeft",
        "pushIn"
      ]
    }
  },
  "geo": {
    "_about": "Map plug-in (geo.js). Styles use palette tokens; timing in seconds. Place markers honour your annotation typeKeys.",
    "defaultStyle": "paper",
    "width": 0.82,
    "aspect": 1.6,
    "timing": {
      "intro": 0.9,
      "fly": 1.5,
      "highlight": 0.6,
      "markerStagger": 0.3,
      "route": 1.3,
      "hold": 1.4
    },
    "styles": {
      "paper": {
        "intent": "Craft-paper world: cream land on blue-grey sea, ink borders, accent country, pins with ripple.",
        "water": "#CFE3EA",
        "land": "@paper",
        "border": "@ink",
        "borderOpacity": 0.45,
        "highlight": "@accent",
        "highlight2": "@accent2",
        "outline": "@ink",
        "outlineWidth": 2.4,
        "graticule": true,
        "graticuleOpacity": 0.08,
        "tilt": 22,
        "tiltDrift": 1.2,
        "flyEase": "glide",
        "flyBump": 1,
        "focusPad": 0.3,
        "minSpan": 10,
        "marker": "@accent",
        "marker2": "@accent2",
        "markerSize": 0.032,
        "labelSize": 0.062,
        "route": "@accent",
        "routeWidth": 4,
        "routeArc": 0.18,
        "routeIcon": "✈️",
        "titleChip": "@accent",
        "titleInk": "@paper",
        "autoRegions": true,
        "regionOpacity": 0.4,
        "regionBorder": "@ink",
        "regionHighlight": "@accent3",
        "rampLow": "@highlight",
        "rampHigh": "@accent",
        "hideAntarctica": true,
        "projection": "naturalEarth",
        "torn": 0.4
      },
      "blueprint": {
        "intent": "Technical blueprint map.",
        "extends": "paper",
        "water": "@paper2",
        "land": "@paper",
        "border": "@ink",
        "borderOpacity": 0.7,
        "graticuleOpacity": 0.18,
        "highlight": "@accent",
        "labelChip": "@paper2"
      },
      "night": {
        "intent": "Dark globe with glowing accent.",
        "water": "#101820",
        "land": "#2A2F3A",
        "border": "#8A93A6",
        "borderOpacity": 0.5,
        "graticuleColor": "#8A93A6",
        "graticuleOpacity": 0.12,
        "highlight": "@accent",
        "labelChip": "#2A2F3A",
        "labelInk": "#FFFFFF"
      }
    },
    "placeStopwords": [
      "of",
      "in",
      "to",
      "the",
      "and",
      "is",
      "it",
      "a",
      "me",
      "we",
      "one",
      "nice",
      "mobile",
      "reading",
      "bath",
      "split",
      "gold",
      "sale",
      "union",
      "victoria",
      "hope",
      "moral",
      "police",
      "university",
      "university of",
      "central",
      "orange",
      "surprise",
      "bow",
      "sagar",
      "mau",
      "puri",
      "bally",
      "bhind"
    ]
  },
  "media": {
    "_about": "Media plug-in (media.js): picture frames, entries and SVG vector animation modes.",
    "imageWidth": 0.52,
    "svgWidth": 0.6,
    "maxHeight": 0.62,
    "imageDuration": 3,
    "maxSvgDuration": 7,
    "hold": 1.4,
    "kenBurns": true,
    "defaultFrame": "polaroid",
    "defaultEntry": "drop",
    "frames": {
      "polaroid": {
        "intent": "White instant-photo frame with a handwritten caption strip.",
        "color": "#FFFFFF",
        "pad": 0.05,
        "padBottom": 0.18,
        "tilt": 5,
        "torn": 0.05,
        "labelSize": 0.085
      },
      "paper": {
        "intent": "Torn-paper cut-out.",
        "color": "@paper",
        "pad": 0.03,
        "tilt": 3,
        "torn": 0.6
      },
      "tape": {
        "intent": "Photo taped to the page with washi tape.",
        "color": "#FFFFFF",
        "pad": 0.035,
        "tilt": 4,
        "torn": 0.1,
        "tape": "@strip[1]"
      },
      "circle": {
        "intent": "Round cut-out (portraits, planets).",
        "color": "#FFFFFF",
        "pad": 0.04,
        "tilt": 0
      },
      "sticker": {
        "intent": "Round paper sticker for emoji / icons.",
        "color": "@paper",
        "pad": 0.1,
        "tilt": 6
      },
      "none": {
        "intent": "No frame — for SVG diagrams.",
        "tilt": 0,
        "pad": 0
      }
    },
    "entries": {
      "drop": {
        "intent": "Falls onto the page and settles with a wobble.",
        "duration": 0.85,
        "ease": "wobbly",
        "y": -0.7,
        "rotZ": -14
      },
      "flip": {
        "intent": "Flips over like a card.",
        "duration": 0.8,
        "ease": "overshoot",
        "y": 0,
        "rotY": 180,
        "rotZ": 0
      },
      "unfold": {
        "intent": "Unfolds from the top edge.",
        "duration": 0.8,
        "ease": "springy",
        "y": 0,
        "rotX": -95,
        "rotZ": 0
      },
      "zoom": {
        "intent": "Grows from small with a spring.",
        "duration": 0.7,
        "ease": "springy",
        "y": 0,
        "scale": 0.3,
        "rotZ": 8
      },
      "slide": {
        "intent": "Slides in from the side.",
        "duration": 0.7,
        "ease": "snappy",
        "x": -0.9,
        "y": 0,
        "rotZ": -4
      }
    },
    "svgPresets": {
      "draw": {
        "intent": "Line-art draws on part by part like a pen, fills fade in behind.",
        "mode": "draw",
        "each": 0.07,
        "duration": 0.9,
        "fillDuration": 0.6,
        "order": "document",
        "maxStagger": 3
      },
      "strokeThenFill": {
        "intent": "Classic explainer: sketch every shape in ink, then colour it in.",
        "mode": "strokeThenFill",
        "each": 0.06,
        "duration": 0.8,
        "fillDuration": 0.5,
        "order": "top-down",
        "maxStagger": 3,
        "sketchWidth": 2.2
      },
      "pop": {
        "intent": "Parts pop in with a spring, biggest first.",
        "mode": "pop",
        "each": 0.12,
        "duration": 0.6,
        "order": "size",
        "ease": "springy"
      },
      "build": {
        "intent": "Parts rise into place from below, top to bottom.",
        "mode": "build",
        "each": 0.08,
        "duration": 0.6,
        "order": "top-down",
        "ease": "overshoot"
      },
      "assemble": {
        "intent": "Parts fly in from scattered positions and assemble.",
        "mode": "assemble",
        "each": 0.05,
        "duration": 0.9,
        "order": "random",
        "ease": "overshoot"
      },
      "fade": {
        "intent": "Gentle cross-fade, centre outwards.",
        "mode": "fade",
        "each": 0.04,
        "duration": 0.6,
        "order": "center-out"
      }
    },
    "svgLoops": {
      "spin": {
        "type": "spin",
        "speed": 1
      },
      "pulse": {
        "type": "pulse",
        "speed": 1.2,
        "amount": 0.07
      },
      "float": {
        "type": "float",
        "speed": 1,
        "amount": 5
      },
      "wiggle": {
        "type": "wiggle",
        "speed": 1,
        "amount": 5
      },
      "blink": {
        "type": "blink",
        "speed": 1
      }
    }
  },
  "charts": {
    "_about": "Chart plug-in (charts.js).",
    "width": 0.74,
    "aspect": 1.65,
    "timing": {
      "intro": 0.6,
      "stagger": 0.22,
      "grow": 1.1,
      "hold": 1.8
    },
    "style": {
      "colors": [
        "@accent2",
        "@accent3",
        "@strip[1]",
        "@strip[2]",
        "@strip[3]",
        "@accent"
      ],
      "growEase": "springy",
      "cardColor": "@paper",
      "maxIcons": 10
    }
  },
  "auto": {
    "_about": "Auto-Director (director.js). Each switch: on | off | smart.",
    "defaults": {
      "maps": "smart",
      "charts": "smart",
      "numbers": "on",
      "media": "smart",
      "placeholders": "off",
      "emoji": "smart",
      "emphasis": "smart",
      "recipes": "smart",
      "mapLabels": "auto"
    },
    "recipeRules": [
      {
        "recipe": "question",
        "match": "[?？]\\s*$|^(what|why|how|when|where|who|which)\\b|^(क्या|क्यों|कैसे|कब|कहाँ|कौन)(\\s|$)",
        "intent": "Questions (English and Hindi)."
      },
      {
        "recipe": "definition",
        "match": "\\b(is called|is defined as|means|refers to|is known as)\\b|कहते हैं|कहलात|का अर्थ|अर्थात",
        "intent": "Definitions."
      },
      {
        "recipe": "warning",
        "match": "\\b(never|do not|don't|avoid|warning|danger|careful|mistake)\\b|सावधान|कभी नहीं|गलती|ध्यान रखें",
        "intent": "Cautions and common mistakes."
      },
      {
        "recipe": "step",
        "match": "^(step \\d+|first|second|third|next|then|finally)\\b|^(पहला|दूसरा|तीसरा|पहले|फिर|इसके बाद|अंत में)(\\s|,)",
        "intent": "Steps of a process."
      },
      {
        "recipe": "example",
        "match": "\\b(for example|e\\.g\\.|such as|for instance)\\b|उदाहरण|जैसे कि",
        "intent": "Examples."
      },
      {
        "recipe": "summary",
        "match": "^(so|in short|to sum up|in summary|therefore|remember)\\b|^(इसलिए|सारांश|याद रखें)(\\s|,)",
        "intent": "Recaps and conclusions."
      },
      {
        "recipe": "quote",
        "match": "^[\"“‘']",
        "intent": "Quotations."
      }
    ],
    "titleRecipe": "title",
    "odometerFrom": 1000,
    "emojiPerScene": 2,
    "emphasisCycle": [
      "em",
      "highlight",
      "underline",
      "em circle"
    ],
    "routeWords": [
      "from",
      "to",
      "towards",
      "between",
      "via",
      "से",
      "तक",
      "की ओर",
      "होते हुए"
    ],
    "stopwords": [
      "this",
      "that",
      "these",
      "those",
      "there",
      "their",
      "which",
      "where",
      "when",
      "what",
      "because",
      "about",
      "would",
      "could",
      "should",
      "every",
      "other",
      "while",
      "after",
      "before",
      "through",
      "यह",
      "वह",
      "ये",
      "वे",
      "इस",
      "उस",
      "इसलिए",
      "क्योंकि",
      "लेकिन",
      "जब",
      "तब",
      "कुछ",
      "सभी",
      "बहुत",
      "होता",
      "होती",
      "होते",
      "करता",
      "करती",
      "करते",
      "रहा",
      "रही",
      "रहे",
      "गया",
      "गई",
      "गए",
      "दिया",
      "लिया"
    ],
    "emojiKeywords": {
      "water": "💧",
      "पानी": "💧",
      "rain": "🌧️",
      "बारिश": "🌧️",
      "sun": "☀️",
      "सूरज": "☀️",
      "सूर्य": "☀️",
      "moon": "🌙",
      "चाँद": "🌙",
      "चंद्रमा": "🌙",
      "earth": "🌍",
      "पृथ्वी": "🌍",
      "धरती": "🌍",
      "world": "🌍",
      "दुनिया": "🌍",
      "fire": "🔥",
      "आग": "🔥",
      "tree": "🌳",
      "पेड़": "🌳",
      "plant": "🌱",
      "पौधा": "🌱",
      "flower": "🌸",
      "फूल": "🌸",
      "forest": "🌲",
      "जंगल": "🌲",
      "mountain": "⛰️",
      "पहाड़": "⛰️",
      "पर्वत": "⛰️",
      "river": "🏞️",
      "नदी": "🏞️",
      "ocean": "🌊",
      "sea": "🌊",
      "समुद्र": "🌊",
      "sagar": "🌊",
      "book": "📚",
      "किताब": "📚",
      "पुस्तक": "📚",
      "school": "🏫",
      "स्कूल": "🏫",
      "विद्यालय": "🏫",
      "student": "🧑‍🎓",
      "छात्र": "🧑‍🎓",
      "teacher": "🧑‍🏫",
      "शिक्षक": "🧑‍🏫",
      "idea": "💡",
      "विचार": "💡",
      "question": "❓",
      "प्रश्न": "❓",
      "सवाल": "❓",
      "money": "💰",
      "पैसा": "💰",
      "rupee": "₹",
      "रुपये": "💰",
      "time": "⏰",
      "समय": "⏰",
      "heart": "❤️",
      "दिल": "❤️",
      "हृदय": "❤️",
      "brain": "🧠",
      "दिमाग": "🧠",
      "मस्तिष्क": "🧠",
      "food": "🍎",
      "भोजन": "🍎",
      "खाना": "🍎",
      "apple": "🍎",
      "सेब": "🍎",
      "car": "🚗",
      "गाड़ी": "🚗",
      "train": "🚆",
      "ट्रेन": "🚆",
      "रेल": "🚆",
      "plane": "✈️",
      "airplane": "✈️",
      "विमान": "✈️",
      "हवाई": "✈️",
      "rocket": "🚀",
      "रॉकेट": "🚀",
      "space": "🪐",
      "अंतरिक्ष": "🪐",
      "planet": "🪐",
      "ग्रह": "🪐",
      "star": "⭐",
      "तारा": "⭐",
      "electricity": "⚡",
      "बिजली": "⚡",
      "energy": "⚡",
      "ऊर्जा": "⚡",
      "computer": "💻",
      "कंप्यूटर": "💻",
      "phone": "📱",
      "फोन": "📱",
      "internet": "🌐",
      "इंटरनेट": "🌐",
      "science": "🔬",
      "विज्ञान": "🔬",
      "math": "➗",
      "गणित": "➗",
      "farmer": "🧑‍🌾",
      "किसान": "🧑‍🌾",
      "crop": "🌾",
      "फसल": "🌾",
      "wheat": "🌾",
      "गेहूं": "🌾",
      "rice": "🍚",
      "चावल": "🍚",
      "cow": "🐄",
      "गाय": "🐄",
      "tiger": "🐅",
      "बाघ": "🐅",
      "bird": "🐦",
      "पक्षी": "🐦",
      "fish": "🐟",
      "मछली": "🐟",
      "health": "🩺",
      "स्वास्थ्य": "🩺",
      "doctor": "🧑‍⚕️",
      "डॉक्टर": "🧑‍⚕️",
      "medicine": "💊",
      "दवा": "💊",
      "population": "👥",
      "जनसंख्या": "👥",
      "आबादी": "👥",
      "city": "🏙️",
      "शहर": "🏙️",
      "village": "🏡",
      "गाँव": "🏡",
      "गांव": "🏡",
      "gold": "🥇",
      "सोना": "🥇",
      "win": "🏆",
      "जीत": "🏆",
      "flag": "🚩",
      "झंडा": "🚩",
      "music": "🎵",
      "संगीत": "🎵",
      "art": "🎨",
      "कला": "🎨",
      "game": "🎮",
      "खेल": "🏏",
      "cricket": "🏏",
      "क्रिकेट": "🏏",
      "football": "⚽",
      "history": "📜",
      "इतिहास": "📜",
      "war": "⚔️",
      "युद्ध": "⚔️"
    }
  },
  "emoji": {
    "_about": "Emoji shortcodes usable anywhere in text: :rocket: → 🚀",
    "rocket": "🚀",
    "fire": "🔥",
    "star": "⭐",
    "sparkles": "✨",
    "heart": "❤️",
    "idea": "💡",
    "bulb": "💡",
    "book": "📚",
    "books": "📚",
    "earth": "🌍",
    "globe": "🌍",
    "india": "🇮🇳",
    "flag_in": "🇮🇳",
    "water": "💧",
    "sun": "☀️",
    "moon": "🌙",
    "check": "✅",
    "cross": "❌",
    "warning": "⚠️",
    "question": "❓",
    "clock": "⏰",
    "money": "💰",
    "chart": "📊",
    "up": "📈",
    "down": "📉",
    "pin": "📍",
    "plane": "✈️",
    "train": "🚆",
    "tree": "🌳",
    "brain": "🧠",
    "science": "🔬",
    "atom": "⚛️",
    "teacher": "🧑‍🏫",
    "student": "🧑‍🎓",
    "clap": "👏",
    "thumbsup": "👍",
    "wave": "👋",
    "party": "🎉",
    "trophy": "🏆",
    "target": "🎯",
    "zap": "⚡",
    "eyes": "👀",
    "point_right": "👉",
    "smile": "😊",
    "wow": "😮",
    "think": "🤔",
    "namaste": "🙏"
  },
  "icons": {
    "_about": "24×24 SVG path data, filled with even-odd. Add your own and reference with icon:name.",
    "star": "M12 2l2.9 6.9 7.1.6-5.4 4.7 1.7 7-6.3-3.9-6.3 3.9 1.7-7L2 9.5l7.1-.6z",
    "heart": "M12 21s-7.5-4.6-9.6-9.2C.9 8.2 3 4.5 6.6 4.5c2.2 0 3.7 1.3 4.4 2.6.7-1.3 2.2-2.6 4.4-2.6 3.6 0 5.7 3.7 4.2 7.3C19.5 16.4 12 21 12 21z",
    "bulb": "M12 2a7 7 0 0 0-4 12.7V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.3A7 7 0 0 0 12 2zM9 19.5h6V21a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 21z",
    "check": "M9.5 17.2 4.3 12l1.8-1.8 3.4 3.4 8.4-8.4 1.8 1.8z",
    "cross": "M6.4 4.9 12 10.6l5.6-5.7 1.5 1.5-5.7 5.6 5.7 5.6-1.5 1.5-5.6-5.7-5.6 5.7-1.5-1.5 5.7-5.6-5.7-5.6z",
    "bolt": "M13 2 4 14h6l-1 8 9-12h-6z",
    "clock": "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2.2a7.8 7.8 0 1 1 0 15.6 7.8 7.8 0 0 1 0-15.6zM11 7v6.3l4.8 2.9 1-1.7-3.8-2.3V7z",
    "arrowRight": "M4 11h12.2l-5.6-5.6L12 4l8 8-8 8-1.4-1.4 5.6-5.6H4z",
    "pin": "M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 4.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z",
    "flag": "M5 3h2v18H5zM8 4h11l-2.5 4L19 12H8z",
    "chat": "M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10l-5 4v-4H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",
    "plane": "M2 11.5 22 3l-6.5 18-3.9-7.3zm9.8 1.6 2.4 4.6 3.7-10.3z",
    "cloud": "M7 19a5 5 0 0 1-.6-10A6.5 6.5 0 0 1 19 9.6 4.5 4.5 0 0 1 18 19z",
    "sun": "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM11 1h2v4h-2zm0 18h2v4h-2zM1 11h4v2H1zm18 0h4v2h-4zM4.2 5.6l1.4-1.4 2.8 2.8L7 8.4zm11.4 11.4 1.4-1.4 2.8 2.8-1.4 1.4zM4.2 18.4 7 15.6 8.4 17l-2.8 2.8zM15.6 7l2.8-2.8 1.4 1.4L17 8.4z",
    "rocket": "M12 2c3 2 5 6 5 10l2 3v4l-4-2H9l-4 2v-4l2-3c0-4 2-8 5-10zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
    "question": "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 15h2v2h-2zm4.1-7.8-.9.9c-.7.7-1.2 1.3-1.2 2.9h-2v-.5c0-1.1.5-2.1 1.2-2.8l1.2-1.3A2 2 0 1 0 10 9H8a4 4 0 1 1 7.1 1.2z",
    "target": "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 3a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 2.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z",
    "globe": "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM4.1 11A8 8 0 0 1 9 5.1C8.1 6.7 7.5 8.8 7.4 11zm0 2h3.3c.1 2.2.7 4.3 1.6 5.9A8 8 0 0 1 4.1 13zm5.3-2c.1-2.4 1.1-5.4 2.6-7 1.5 1.6 2.5 4.6 2.6 7zm0 2h5.2c-.1 2.4-1.1 5.4-2.6 7-1.5-1.6-2.5-4.6-2.6-7zm7.2-2c-.1-2.2-.7-4.3-1.6-5.9a8 8 0 0 1 4.9 5.9zm0 2h3.3a8 8 0 0 1-4.9 5.9c.9-1.6 1.5-3.7 1.6-5.9z",
    "eye": "M12 5C6.5 5 2.7 9.2 1.5 12c1.2 2.8 5 7 10.5 7s9.3-4.2 10.5-7C21.3 9.2 17.5 5 12 5zm0 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8z"
  }
};
