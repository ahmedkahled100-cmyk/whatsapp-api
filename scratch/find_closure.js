
const fs = require('fs');
const content = fs.readFileSync('src/app/teacher/tools/ilovepdf/page.tsx', 'utf8');

let braces = 0;
let parens = 0;
let inString = false;
let stringChar = '';

for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (inString) {
        if (char === stringChar && content[i-1] !== '\\') {
            inString = false;
        }
        continue;
    }
    if (char === '"' || char === "'" || char === '`') {
        inString = true;
        stringChar = char;
        continue;
    }
    
    if (char === '{') braces++;
    if (char === '}') {
        braces--;
        if (braces === 1) {
            // console.log(`Braces hit 1 at Line ${content.substring(0, i).split('\n').length}`);
        }
        if (braces === 0) {
            console.log(`Braces hit 0 at Line ${content.substring(0, i).split('\n').length}`);
        }
    }
    if (char === '(') parens++;
    if (char === ')') parens--;
}
