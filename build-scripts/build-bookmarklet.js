// Dependencies
// @ts-ignore
const replace = require('replace');
const fse = require('fs-extra');
const childProc = require('child_process');

// Paths
const buildFolder = `${__dirname}/../build-bookmarklet/`;
const installFileHtml = `${buildFolder}install-page.html`;
const srcFolder = `${__dirname}/../src/`;

// Copy src to build and then append some JS that will auto-execute when ran
fse.copyFileSync(`${srcFolder}main.js`, `${buildFolder}main.js`);
fse.appendFileSync(`${buildFolder}main.js`, 'window.linkedinToResumeJsonConverter = new LinkedinToResumeJson();\nwindow.linkedinToResumeJsonConverter.parseAndShowOutput();');

// Run bookmarklet converter
childProc.execSync('bookmarklet ./build/main.js ./build-bookmarklet/bookmarklet_export.js');

// Get entire contents of processed bookmarklet code as var
const bookmarkletContent = fse.readFileSync(`${buildFolder}bookmarklet_export.js`);

// Copy template install page to build folder
fse.copyFileSync('./bookmarklet-resources/install-page-template.html', installFileHtml);

// Replace placeholder variable in install HTML file with raw contents
replace({
    regex: '{{bookmarklet_code}}',
    replacement: bookmarkletContent,
    paths: [installFileHtml],
    recursive: true,
    silent: false
});
