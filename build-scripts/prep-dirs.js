const fse = require('fs-extra');

const requiredDirs = [`${__dirname}/../build`, `${__dirname}/../build-bookmarklet`, `${__dirname}/../build-browserext`, `${__dirname}/../webstore-zips`];

// Directories to always empty first
const cleanDirs = [`${__dirname}/../build`, `${__dirname}/../build-bookmarklet`, `${__dirname}/../build-browserext`];

const prep = async () => {
    await Promise.all(requiredDirs.map((r) => fse.ensureDir(r)));
    await Promise.all(cleanDirs.map((c) => fse.emptyDir(c)));
};

prep();
