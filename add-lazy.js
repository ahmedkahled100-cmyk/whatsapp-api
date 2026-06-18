const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.resolve(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx')) {
      results.push(file);
    }
  });
  return results;
}

let modifiedCount = 0;
walk('./src').forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let newContent = content
    .replace(/<img src=/g, '<img loading="lazy" src=')
    .replace(/<img className=/g, '<img loading="lazy" className=');
  
  // Quick fix for double loading="lazy" if we run it multiple times or there are conflicts
  newContent = newContent.replace(/loading="lazy"\s+loading="lazy"/g, 'loading="lazy"');

  if (newContent !== content) {
    fs.writeFileSync(file, newContent);
    modifiedCount++;
  }
});
console.log(`Added loading="lazy" to ${modifiedCount} files.`);
