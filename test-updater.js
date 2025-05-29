#!/usr/bin/env node

const { autoUpdater } = require('electron-updater');
const path = require('path');

console.log('🔄 Testing Pairkiller Auto-Updater Configuration...\n');

// Configure for GitHub
autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'hybes',
    repo: 'pairkiller'
});

console.log('✅ Feed URL configured for GitHub');
console.log('   Repository: hybes/pairkiller');
console.log('   Provider: GitHub Releases');

// Test auto-updater configuration
console.log('\n📋 Auto-updater configuration:');
console.log('   Current version:', require('./package.json').version);
console.log('   Platform:', process.platform);
console.log('   Architecture:', process.arch);

// Expected file patterns
const expectedFiles = {
    'win32': ['latest.yml'],
    'darwin': ['latest-mac.yml'],
    'linux': ['latest-linux.yml']
};

const platform = process.platform;
const expectedFile = expectedFiles[platform]?.[0] || 'latest.yml';

console.log(`\n🎯 Expected auto-updater file for ${platform}: ${expectedFile}`);

// Check if local build has the right files
const fs = require('fs');
if (fs.existsSync(`dist/${expectedFile}`)) {
    console.log(`✅ Local build has ${expectedFile}`);
    
    // Read and display the file
    try {
        const content = fs.readFileSync(`dist/${expectedFile}`, 'utf8');
        console.log('\n📄 Auto-updater manifest content:');
        console.log(content);
    } catch (error) {
        console.log(`❌ Error reading ${expectedFile}:`, error.message);
    }
} else {
    console.log(`❌ Local build missing ${expectedFile}`);
    console.log('   Available files in dist/:');
    if (fs.existsSync('dist/')) {
        fs.readdirSync('dist/').forEach(file => {
            console.log(`   - ${file}`);
        });
    }
}

console.log('\n🚀 Auto-updater test complete!');
console.log('\n💡 To resolve 404 errors:');
console.log('1. Ensure GitHub release includes the auto-updater files');
console.log('2. Check that the release tag matches the app version');
console.log('3. Verify the release is published (not draft)');
console.log('4. Wait a few minutes for CDN propagation');

console.log('\n📝 Next steps:');
console.log('1. Run: npm run release');
console.log('2. Push to GitHub with version bump');
console.log('3. Wait for GitHub Actions to complete');
console.log('4. Verify release artifacts include latest*.yml files'); 