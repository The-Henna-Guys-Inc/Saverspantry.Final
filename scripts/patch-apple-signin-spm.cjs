// Patches @capacitor-community/apple-sign-in Package.swift so it accepts
// Capacitor 8 (capacitor-swift-pm 8.x). The plugin upstream pins to 7.x.
// Safe to run repeatedly. Runs via postinstall.
const fs = require("fs");
const path = require("path");

const pkgSwift = path.join(
  __dirname,
  "..",
  "node_modules",
  "@capacitor-community",
  "apple-sign-in",
  "Package.swift"
);

if (!fs.existsSync(pkgSwift)) {
  // Plugin not installed in this environment (e.g. sandbox). Skip silently.
  process.exit(0);
}

const original = fs.readFileSync(pkgSwift, "utf8");
const patched = original.replace(
  /\.package\(\s*url:\s*"https:\/\/github\.com\/ionic-team\/capacitor-swift-pm\.git"\s*,\s*from:\s*"7\.0\.0"\s*\)/,
  '.package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", "7.0.0"..<"9.0.0")'
);

if (patched !== original) {
  fs.writeFileSync(pkgSwift, patched);
  console.log("[patch-apple-signin-spm] Widened capacitor-swift-pm range to 7..<9");
} else {
  console.log("[patch-apple-signin-spm] No changes needed");
}
