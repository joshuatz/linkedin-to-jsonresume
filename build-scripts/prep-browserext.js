const fse = require('fs-extra');
const packageJson = require('../package.json');
const manifestJson = require('../browser-ext/manifest.json');

const browserExtSrcDir = `${__dirname}/../browser-ext/`;
const mainJs = `${__dirname}/../build/main.js`;
const buildDir = `${__dirname}/../build-browserext/`;

// Clean out build dir
fse.emptyDirSync(buildDir);

// Copy all files from browser extension folder to build
fse.copySync(browserExtSrcDir, buildDir);

// Copy version number over to manifest, and write it out to build dir
manifestJson.version = packageJson.version;
fse.writeFileSync(`${buildDir}manifest.json`, JSON.stringify(manifestJson, null, 4));

// Copy main js file, after babel, over to build
fse.copyFileSync(mainJs, `${buildDir}main.js`);
