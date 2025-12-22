const fs = require('fs');
const path = require('path');

const gradlePath = path.join(__dirname, 'android', 'build.gradle');

try {
  let content = fs.readFileSync(gradlePath, 'utf8');

  // Check if ext block exists
  if (content.includes('buildscript {')) {
    // Inject kspVersion if not present, or replace it
    // We want to force kspVersion compatible with Kotlin 1.9.24
    const kspFix = 'kspVersion = "1.9.24-1.0.20"';

    if (content.includes('kspVersion =')) {
      content = content.replace(/kspVersion\s*=\s*".*?"/, kspFix);
    } else {
      // Inject into ext block
      // Look for ext { or just put it in buildscript
      // safest is to add it to buildscript > ext if it exists, or create it.
      // Standard expo build.gradle has buildscript { ext { ... } }
      if (content.includes('ext {')) {
        content = content.replace('ext {', `ext {\n        ${kspFix}`);
      } else {
        content = content.replace('buildscript {', `buildscript {\n    ext {\n        ${kspFix}\n    }`);
      }
    }

    fs.writeFileSync(gradlePath, content);
    console.log('Updated android/build.gradle with ' + kspFix);
  } else {
    console.error('Could not find buildscript block in android/build.gradle');
  }
} catch (err) {
  console.error('Error fixing android/build.gradle:', err);
}
