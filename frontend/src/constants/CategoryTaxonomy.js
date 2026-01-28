export const CATEGORY_TAXONOMY = {
    "Food & Drink": {
        icon: "coffee",
        color: "#F59E0B", // Amber
        subcategories: ["Groceries", "Restaurants", "Coffee", "Alcohol", "Fast Food", "Snacks", "FOOD_AND_DRINK"]
    },
    "Shopping": {
        icon: "shopping-bag",
        color: "#EC4899", // Pink
        subcategories: ["Clothing", "Electronics", "Home & Garden", "Beauty", "Kids", "Pets", "Gifts", "Laptop Purchase", "General Merchandise", "GENERAL_MERCHANDISE"]
    },
    "Housing": {
        icon: "home",
        color: "#3B82F6", // Blue
        subcategories: ["Rent", "Mortgage", "Maintenance", "Furniture", "Utilities", "Services", "Home Improvement", "HOME_IMPROVEMENT"]
    },
    "Transportation": {
        icon: "car",
        color: "#EF4444", // Red
        subcategories: ["Fuel", "Public Transit", "Taxi/Uber", "Car Payment", "Insurance", "Repairs", "Parking", "Petrol", "License fees", "Parking fees", "TRANSPORTATION", "Transport"]
    },
    "Entertainment": {
        icon: "film",
        color: "#8B5CF6", // Violet
        subcategories: ["Movies", "Games", "Music", "Sports", "Events", "Hobbies", "Travel", "Recreational Stuff", "ENTERTAINMENT"]
    },
    "Financial": {
        icon: "dollar-sign",
        color: "#10B981", // Emerald
        subcategories: ["Investments", "Taxes", "Insurance", "Fees", "Loan Payment", "Transfer", "Wise Withdrawal", "Bank Fees", "BANK_FEES", "Loan Payments", "LOAN_PAYMENTS", "Transfer In", "TRANSFER_IN", "Transfer Out", "TRANSFER_OUT"]
    },
    "Health": {
        icon: "activity",
        color: "#14B8A6", // Teal
        subcategories: ["Doctor", "Pharmacy", "Gym", "Therapy", "Dental", "Vision", "Massage", "MEDICAL", "Medical"]
    },
    "Bills & Utilities": {
        icon: "FileText",
        color: "#6366F1", // Indigo
        subcategories: ["Phone", "Internet", "Water", "Electricity", "Gas", "Subscriptions", "Mobile Bill", "Internet home", "Subscription", "Rent And Utilities", "RENT_AND_UTILITIES"]
    },
    "Education": {
        icon: "book-open",
        color: "#F97316", // Orange
        subcategories: ["Books", "Tuition", "Courses", "Supplies", "Student Loan"]
    },
    "Income": {
        icon: "trending-up",
        color: "#22C55E", // Green
        subcategories: ["Salary", "Bonus", "Freelance", "Investment Return", "Refund", "Bank Fees Refund", "INCOME"]
    },
    "Gifts & Donations": {
        icon: "gift",
        color: "#F43F5E", // Rose
        subcategories: ["Gift", "Gifts", "Charity", "Donations", "Birthday", "Wedding", "Holiday"]
    },
    "Other": {
        icon: "more-horizontal",
        color: "#64748B", // Slate
        subcategories: ["Miscellaneous", "Unknown", "General Services", "GENERAL_SERVICES", "Government And Non Profit", "GOVERNMENT_AND_NON_PROFIT"]
    }
};

// Helper to find parent for a given subcategory
export const getParentCategory = (subCategory, taxonomy = CATEGORY_TAXONOMY) => {
    if (!subCategory) return "Other";

    // Normalize for comparison
    const normalizedSub = subCategory.toLowerCase().replace(/_/g, ' ');

    for (const [parent, data] of Object.entries(taxonomy)) {
        // Exact match on subcategory or parent name
        if (data.subcategories.includes(subCategory) || parent === subCategory) {
            return parent;
        }

        // Check if category starts with any known subcategory (for Plaid detailed categories)
        // e.g., "General Merchandise Clothing And Accessories" starts with "General Merchandise"
        for (const sub of data.subcategories) {
            const normalizedKnown = sub.toLowerCase().replace(/_/g, ' ');
            if (normalizedSub.startsWith(normalizedKnown) || normalizedSub.startsWith(sub.toLowerCase())) {
                return parent;
            }
        }

        // Also check if it starts with parent name
        const normalizedParent = parent.toLowerCase().replace(/_/g, ' ');
        if (normalizedSub.startsWith(normalizedParent)) {
            return parent;
        }
    }
    return "Other";
};

// Helper to get color for a category (parent or sub)
export const getCategoryColor = (category, taxonomy = CATEGORY_TAXONOMY) => {
    const parent = getParentCategory(category, taxonomy);
    return taxonomy[parent]?.color || "#64748B";
};

// Store for dynamic normalizations loaded from backend
let cachedNormalizations = {};
let normalizationsLoaded = false;

// Load normalization rules from backend
export const loadNormalizations = async (api) => {
    try {
        const res = await api.get('/category-normalizations');
        cachedNormalizations = (res.data.normalizations || []).reduce((acc, rule) => {
            acc[rule.from_category] = rule.to_category;
            return acc;
        }, {});
        normalizationsLoaded = true;
    } catch (err) {
        console.error('Failed to load normalizations:', err);
    }
};

// Helper to normalize category names (uses dynamic rules from backend)
export const normalizeCategory = (category) => {
    if (!category) return category;

    // 1. Check dynamic rules from backend (priority)
    if (normalizationsLoaded && cachedNormalizations[category]) {
        return cachedNormalizations[category];
    }

    // 2. Fallback patterns for unconfigured cases
    const plaidPatterns = [
        { pattern: /^Food And Drink Other.*$/i, replacement: 'Other Food & Drink' },
        { pattern: /^General Merchandise.*$/i, replacement: 'Shopping' },
    ];

    for (const { pattern, replacement } of plaidPatterns) {
        if (pattern.test(category)) {
            return replacement;
        }
    }

    return category;
};

// Helper to deduplicate a list of category names (removes duplicates after normalization)
export const deduplicateCategories = (categories) => {
    if (!Array.isArray(categories)) return categories;

    const seen = new Set();
    return categories.filter(cat => {
        const normalized = normalizeCategory(cat);
        if (seen.has(normalized)) {
            return false;
        }
        seen.add(normalized);
        return true;
    });
};

// Helper to get icon for a category
export const getCategoryIcon = (category, taxonomy = CATEGORY_TAXONOMY) => {
    const parent = getParentCategory(category, taxonomy);
    return taxonomy[parent]?.icon || "tag";
};

// Helper to check if a transaction category matches a budget category
export const isCategoryMatch = (txCategory, budgetCategory) => {
    if (!txCategory || !budgetCategory) return false;

    // Normalize both categories first to handle variants like "Grocery" → "Groceries"
    const normalizedTx = normalizeCategory(txCategory);
    const normalizedBudget = normalizeCategory(budgetCategory);

    const txCat = normalizedTx.toLowerCase();
    const bdCat = normalizedBudget.toLowerCase();

    // 1. Direct Match (after normalization)
    if (txCat === bdCat) return true;

    // 2. Parent Match: If budgetCategory is a Parent, check if txCategory is one of its children
    const taxonomyKey = Object.keys(CATEGORY_TAXONOMY).find(k => k.toLowerCase() === bdCat);
    if (taxonomyKey) {
        const subCategories = CATEGORY_TAXONOMY[taxonomyKey].subcategories;
        if (subCategories.some(sub => normalizeCategory(sub).toLowerCase() === txCat)) return true;
    }

    // 3. Sub-category Partial Match (Reverse of above, or handling complex Plaid strings)
    // e.g. tx="Shopping - Clothing", budget="Shopping" -> startsWith check
    if (txCat.startsWith(bdCat)) return true;

    // 4. Budget Category is strict match for a sub-category
    // e.g. budget="Clothing", tx="Shopping - Clothing" (Plaid sometimes formats like this)
    // or budget="Clothing", tx="Clothing" (Checked by direct match)

    // Also check if budget category is a sub, and tx matches that sub logic
    // This is often covered by Direct Match, but let's handle Plaid "Parent - Sub" format
    if (txCat.includes(bdCat)) return true;

    return false;
};
