// Curated top-10 popular dishes per cuisine. Image keywords feed loremflickr
// for a free, food-themed thumbnail without needing to host assets.
export type PopularRecipe = { name: string; img: string };

const img = (kw: string) =>
  `https://loremflickr.com/400/300/${encodeURIComponent(kw)},food?lock=${Math.abs(
    [...kw].reduce((a, c) => a + c.charCodeAt(0), 0),
  )}`;

export const POPULAR_RECIPES: Record<string, PopularRecipe[]> = {
  American: [
    "Cheeseburger", "BBQ Ribs", "Mac and Cheese", "Buffalo Wings", "Clam Chowder",
    "Cornbread", "Meatloaf", "Pulled Pork Sandwich", "Cobb Salad", "Apple Pie",
  ].map((n) => ({ name: n, img: img(n) })),
  Pakistani: [
    "Chicken Karahi", "Beef Nihari", "Chicken Biryani", "Haleem", "Chapli Kebab",
    "Aloo Keema", "Daal Chawal", "Seekh Kebab", "Paya", "Chicken Pulao",
  ].map((n) => ({ name: n, img: img(n) })),
  Indian: [
    "Butter Chicken", "Chana Masala", "Palak Paneer", "Biryani", "Dal Tadka",
    "Aloo Gobi", "Tandoori Chicken", "Samosa", "Rogan Josh", "Masala Dosa",
  ].map((n) => ({ name: n, img: img(n) })),
  Italian: [
    "Spaghetti Carbonara", "Margherita Pizza", "Lasagna", "Risotto Milanese", "Penne Arrabbiata",
    "Osso Buco", "Tiramisu", "Caprese Salad", "Fettuccine Alfredo", "Minestrone Soup",
  ].map((n) => ({ name: n, img: img(n) })),
  Mexican: [
    "Tacos al Pastor", "Enchiladas", "Chiles Rellenos", "Guacamole", "Pozole",
    "Tamales", "Mole Poblano", "Quesadillas", "Carnitas", "Elote",
  ].map((n) => ({ name: n, img: img(n) })),
  Chinese: [
    "Kung Pao Chicken", "Mapo Tofu", "Sweet and Sour Pork", "Dumplings", "Char Siu",
    "Hot and Sour Soup", "Fried Rice", "Chow Mein", "Peking Duck", "Beef and Broccoli",
  ].map((n) => ({ name: n, img: img(n) })),
  Mediterranean: [
    "Greek Salad", "Hummus", "Falafel", "Moussaka", "Spanakopita",
    "Shakshuka", "Paella", "Tabbouleh", "Grilled Branzino", "Stuffed Grape Leaves",
  ].map((n) => ({ name: n, img: img(n) })),
  Thai: [
    "Pad Thai", "Green Curry", "Tom Yum Soup", "Massaman Curry", "Som Tum",
    "Pad Krapow", "Tom Kha Gai", "Khao Pad", "Mango Sticky Rice", "Satay",
  ].map((n) => ({ name: n, img: img(n) })),
};
