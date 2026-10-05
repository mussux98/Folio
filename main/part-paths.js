const path = require('path');

// The file paths for the parts of a split document: "name - part 1.pdf", and so
// on, in the folder. If any of them already exist, all get the same "(2)",
// "(3)"... added, so a split never writes over a file. exists(path) -> boolean.
function partPaths(folder, baseName, count, exists) {
  for (let attempt = 1; ; attempt++) {
    const tag = attempt === 1 ? '' : ` (${attempt})`;
    const paths = Array.from({ length: count }, (_, i) => path.join(folder, `${baseName}${tag} - part ${i + 1}.pdf`));
    if (!paths.some(exists)) return paths;
  }
}

module.exports = { partPaths };
