# Xcode Setup Guide for Saver's Pantry iOS

## ✅ Completed Steps
- [x] Cloned GitHub repository
- [x] Installed npm dependencies
- [x] Built the web app (dist/ folder)
- [x] Generated Capacitor iOS project
- [x] Set App ID to: `com.saverspantry.app`
- [x] Opened Xcode (using Swift Package Manager - no CocoaPods needed)

## 📋 Next Steps in Xcode

### Important Note: Capacitor v8 uses Swift Package Manager (SPM)
Your project uses Capacitor v8.3.3, which uses Swift Package Manager instead of CocoaPods. This means:
- No Podfile installation needed
- No separate .xcworkspace file
- Dependencies are managed through Xcode's built-in SPM

### Step 1: Configure Signing & Certificates
1. In Xcode, select the **"App" target** in the left navigator
2. Go to the **"Signing & Capabilities" tab**
3. Under **Team**, select your Apple Developer account (or "None" for simulator testing)
4. For **Bundle Identifier**, verify it shows: `com.saverspantry.app`
5. If there are any red warnings about provisioning profiles, click "Fix Issues"

### Step 2: Choose Build Target
1. At the top of Xcode, select your build target:
   - **iPhone Simulator** (for testing on simulator)
   - Or your **connected iPhone** (for device testing)

### Step 3: Build & Run
1. Press **Cmd + R** to build and run
2. OR go to **Product → Run**
3. Watch the build progress in the bottom panel
1. In Xcode, select the **"App" target** in the left navigator
2. Go to the **"Signing & Capabilities" tab**
3. Under **Team**, select your Apple Developer account (or "None" for simulator testing)
4. For **Bundle Identifier**, verify it shows: `com.saverspantry.app`
5. If there are any red warnings about provisioning profiles, click "Fix Issues"

### Step 3: Choose Build Target
1. At the top of Xcode, select your build target:
   - **iPhone Simulator** (for testing on simulator)
   - Or your **connected iPhone** (for device testing)

### Step 4: Build & Run
1. Press **Cmd + R** to build and run
2. OR go to **Product → Run**
3. Watch the build progress in the bottom panel

## 🐛 Troubleshooting

### Opening Xcode Project
- **Always use**: `npx cap open ios` command to open the project
- **Don't manually open**: `.xcworkspace` files - let Capacitor handle it
- **Capacitor v8+ uses SPM**: No CocoaPods needed, dependencies are managed by Xcode

### CocoaPods Issues (Not Applicable for Capacitor v8)
Your project uses Capacitor v8.3.3 with Swift Package Manager, so CocoaPods is not needed.

### Signing Errors
- Ensure you have an Apple Developer account signed in (Xcode → Settings → Accounts)
- Select a valid team in Signing & Capabilities
- For simulator, you can use "None"

### Build Fails
1. Try: **Product → Clean Build Folder** (Cmd + Shift + K)
2. Then: **Product → Build** (Cmd + B)
3. Check the issue navigator for detailed errors

## 📱 Testing Options

### On Simulator
- Select iPhone 15 or other available simulator
- Press Cmd + R to run
- Fastest for development

### On Real Device
1. Connect your iPhone via USB
2. Trust the computer on your device
3. Select your device in the build target dropdown
4. Press Cmd + R

## 📝 Useful Commands (in Terminal)

```bash
# Sync web changes to iOS app
cd /Users/ah/Documents/SaversPantry
npm run build
npx cap copy ios

# Re-open in Xcode
npx cap open ios

# Full sync (web build + copy + sync plugins)
npm run build && npx cap sync ios
```

## 🎯 Key Files
- **Web App**: `/Users/ah/Documents/SaversPantry/src/`
- **Capacitor Config**: `/Users/ah/Documents/SaversPantry/capacitor.config.ts`
- **iOS Project**: `/Users/ah/Documents/SaversPantry/ios/App/App.xcworkspace`
- **Pod Dependencies**: `/Users/ah/Documents/SaversPantry/ios/App/Podfile`

## 💡 Tips
- Always use the `.xcworkspace` file (not `.xcodeproj`) when opening in Xcode
- After updating the web app, run `npx cap copy ios` to sync changes
- Test on simulator first before testing on a real device
- Use Xcode's debugger to inspect your app: **Debug → View Hierarchy**
