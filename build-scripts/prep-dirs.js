const fse = require('fs-extra');

const requiredDirs = [`${__dirname}/../build`, `${__dirname}/../build-bookmarklet`, `${__dirname}/../build-browserext`, `${__dirname}/../webstore-zips`];

// Directories to always empty first
const cleanDirs = [`${__dirname}/../build`, `${__dirname}/../build-bookmarklet`, `${__dirname}/../build-browserext`];

for (let x = 0; x < requiredDirs.length; x++) {
    if (!fse.existsSync(requiredDirs[x])) {
        fse.mkdirSync(requiredDirs[x]);
    }
}

for (let x = 0; x < cleanDirs.length; x++) {
    if (fse.existsSync(cleanDirs[x])) {
        fse.emptyDirSync(cleanDirs[x]);
    }
}
