
const fs = require('fs');
const content = fs.readFileSync('src/app/teacher/tools/ilovepdf/page.tsx', 'utf8');

let braces = 0;
let parens = 0;
const start = 86;
const end = 485;

const lines = content.split('\n');

for (let l = start - 1; l < end; l++) {
    const line = lines[l];
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '{') braces++;
        if (char === '}') braces--;
        if (char === '(') parens++;
        if (char === ')') parens--;
    }
}

console.log(`Braces in range: ${braces}`);
console.log(`Parens in range: ${parens}`);
