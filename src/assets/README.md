# Icon Assets for A1 Distribution

Place the following icon files in this directory for packaging:

## Required Files:
1. **a1-logo.icns** - macOS app icon (1024x1024 recommended)
2. **a1-logo.ico** - Windows app icon (256x256 recommended)
3. **a1-logo.png** - Linux app icon (512x512 recommended)
4. **dmg-background.png** - Custom DMG background (540x380 pixels)

## Creating Icons:
- Use a 1024x1024 PNG as your source
- For .icns: Use `iconutil` or apps like Image2Icon
- For .ico: Use online converters or image editors
- DMG background should show where to drag the app icon

## Icon Generation Commands:
```bash
# Convert PNG to ICNS (macOS)
iconutil -c icns a1-logo.iconset

# Create iconset first
mkdir a1-logo.iconset
sips -z 16 16     a1-logo.png --out a1-logo.iconset/icon_16x16.png
sips -z 32 32     a1-logo.png --out a1-logo.iconset/icon_16x16@2x.png
sips -z 32 32     a1-logo.png --out a1-logo.iconset/icon_32x32.png
sips -z 64 64     a1-logo.png --out a1-logo.iconset/icon_32x32@2x.png
sips -z 128 128   a1-logo.png --out a1-logo.iconset/icon_128x128.png
sips -z 256 256   a1-logo.png --out a1-logo.iconset/icon_128x128@2x.png
sips -z 256 256   a1-logo.png --out a1-logo.iconset/icon_256x256.png
sips -z 512 512   a1-logo.png --out a1-logo.iconset/icon_256x256@2x.png
sips -z 512 512   a1-logo.png --out a1-logo.iconset/icon_512x512.png
sips -z 1024 1024 a1-logo.png --out a1-logo.iconset/icon_512x512@2x.png
```