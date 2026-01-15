export const CATEGORY_TAXONOMY = {
    "Food & Drink": {
        icon: "coffee",
        color: "#F59E0B", // Amber
        subcategories: ["Groceries", "Restaurants", "Coffee", "Alcohol", "Fast Food", "Snacks", "Grocery"]
    },
    "Shopping": {
        icon: "shopping-bag",
        color: "#EC4899", // Pink
        subcategories: ["Clothing", "Electronics", "Home & Garden", "Beauty", "Kids", "Pets", "Gifts", "Laptop Purchase"]
    },
    "Housing": {
        icon: "home",
        color: "#3B82F6", // Blue
        subcategories: ["Rent", "Mortgage", "Maintenance", "Furniture", "Utilities", "Services"]
    },
    "Transportation": {
        icon: "car",
        color: "#EF4444", // Red
        subcategories: ["Fuel", "Public Transit", "Taxi/Uber", "Car Payment", "Insurance", "Repairs", "Parking", "Petrol", "License fees", "Parking fees"]
    },
    "Entertainment": {
        icon: "film",
        color: "#8B5CF6", // Violet
        subcategories: ["Movies", "Games", "Music", "Sports", "Events", "Hobbies", "Travel", "Recreational Stuff"]
    },
    "Financial": {
        icon: "dollar-sign",
        color: "#10B981", // Emerald
        subcategories: ["Investments", "Taxes", "Insurance", "Fees", "Loan Payment", "Transfer", "Wise Withdrawal"]
    },
    "Health": {
        icon: "activity",
        color: "#14B8A6", // Teal
        subcategories: ["Doctor", "Pharmacy", "Gym", "Therapy", "Dental", "Vision", "Massage"]
    },
    "Bills & Utilities": {
        icon: "FileText",
        color: "#6366F1", // Indigo
        subcategories: ["Phone", "Internet", "Water", "Electricity", "Gas", "Subscriptions", "Mobile Bill", "Internet home", "Subscription"]
    },
    "Education": {
        icon: "book-open",
        color: "#F97316", // Orange
        subcategories: ["Books", "Tuition", "Courses", "Supplies", "Student Loan"]
    },
    "Income": {
        icon: "trending-up",
        color: "#22C55E", // Green
        subcategories: ["Salary", "Bonus", "Freelance", "Investment Return", "Gift", "Refund"]
    },
    "Other": {
        icon: "more-horizontal",
        color: "#64748B", // Slate
        subcategories: ["Charity", "Miscellaneous", "Unknown"]
    }
};

// Helper to find parent for a given subcategory
export const getParentCategory = (subCategory, taxonomy = CATEGORY_TAXONOMY) => {
    if (!subCategory) return "Other";
    for (const [parent, data] of Object.entries(taxonomy)) {
        if (data.subcategories.includes(subCategory) || parent === subCategory) {
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

// Helper to get icon for a category
export const getCategoryIcon = (category, taxonomy = CATEGORY_TAXONOMY) => {
    const parent = getParentCategory(category, taxonomy);
    return taxonomy[parent]?.icon || "tag";
};
