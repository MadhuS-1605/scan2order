// Starter menu templates — let a new venue populate a sensible menu in one tap
// during onboarding (or later from Menu). Pure data; applied by applyTemplateAction.

export type TemplateItem = {
  name: string;
  price: number;
  isVeg?: boolean;
  description?: string;
};
export type TemplateCategory = { name: string; items: TemplateItem[] };
export type MenuTemplate = {
  key: string;
  name: string;
  blurb: string;
  categories: TemplateCategory[];
};

export const MENU_TEMPLATES: MenuTemplate[] = [
  {
    key: "cafe",
    name: "Café",
    blurb: "Coffees, teas, quick bites & desserts.",
    categories: [
      {
        name: "Hot Beverages",
        items: [
          { name: "Filter Coffee", price: 60 },
          { name: "Cappuccino", price: 130 },
          { name: "Masala Chai", price: 50 },
          { name: "Hot Chocolate", price: 150 },
        ],
      },
      {
        name: "Cold Beverages",
        items: [
          { name: "Cold Coffee", price: 160 },
          { name: "Iced Tea", price: 120 },
          { name: "Fresh Lime Soda", price: 90 },
        ],
      },
      {
        name: "Quick Bites",
        items: [
          { name: "Veg Sandwich", price: 140 },
          { name: "Cheese Garlic Bread", price: 170 },
          { name: "French Fries", price: 130 },
        ],
      },
      {
        name: "Desserts",
        items: [
          { name: "Brownie", price: 150 },
          { name: "Cheesecake Slice", price: 190 },
        ],
      },
    ],
  },
  {
    key: "restaurant",
    name: "Restaurant (Indian)",
    blurb: "Starters, mains, breads, rice & desserts.",
    categories: [
      {
        name: "Starters",
        items: [
          { name: "Paneer Tikka", price: 240 },
          { name: "Veg Spring Roll", price: 180 },
          { name: "Chicken 65", price: 260, isVeg: false },
        ],
      },
      {
        name: "Main Course",
        items: [
          { name: "Paneer Butter Masala", price: 280 },
          { name: "Dal Tadka", price: 200 },
          { name: "Butter Chicken", price: 340, isVeg: false },
        ],
      },
      {
        name: "Breads & Rice",
        items: [
          { name: "Butter Naan", price: 50 },
          { name: "Jeera Rice", price: 160 },
          { name: "Veg Biryani", price: 240 },
        ],
      },
      {
        name: "Desserts",
        items: [
          { name: "Gulab Jamun", price: 90 },
          { name: "Gajar Halwa", price: 120 },
        ],
      },
    ],
  },
  {
    key: "bar",
    name: "Bar & Lounge",
    blurb: "Cocktails, mocktails & bar snacks.",
    categories: [
      {
        name: "Cocktails",
        items: [
          { name: "Mojito", price: 350 },
          { name: "Long Island Iced Tea", price: 550 },
          { name: "Margarita", price: 420 },
        ],
      },
      {
        name: "Mocktails",
        items: [
          { name: "Virgin Mojito", price: 220 },
          { name: "Blue Lagoon", price: 240 },
        ],
      },
      {
        name: "Bar Snacks",
        items: [
          { name: "Peri Peri Fries", price: 190 },
          { name: "Chicken Wings", price: 320, isVeg: false },
          { name: "Paneer Chilli", price: 260 },
        ],
      },
    ],
  },
];
