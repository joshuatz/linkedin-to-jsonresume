const fse = require('fs-extra');
const requiredDirs = ['./build-bookmarklet','./build-browserext'];

for (let x= 0; x<requiredDirs.length; x++){
    if (!fse.existsSync(requiredDirs[x])){
        fse.mkdirSync(requiredDirs[x]);
    }
}