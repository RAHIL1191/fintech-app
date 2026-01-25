# AltStore Sideloading Guide for FinTech App

## Prerequisites

1. **iPhone/iPad** with iOS 14.0+
2. **Windows PC** with iTunes installed (from [Apple's website](https://www.apple.com/itunes/), NOT Microsoft Store)
3. **Lightning/USB-C cable** to connect your device

---

## Step 1: Install AltServer on Windows

1. Download AltServer from https://altstore.io
2. Extract and run `AltInstaller.exe`
3. AltServer will run in the system tray

---

## Step 2: Install AltStore on iPhone

1. Connect your iPhone to your PC via USB
2. Open iTunes and ensure your device is recognized
3. Click the **AltServer icon** in the system tray
4. Select **Install AltStore** → Choose your device
5. Enter your **Apple ID** and **password** (used for signing, not stored)
6. AltStore will appear on your iPhone

> ⚠️ On iPhone: Go to **Settings → General → VPN & Device Management** and trust your Apple ID

---

## Step 3: Build the IPA

### Option A: Use Current EAS Build
Wait for your current build to finish, then download the `.app` file.

### Option B: Build Locally (requires Mac)
```bash
cd frontend
npx expo run:ios --configuration Release
```

---

## Step 4: Convert .app to .ipa (if needed)

If you have a `.app` bundle:
```bash
mkdir Payload
mv YourApp.app Payload/
zip -r FinTechApp.ipa Payload
```

---

## Step 5: Sideload with AltStore

1. **Transfer the IPA** to your iPhone (via AirDrop, iCloud, or email)
2. **Open AltStore** on your iPhone
3. Go to **My Apps** tab
4. Tap the **+** button and select your IPA file
5. The app will install!

---

## Important Notes

| Limitation | Details |
|------------|---------|
| **7-Day Expiration** | Apps expire after 7 days. Re-sideload to refresh. |
| **3 App Limit** | Free Apple IDs can only have 3 sideloaded apps |
| **AltServer Required** | Keep AltServer running on PC to refresh apps automatically |

---

## Auto-Refresh Setup

To avoid manual re-sideloading every 7 days:

1. Keep **AltServer running** on your PC
2. Connect to the **same WiFi** as your iPhone
3. AltStore will **auto-refresh** apps in the background

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Could not find AltServer" | Ensure AltServer is running and both devices are on same WiFi |
| "Apple ID not trusted" | Go to Settings → General → VPN & Device Management → Trust |
| iTunes not detecting device | Use Apple's iTunes, not Microsoft Store version |
