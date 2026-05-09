// Curated top-10 popular dishes per cuisine. Images are fetched at runtime
// from Wikipedia via `useDishImage`, so we only store names here.
export type PopularRecipe = { name: string };

const wrap = (names: string[]): PopularRecipe[] => names.map((name) => ({ name }));

export const POPULAR_RECIPES: Record<string, PopularRecipe[]> = {
  American: wrap([
    "Cheeseburger", "BBQ Ribs", "Mac and Cheese", "Buffalo Wings", "Clam Chowder",
    "Cornbread", "Meatloaf", "Pulled Pork Sandwich", "Cobb Salad", "Apple Pie",
  ]),
  Pakistani: wrap([
    "Chicken Karahi", "Beef Nihari", "Chicken Biryani", "Haleem", "Chapli Kebab",
    "Aloo Keema", "Daal Chawal", "Seekh Kebab", "Paya", "Chicken Pulao",
  ]),
  Indian: wrap([
    "Butter Chicken", "Chana Masala", "Palak Paneer", "Biryani", "Dal Tadka",
    "Aloo Gobi", "Tandoori Chicken", "Samosa", "Rogan Josh", "Masala Dosa",
  ]),
  Italian: wrap([
    "Spaghetti Carbonara", "Margherita Pizza", "Lasagna", "Risotto Milanese", "Penne Arrabbiata",
    "Osso Buco", "Tiramisu", "Caprese Salad", "Fettuccine Alfredo", "Minestrone Soup",
  ]),
  Mexican: wrap([
    "Tacos al Pastor", "Enchiladas", "Chiles Rellenos", "Guacamole", "Pozole",
    "Tamales", "Mole Poblano", "Quesadillas", "Carnitas", "Elote",
  ]),
  Chinese: wrap([
    "Kung Pao Chicken", "Mapo Tofu", "Sweet and Sour Pork", "Dumplings", "Char Siu",
    "Hot and Sour Soup", "Fried Rice", "Chow Mein", "Peking Duck", "Beef and Broccoli",
  ]),
  Mediterranean: wrap([
    "Greek Salad", "Hummus", "Falafel", "Moussaka", "Spanakopita",
    "Shakshuka", "Paella", "Tabbouleh", "Grilled Branzino", "Stuffed Grape Leaves",
  ]),
  Thai: wrap([
    "Pad Thai", "Green Curry", "Tom Yum Soup", "Massaman Curry", "Som Tum",
    "Pad Krapow", "Tom Kha Gai", "Khao Pad", "Mango Sticky Rice", "Satay",
  ]),
};
