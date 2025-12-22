const fs = require('fs');
const path = require('path');

const appGradlePath = path.join(__dirname, 'android', 'app', 'build.gradle');

try {
    let content = fs.readFileSync(appGradlePath, 'utf8');

    // Comment out enableBundleCompression
    if (content.includes('enableBundleCompression')) {
        console.log('Found enableBundleCompression, commenting it out...');
        content = content.replace(/enableBundleCompression/g, '// enableBundleCompression');
        fs.writeFileSync(appGradlePath, content);
        console.log('Updated app/build.gradle');
    } else {
        console.log('enableBundleCompression not found in app/build.gradle');
    }
} catch (err) {
    console.error('Error fixing app/build.gradle:', err);
}
