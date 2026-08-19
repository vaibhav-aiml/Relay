import { z } from 'zod';

export const foodSearchOptionsSchema = z.object({
  query: z.string().min(1).describe('Food item, dish, or beverage to search (e.g. cold coffee, margherita pizza, biryani, burger)'),
  minPrice: z.coerce.number().optional().describe('Minimum budget in local currency (e.g. 100)'),
  maxPrice: z.coerce.number().optional().describe('Maximum budget in local currency (e.g. 150)'),
  currency: z.string().default('INR').describe('Currency code (default INR / ₹)'),
  platform: z.enum(['zomato', 'swiggy', 'blinkit', 'zepto', 'any']).default('any').describe('Preferred delivery platform (zomato, swiggy, blinkit, zepto, or any)'),
  dietary: z.enum(['veg', 'non-veg', 'any']).optional().default('any').describe('Dietary preference'),
});

export type FoodSearchOptionsInput = z.infer<typeof foodSearchOptionsSchema>;

export const foodPrepareOrderSchema = z.object({
  itemName: z.string().min(1).describe('Selected dish or item name (e.g. Classic Cold Coffee)'),
  restaurantName: z.string().min(1).describe('Restaurant or cafe name (e.g. Cafe Coffee Day, Starbucks)'),
  estimatedPrice: z.coerce.number().describe('Estimated price for the item in local currency (e.g. 149)'),
  currency: z.string().default('INR').describe('Currency code (default INR / ₹)'),
  budgetRange: z.string().optional().describe('Original user requested budget constraint (e.g. Under ₹150, ₹100–₹200)'),
  platform: z.enum(['zomato', 'swiggy', 'blinkit', 'zepto']).describe('Target food delivery platform'),
  deepLinkUrl: z.string().describe('Android native deep link intent URL (e.g. zomato://search?q=cold+coffee or swiggy://explore?query=cold+coffee)'),
  webFallbackUrl: z.string().describe('Web fallback URL if native app is not installed (e.g. https://www.zomato.com/search?q=cold+coffee)'),
  idempotencyKey: z.string().optional().describe('Unique idempotency key'),
});

export type FoodPrepareOrderInput = z.infer<typeof foodPrepareOrderSchema>;
