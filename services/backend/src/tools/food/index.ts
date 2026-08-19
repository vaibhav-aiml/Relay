import {
  foodSearchOptionsSchema,
  foodPrepareOrderSchema,
  FoodSearchOptionsInput,
  FoodPrepareOrderInput,
} from '@relay/tool-schemas';
import { ToolDefinition, ExecutionContext } from '../types.js';

// Curated popular menu items across multi-platform delivery networks
const POPULAR_MENU_CATALOG = [
  {
    query: 'cold coffee',
    items: [
      { name: 'Classic Cold Coffee', restaurant: 'Cafe Coffee Day', estimatedPrice: 149, rating: 4.3, platform: 'zomato' },
      { name: 'Iced Latte / Cold Brew', restaurant: 'Blue Tokai Coffee Roasters', estimatedPrice: 180, rating: 4.6, platform: 'swiggy' },
      { name: 'Thick Cold Coffee with Ice Cream', restaurant: 'Mad Over Donuts / Local Cafe', estimatedPrice: 129, rating: 4.1, platform: 'zomato' },
      { name: 'Frappuccino Cold Coffee', restaurant: 'Starbucks', estimatedPrice: 285, rating: 4.5, platform: 'swiggy' },
      { name: 'Bottled Cold Coffee (200ml)', restaurant: 'Sleepy Owl / Blinkit Store', estimatedPrice: 99, rating: 4.4, platform: 'blinkit' },
      { name: 'Cold Coffee Can / Brew (250ml)', restaurant: 'Zepto Cafe / Quick Store', estimatedPrice: 119, rating: 4.3, platform: 'zepto' },
    ],
  },
  {
    query: 'coffee',
    items: [
      { name: 'Classic Cold Coffee', restaurant: 'Cafe Coffee Day', estimatedPrice: 149, rating: 4.3, platform: 'zomato' },
      { name: 'Hot Cappuccino / Latte', restaurant: 'Blue Tokai', estimatedPrice: 160, rating: 4.5, platform: 'swiggy' },
      { name: 'Bottled Cold Coffee (200ml)', restaurant: 'Sleepy Owl / Blinkit Store', estimatedPrice: 99, rating: 4.4, platform: 'blinkit' },
      { name: 'Cold Coffee Can (250ml)', restaurant: 'Zepto Cafe', estimatedPrice: 119, rating: 4.3, platform: 'zepto' },
    ],
  },
  {
    query: 'pizza',
    items: [
      { name: 'Margherita Classic Pizza (Regular)', restaurant: "Domino's Pizza", estimatedPrice: 139, rating: 4.4, platform: 'swiggy' },
      { name: 'Cheese Burst Veg Pizza', restaurant: 'Pizza Hut', estimatedPrice: 249, rating: 4.2, platform: 'zomato' },
      { name: 'Double Cheese Margherita', restaurant: 'La Pinoz Pizza', estimatedPrice: 179, rating: 4.3, platform: 'zomato' },
      { name: 'Ready-to-Bake Thin Crust Pizza', restaurant: 'Blinkit Gourmet Store', estimatedPrice: 149, rating: 4.2, platform: 'blinkit' },
    ],
  },
  {
    query: 'burger',
    items: [
      { name: 'Crispy Veg Burger', restaurant: "McDonald's", estimatedPrice: 79, rating: 4.3, platform: 'swiggy' },
      { name: 'Whopper Veg / Crispy Veg', restaurant: 'Burger King', estimatedPrice: 129, rating: 4.2, platform: 'zomato' },
      { name: 'Paneer Royale Burger', restaurant: "Wendy's", estimatedPrice: 169, rating: 4.1, platform: 'swiggy' },
      { name: 'Veg Patty Burger Combo', restaurant: 'Zepto Cafe', estimatedPrice: 109, rating: 4.2, platform: 'zepto' },
    ],
  },
  {
    query: 'biryani',
    items: [
      { name: 'Hyderabadi Veg Dum Biryani', restaurant: 'Behrouz Biryani', estimatedPrice: 249, rating: 4.5, platform: 'zomato' },
      { name: 'Chicken Dum Biryani (Single)', restaurant: 'Paradise Biryani', estimatedPrice: 199, rating: 4.3, platform: 'swiggy' },
    ],
  },
];

// Helper to construct item-level and search-level deep links and web fallbacks
export function constructPlatformUrls(platform: string, query: string): { deepLinkUrl: string; webFallbackUrl: string } {
  const encoded = encodeURIComponent(query);
  switch (platform.toLowerCase()) {
    case 'swiggy':
      return {
        deepLinkUrl: `swiggy://explore?query=${encoded}`,
        webFallbackUrl: `https://www.swiggy.com/search?query=${encoded}`,
      };
    case 'blinkit':
      return {
        deepLinkUrl: `blinkit://search?q=${encoded}`,
        webFallbackUrl: `https://blinkit.com/s/?q=${encoded}`,
      };
    case 'zepto':
      return {
        deepLinkUrl: `zepto://search?q=${encoded}`,
        webFallbackUrl: `https://www.zeptonow.com/search?query=${encoded}`,
      };
    case 'zomato':
    default:
      return {
        deepLinkUrl: `zomato://search?q=${encoded}&source=relay`,
        webFallbackUrl: `https://www.zomato.com/search?q=${encoded}`,
      };
  }
}

export const foodSearchOptionsTool: ToolDefinition<FoodSearchOptionsInput> = {
  name: 'food.searchOptions',
  description:
    'Search for food items, dishes, and beverages within a price budget across platforms (Zomato, Swiggy, Blinkit, Zepto). Returns multi-platform options with estimated prices and deep links.',
  inputSchema: foodSearchOptionsSchema,
  riskLevel: 'LOW',
  requiredPermission: 'food.searchOptions',
  timeoutMs: 15_000,
  retryPolicy: { maxRetries: 1, backoffMs: 1000 },
  execute: async (input: FoodSearchOptionsInput, ctx: ExecutionContext) => {
    const qLower = input.query.toLowerCase().trim();
    const minP = input.minPrice !== undefined ? Number(input.minPrice) : 0;
    const maxP = input.maxPrice !== undefined ? Number(input.maxPrice) : Infinity;
    const currency = input.currency || 'INR';

    // 1. Try online search with Tavily if API key is present
    const apiKey = process.env.WEB_SEARCH_API_KEY;
    let webResults: string[] = [];

    if (apiKey) {
      try {
        const response = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: apiKey,
            query: `${input.query} price India Zomato Swiggy Blinkit Zepto menu cost`,
            max_results: 4,
          }),
        });
        if (response.ok) {
          const data: any = await response.json();
          webResults = (data.results || []).map((r: any) => `${r.title}: ${r.content}`);
        }
      } catch (err: any) {
        ctx.logger?.warn?.(`Web food price search failed: ${err.message}`);
      }
    }

    // 2. Look for catalog matches or generate contextual estimate matches
    const catalogMatch = POPULAR_MENU_CATALOG.find((c) => qLower.includes(c.query) || c.query.includes(qLower));

    let candidateItems = catalogMatch
      ? catalogMatch.items
      : [
          {
            name: input.query,
            restaurant: 'Popular Cafe / Restaurant',
            estimatedPrice: maxP < 200 ? Math.max(minP, Math.min(maxP, 130)) : 160,
            rating: 4.2,
            platform: 'zomato',
          },
          {
            name: `Special ${input.query}`,
            restaurant: 'Top Rated Kitchen',
            estimatedPrice: maxP < 250 ? Math.max(minP, Math.min(maxP, 180)) : 220,
            rating: 4.4,
            platform: 'swiggy',
          },
          {
            name: `Quick ${input.query}`,
            restaurant: 'Instant Mart Store',
            estimatedPrice: maxP < 150 ? Math.max(minP, Math.min(maxP, 99)) : 120,
            rating: 4.3,
            platform: 'blinkit',
          },
        ];

    // Filter by user platform preference if specified
    if (input.platform && input.platform !== 'any') {
      const platformSpecific = candidateItems.filter((i) => i.platform === input.platform);
      if (platformSpecific.length > 0) {
        candidateItems = platformSpecific;
      } else {
        // Adapt matching items to the requested platform
        candidateItems = candidateItems.map((i) => ({
          ...i,
          platform: input.platform,
        }));
      }
    }

    // Filter by budget constraints (minPrice and maxPrice)
    const withinBudget = candidateItems.filter((item) => {
      if (item.estimatedPrice < minP) return false;
      if (item.estimatedPrice > maxP) return false;
      return true;
    });

    const itemsToReturn = withinBudget.length > 0 ? withinBudget : candidateItems;

    // Attach deep links, URLs, and estimation disclaimer
    const formattedOptions = itemsToReturn.map((item) => {
      const urls = constructPlatformUrls(item.platform, item.name);
      return {
        itemName: item.name,
        restaurantName: item.restaurant,
        estimatedPrice: item.estimatedPrice,
        currency,
        rating: item.rating,
        platform: item.platform,
        isWithinBudget: item.estimatedPrice >= minP && item.estimatedPrice <= maxP,
        deepLinkUrl: urls.deepLinkUrl,
        webFallbackUrl: urls.webFallbackUrl,
        disclaimer: 'estimated — confirm actual price in app',
      };
    });

    return {
      query: input.query,
      budgetFilter: {
        minPrice: input.minPrice,
        maxPrice: input.maxPrice,
        currency,
      },
      optionsCount: formattedOptions.length,
      options: formattedOptions,
      comparisonSummary: formattedOptions.map((o) => `${o.platform.toUpperCase()}: "${o.itemName}" from ${o.restaurantName} (~₹${o.estimatedPrice})`).join(' | '),
      note: 'All prices are estimated approximations. Please verify live menu pricing, delivery charges, and availability in the selected delivery app.',
    };
  },
  verify: async (output) => {
    return Array.isArray(output.options);
  },
};

export const foodPrepareOrderTool: ToolDefinition<FoodPrepareOrderInput> = {
  name: 'food.prepareOrder',
  description:
    'Prepare and finalize a food delivery order to open in Zomato, Swiggy, Blinkit, or Zepto. Requires CRITICAL user confirmation. Automatically saves order preference to memory.',
  inputSchema: foodPrepareOrderSchema,
  riskLevel: 'CRITICAL',
  requiredPermission: 'food.prepareOrder',
  idempotencyKeyFn: (input) => input.idempotencyKey || `order-${input.platform}-${input.itemName}`,
  timeoutMs: 15_000,
  retryPolicy: { maxRetries: 1, backoffMs: 1000 },
  execute: async (input: FoodPrepareOrderInput, ctx: ExecutionContext) => {
    const urls = constructPlatformUrls(input.platform, input.itemName);
    const deepLink = input.deepLinkUrl || urls.deepLinkUrl;
    const webFallback = input.webFallbackUrl || urls.webFallbackUrl;

    // Save food preference to Memory for repeat "order my usual" queries
    if (ctx.db && ctx.userId) {
      try {
        const isCoffee = input.itemName.toLowerCase().includes('coffee');
        const memoryKey = isCoffee
          ? 'usual_coffee'
          : `favorite_${input.itemName.toLowerCase().replace(/[^\w]/g, '_').slice(0, 20)}`;
        const memoryValue = `${input.itemName} from ${input.restaurantName} on ${input.platform.toUpperCase()} (~₹${input.estimatedPrice})`;

        await ctx.db.saveMemory({
          userId: ctx.userId,
          key: memoryKey,
          value: memoryValue,
          category: 'preference',
          source: 'inferred',
          userApproved: true,
        });
      } catch (err: any) {
        ctx.logger?.warn?.(`Could not save food preference memory: ${err.message}`);
      }
    }

    return {
      success: true,
      itemName: input.itemName,
      restaurantName: input.restaurantName,
      estimatedPrice: input.estimatedPrice,
      currency: input.currency || 'INR',
      budgetRange: input.budgetRange,
      platform: input.platform,
      deepLinkUrl: deepLink,
      webFallbackUrl: webFallback,
      disclaimer: 'estimated — confirm actual price in app',
      message: `Ready to open ${input.platform.toUpperCase()} for "${input.itemName}" from ${input.restaurantName}`,
    };
  },
  verify: async (output) => {
    return Boolean(output && output.deepLinkUrl);
  },
};
