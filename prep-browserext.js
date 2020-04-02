const fse = require('fs-extra');
const packageJson = require('./package.json');
const manifestJson = require('./manifest.json');

const browserExtSrcDir = './browser-ext/';
const mainJs = './build/main.js';
const buildDir = './build-browserext/';

// Clean out build dir
fse.emptyDirSync(buildDir);

// Copy version number over to manifest, and write it out to build dir
manifestJson.version = packageJson.version;
fse.writeFileSync(`${buildDir}manifest.json`, JSON.stringify(manifestJson, null, 4));

// Copy main js file, after babel, over to build
fse.copyFileSync(mainJs, `${buildDir}main.js`);

// Copy all files from browser extension folder to build
fse.copySync(browserExtSrcDir, buildDir);
