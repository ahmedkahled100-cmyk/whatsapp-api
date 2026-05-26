
const fs = require('fs');
const content = fs.readFileSync('src/app/teacher/tools/ilovepdf/page.tsx', 'utf8');

let braces = 0;
const startLine = 12;
const endLine = 489;

const lines = content.split('\n');
for (let l = startLine - 1; l < endLine; l++) {
    const line = lines[l];
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '{') braces++;
        if (char === '}') braces--;
    }
}

console.log(`Braces at start of line 489: ${braces}`);
