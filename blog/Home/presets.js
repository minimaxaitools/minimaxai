const PRESETS = {
  categories: [
    "Flour & Grains",
    "Lentils & Pulses (Dals)",
    "Oils & Ghee",
    "Dairy & Eggs",
    "Spices & Seasoning",
    "Sugar & Sweeteners",
    "Vegetables & Fruits",
    "Beverages",
    "Medicines & Care",
    "Baby & Kids Needs",
    "Household & Cleaning",
    "Cosmetics & Luxuries"
  ],
  
  items: [
    {
      name: "Atta (Wheat Flour)",
      category: "Flour & Grains",
      priority: "essential",
      baseUnit: "g",
      conversions: {
        "cup": { value: 120, confidence: 1.0, source: "scientific" },
        "bowl": { value: 180, confidence: 1.0, source: "scientific" },
        "handful": { value: 40, confidence: 0.8, source: "scientific" }
      },
      defaultConsumption: { qty: 4, unit: "cup", schedule: { type: "daily", interval: 1 } }
    },
    {
      name: "Rice",
      category: "Flour & Grains",
      priority: "essential",
      baseUnit: "g",
      conversions: {
        "bowl": { value: 150, confidence: 1.0, source: "scientific" },
        "cup": { value: 180, confidence: 1.0, source: "scientific" },
        "handful": { value: 50, confidence: 0.8, source: "scientific" }
      },
      defaultConsumption: { qty: 2, unit: "bowl", schedule: { type: "daily", interval: 1 } }
    },
    {
      name: "Sugar",
      category: "Sugar & Sweeteners",
      priority: "normal",
      baseUnit: "g",
      conversions: {
        "spoon": { value: 8, confidence: 1.0, source: "scientific" },
        "teaspoon": { value: 5, confidence: 1.0, source: "scientific" },
        "tablespoon": { value: 15, confidence: 1.0, source: "scientific" },
        "cup": { value: 200, confidence: 1.0, source: "scientific" }
      },
      defaultConsumption: { qty: 3, unit: "spoon", schedule: { type: "daily", interval: 1 } }
    },
    {
      name: "Salt",
      category: "Spices & Seasoning",
      priority: "essential",
      baseUnit: "g",
      conversions: {
        "pinch": { value: 1.5, confidence: 1.0, source: "scientific" },
        "spoon": { value: 6, confidence: 1.0, source: "scientific" },
        "teaspoon": { value: 4, confidence: 1.0, source: "scientific" }
      },
      defaultConsumption: { qty: 4, unit: "pinch", schedule: { type: "daily", interval: 1 } }
    },
    {
      name: "Mustard Oil",
      category: "Oils & Ghee",
      priority: "essential",
      baseUnit: "ml",
      conversions: {
        "spoon": { value: 12, confidence: 1.0, source: "scientific" },
        "tablespoon": { value: 15, confidence: 1.0, source: "scientific" },
        "ladle": { value: 50, confidence: 0.9, source: "scientific" },
        "cup": { value: 240, confidence: 1.0, source: "scientific" }
      },
      defaultConsumption: { qty: 3, unit: "spoon", schedule: { type: "daily", interval: 1 } }
    },
    {
      name: "Refined Sunflower Oil",
      category: "Oils & Ghee",
      priority: "essential",
      baseUnit: "ml",
      conversions: {
        "spoon": { value: 12, confidence: 1.0, source: "scientific" },
        "tablespoon": { value: 15, confidence: 1.0, source: "scientific" },
        "ladle": { value: 50, confidence: 0.9, source: "scientific" },
        "cup": { value: 240, confidence: 1.0, source: "scientific" }
      },
      defaultConsumption: { qty: 3, unit: "spoon", schedule: { type: "daily", interval: 1 } }
    },
    {
      name: "Toor Dal (Pigeon Peas)",
      category: "Lentils & Pulses (Dals)",
      priority: "essential",
      baseUnit: "g",
      conversions: {
        "bowl": { value: 140, confidence: 1.0, source: "scientific" },
        "cup": { value: 190, confidence: 1.0, source: "scientific" },
        "handful": { value: 45, confidence: 0.8, source: "scientific" }
      },
      defaultConsumption: { qty: 1, unit: "bowl", schedule: { type: "daily", interval: 1 } }
    },
    {
      name: "Moong Dal",
      category: "Lentils & Pulses (Dals)",
      priority: "essential",
      baseUnit: "g",
      conversions: {
        "bowl": { value: 140, confidence: 1.0, source: "scientific" },
        "cup": { value: 190, confidence: 1.0, source: "scientific" },
        "handful": { value: 45, confidence: 0.8, source: "scientific" }
      },
      defaultConsumption: { qty: 1, unit: "bowl", schedule: { type: "daily", interval: 1 } }
    },
    {
      name: "Milk",
      category: "Dairy & Eggs",
      priority: "normal",
      baseUnit: "ml",
      conversions: {
        "glass": { value: 250, confidence: 1.0, source: "scientific" },
        "cup": { value: 150, confidence: 1.0, source: "scientific" },
        "mug": { value: 300, confidence: 1.0, source: "scientific" }
      },
      defaultConsumption: { qty: 2, unit: "glass", schedule: { type: "daily", interval: 1 } }
    },
    {
      name: "Tea Leaves",
      category: "Beverages",
      priority: "normal",
      baseUnit: "g",
      conversions: {
        "spoon": { value: 4, confidence: 1.0, source: "scientific" },
        "teaspoon": { value: 3, confidence: 1.0, source: "scientific" },
        "pinch": { value: 1, confidence: 0.7, source: "scientific" }
      },
      defaultConsumption: { qty: 2, unit: "spoon", schedule: { type: "daily", interval: 1 } }
    },
    {
      name: "Potatoes",
      category: "Vegetables & Fruits",
      priority: "essential",
      baseUnit: "g",
      conversions: {
        "piece": { value: 150, confidence: 0.9, source: "scientific" },
        "bowl": { value: 300, confidence: 0.8, source: "scientific" }
      },
      defaultConsumption: { qty: 3, unit: "piece", schedule: { type: "interval", interval: 2 } }
    },
    {
      name: "Onions",
      category: "Vegetables & Fruits",
      priority: "essential",
      baseUnit: "g",
      conversions: {
        "piece": { value: 100, confidence: 0.9, source: "scientific" }
      },
      defaultConsumption: { qty: 2, unit: "piece", schedule: { type: "daily", interval: 1 } }
    },
    {
      name: "Eggs",
      category: "Dairy & Eggs",
      priority: "normal",
      baseUnit: "pcs",
      conversions: {
        "piece": { value: 1, confidence: 1.0, source: "scientific" },
        "dozen": { value: 12, confidence: 1.0, source: "scientific" }
      },
      defaultConsumption: { qty: 2, unit: "piece", schedule: { type: "daily", interval: 1 } }
    },
    {
      name: "Garlic",
      category: "Spices & Seasoning",
      priority: "normal",
      baseUnit: "g",
      conversions: {
        "clove": { value: 4, confidence: 0.9, source: "scientific" },
        "piece": { value: 30, confidence: 0.8, source: "scientific" }
      },
      defaultConsumption: { qty: 3, unit: "clove", schedule: { type: "daily", interval: 1 } }
    },
    {
      name: "Ginger",
      category: "Spices & Seasoning",
      priority: "normal",
      baseUnit: "g",
      conversions: {
        "inch": { value: 8, confidence: 0.9, source: "scientific" },
        "piece": { value: 50, confidence: 0.8, source: "scientific" }
      },
      defaultConsumption: { qty: 1, unit: "inch", schedule: { type: "daily", interval: 1 } }
    },
    {
      name: "Washing Soap Bar",
      category: "Household & Cleaning",
      priority: "normal",
      baseUnit: "pcs",
      conversions: {
        "piece": { value: 1, confidence: 1.0, source: "scientific" },
        "bar": { value: 1, confidence: 1.0, source: "scientific" }
      },
      defaultConsumption: { qty: 1, unit: "bar", schedule: { type: "interval", interval: 14 } }
    },
    {
      name: "LPG Gas Cylinder",
      category: "Household & Cleaning",
      priority: "essential",
      baseUnit: "pcs",
      conversions: {
        "cylinder": { value: 1, confidence: 1.0, source: "scientific" }
      },
      defaultConsumption: { qty: 1, unit: "cylinder", schedule: { type: "interval", interval: 45 } }
    },
    {
      name: "Basic Fever/Pain Medicine",
      category: "Medicines & Care",
      priority: "essential",
      baseUnit: "pcs",
      conversions: {
        "tablet": { value: 1, confidence: 1.0, source: "scientific" },
        "strip": { value: 10, confidence: 1.0, source: "scientific" }
      },
      defaultConsumption: { qty: 1, unit: "tablet", schedule: { type: "interval", interval: 7 } }
    },
    {
      name: "Ghee",
      category: "Oils & Ghee",
      priority: "luxury",
      baseUnit: "g",
      conversions: {
        "spoon": { value: 12, confidence: 1.0, source: "scientific" },
        "tablespoon": { value: 15, confidence: 1.0, source: "scientific" }
      },
      defaultConsumption: { qty: 1, unit: "spoon", schedule: { type: "daily", interval: 1 } }
    },
    {
      name: "Baby Milk Powder",
      category: "Baby & Kids Needs",
      priority: "essential",
      baseUnit: "g",
      conversions: {
        "spoon": { value: 10, confidence: 1.0, source: "scientific" },
        "scoop": { value: 5, confidence: 1.0, source: "scientific" }
      },
      defaultConsumption: { qty: 6, unit: "scoop", schedule: { type: "daily", interval: 1 } }
    }
  ]
};

// Make it globally accessible
window.PRESETS = PRESETS;
