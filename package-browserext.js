/**
 * @file Creates a ZIP file that contains everything necessary to publish as a browser extension (publish to Chrome webstore)
 */
const fse = require('fs-extra');
const archiver = require('archiver');

// Get version info
const versionString = require("./package.json").version.toString();

var output = fse.createWriteStream("./webstore-zips/build_"+versionString+".zip");
var archive = archiver("zip", {
    zlib : {level : 6} // compression level
});

// listen for all archive data to be written 
output.on("close", function() {
  console.log(archive.pointer() + " total bytes");
  console.log("archiver has been finalized and the output file descriptor has closed.");
});
 
// good practice to catch this error explicitly 
archive.on("error", function(err) {
  throw err;
});
 
// pipe archive data to the file 
archive.pipe(output);
 
// append files from a directory 
archive.directory("./build-browserext/","");
 
// finalize the archive (ie we are done appending files but streams have to finish yet) 
archive.finalize();