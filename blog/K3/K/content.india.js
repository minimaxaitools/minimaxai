/* Modern Feature-Rich India Explainer Project for Kinetic Studio
 * Showcases:
 *  - Official Survey of India national boundary (worldIndiaLow / indiaLow)
 *  - Himalayan state highlights (Jammu & Kashmir, Ladakh, Himachal Pradesh, Uttarakhand)
 *  - Golden Quadrilateral national aviation network (Delhi - Mumbai - Bengaluru - Chennai - Kolkata)
 *  - State-level economic & renewable energy data visualization (Choropleth values heatmap)
 *  - Coastal frontiers & island union territories (Goa, Kerala, Andaman & Nicobar, Lakshadweep)
 *  - Bilingual Hindi & English kinetic typography with badges, pins, and custom camera moves
 */
window.KineticIndiaSample = {
  "_about": "Modern feature-rich India explainer with official maps, states, routes, and choropleth data.",
  "meta": {
    "title": "भारत — India Explorer",
    "lang": "hi",
    "locale": "en-IN",
    "fps": 30,
    "width": 1920,
    "height": 1080,
    "seed": "bharat-pro-1",
    "auto": false
  },
  "theme": "paperWhimsy",
  "scenes": [
    {
      "id": "scene-intro",
      "transition": "paperWipe",
      "beats": [
        {
          "text": "भारत [गणराज्य](in:grow) — [अनेकता में एकता](highlight)",
          "visual": {
            "type": "map",
            "focus": "IN",
            "region": "indiaLow",
            "title": "भारत · Republic of India",
            "showTitle": true,
            "style": "paper",
            "places": [
              {
                "name": "Delhi",
                "label": "नई दिल्ली (New Delhi)",
                "badgeText": "राजधानी",
                "typeKey": "annotationBadge",
                "color": "#C8412A"
              }
            ]
          }
        },
        "उत्तर से दक्षिण और पूर्व से पश्चिम तक फैली 140 करोड़ देशवासियों की यह पावन भूमि।"
      ]
    },
    {
      "id": "scene-north",
      "transition": "tornReveal",
      "beats": [
        {
          "text": "हिमालय की गोद में [जम्मू-कश्मीर](state) और [लद्दाख](state)",
          "visual": {
            "type": "map",
            "focus": "IN-JK",
            "region": "indiaLow",
            "title": "उत्तरी भारत · The Himalayas",
            "showTitle": true,
            "highlight": ["IN-JK", "IN-LA", "IN-HP", "IN-UT"],
            "places": [
              { "name": "Srinagar", "label": "श्रीनगर (Srinagar)", "typeKey": "pin" },
              { "name": "Leh", "label": "लेह (Ladakh)", "badgeText": "3,500m", "typeKey": "annotationBadge" },
              { "name": "Shimla", "label": "शिमला", "typeKey": "pin" },
              { "name": "Dehradun", "label": "देहरादून", "typeKey": "pin" }
            ]
          }
        },
        "बर्फीली चोटियाँ, सुरम्य वादियाँ और सामरिक महत्व का यह क्षेत्र भारत का गौरवशाली मुकुट है।"
      ]
    },
    {
      "id": "scene-routes",
      "transition": "slideWipe",
      "beats": [
        {
          "text": "भारत का [स्वर्ण चतुर्भुज](highlight) — महानगरों का [विमान नेटवर्क](fx:shimmer)",
          "visual": {
            "type": "map",
            "focus": "IN",
            "region": "indiaLow",
            "title": "Aviation Network · Golden Quadrilateral",
            "showTitle": true,
            "routes": [
              ["Delhi", "Mumbai"],
              ["Mumbai", "Bengaluru"],
              ["Bengaluru", "Chennai"],
              ["Chennai", "Kolkata"],
              ["Kolkata", "Delhi"]
            ],
            "places": [
              { "name": "Delhi", "label": "दिल्ली (DEL)", "badgeText": "🏛️ उत्तर" },
              { "name": "Mumbai", "label": "मुंबई (BOM)", "badgeText": "💼 पश्चिम" },
              { "name": "Bengaluru", "label": "बेंगलुरु (BLR)", "badgeText": "🚀 ISRO / Tech" },
              { "name": "Chennai", "label": "चेन्नई (MAA)", "badgeText": "🌊 दक्षिण" },
              { "name": "Kolkata", "label": "कोलकाता (CCU)", "badgeText": "🎨 पूर्व" }
            ]
          }
        },
        "दिल्ली, मुंबई, बेंगलुरु, चेन्नई और कोलकाता को जोड़ता तेज गति व्यापार और संपर्क मार्ग।"
      ]
    },
    {
      "id": "scene-economy",
      "transition": "paperWipe",
      "beats": [
        {
          "text": "भारतीय राज्यों में [आर्थिक प्रगति](highlight) और [विकास सूचकांक](counter)",
          "visual": {
            "type": "map",
            "focus": "IN",
            "region": "indiaLow",
            "title": "State Economic Index ($ Billion GSDP)",
            "showTitle": true,
            "values": {
              "IN-MH": 450,
              "IN-GJ": 380,
              "IN-TN": 360,
              "IN-KA": 340,
              "IN-UP": 310,
              "IN-RJ": 280,
              "IN-WB": 260,
              "IN-MP": 240,
              "IN-AP": 220,
              "IN-TG": 210,
              "IN-KL": 180,
              "IN-PB": 160,
              "IN-HR": 150,
              "IN-BR": 140,
              "IN-OR": 130
            }
          }
        },
        "महाराष्ट्र, गुजरात, तमिलनाडु, कर्नाटक और उत्तर प्रदेश देश के प्रमुख आर्थिक इंजन हैं।"
      ]
    },
    {
      "id": "scene-coastal",
      "transition": "tornReveal",
      "beats": [
        {
          "text": "7,500 किमी लंबी [तटरेखा](fx:glow) — [गोवा](city), [केरल](state) और [द्वीप समूह](state)",
          "visual": {
            "type": "map",
            "focus": "IN",
            "region": "indiaLow",
            "title": "तटीय क्षेत्र एवं द्वीप समूह",
            "showTitle": true,
            "highlight": ["IN-GA", "IN-KL", "IN-AN", "IN-LD"],
            "places": [
              { "name": "Panaji", "label": "गोवा (Goa)", "badgeText": "🏖️ पर्यटन" },
              { "name": "Kochi", "label": "कोच्चि (Kochi)", "badgeText": "⚓ बंदरगाह" },
              { "name": "Port Blair", "label": "पोर्ट ब्लेयर (A&N)", "badgeText": "🏝️ द्वीप" }
            ]
          }
        },
        "जय हिन्द! समृद्ध संस्कृति, आधुनिक तकनीक और असीम संभावनाओं से भरा हमारा भारत।"
      ]
    }
  ]
};
