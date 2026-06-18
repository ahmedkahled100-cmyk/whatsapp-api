const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      let changed = false;
      for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        if (line.includes('modal-overlay') && line.includes('onClick={')) {
          const start = line.indexOf('onClick={');
          let end = -1;
          
          // To safely find the matching '}', we can just find the last '}' before '>'
          // Since it's on one line, this is fairly reliable for our use case.
          const gtIndex = line.lastIndexOf('>');
          if (gtIndex > start) {
             const strBeforeGt = line.substring(0, gtIndex);
             end = strBeforeGt.lastIndexOf('}');
             if (end > start) {
                lines[i] = line.substring(0, start) + line.substring(end + 1);
                changed = true;
             }
          }
        }
      }
      if (changed) {
        fs.writeFileSync(fullPath, lines.join('\n'));
        console.log('Updated ' + fullPath);
      }
    }
  }
}
processDir('c:/Users/Ahmed Khaled/Desktop/AN-Academy-NextJS/src');
