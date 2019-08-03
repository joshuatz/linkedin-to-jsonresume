const fs = require('fs');
const requiredDirs = ['./build-bookmarklet','./build-browserext'];

for (let x= 0; x<requiredDirs.length; x++){
    if (!fs.existsSync(requiredDirs[x])){
        fs.mkdirSync(requiredDirs[x]);
    }
}