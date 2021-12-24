const fse = require('fs-extra');
const packageJson = require('../package.json');
const manifestJson = require('../browser-ext/manifest.json');

const browserExtSrcDir = `${__dirname}/../browser-ext/`;
const buildDir = `${__dirname}/../build/`;
const browserBuildDir = `${__dirname}/../build-browserext/`;

// Clean out build dir
fse.emptyDirSync(browserBuildDir);

// Copy all files from browser extension folder to build
fse.copySync(browserExtSrcDir, browserBuildDir);

// Copy version number over to manifest, and write it out to build dir
// @ts-ignore
manifestJson.version = packageJson.version;
fse.writeFileSync(`${browserBuildDir}manifest.json`, JSON.stringify(manifestJson, null, 4));

// Copy main js file, after babel, over to build
fse.copySync(buildDir, browserBuildDir);
