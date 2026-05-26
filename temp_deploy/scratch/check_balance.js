
const fs = require('fs');
const content = fs.readFileSync('src/app/teacher/tools/ilovepdf/page.tsx', 'utf8');

let braces = 0;
let parens = 0;
let inString = false;
let stringChar = '';

const lines = content.split('\n');
let currentLine = 1;
let currentCol = 0;

for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '\n') {
        currentLine++;
        currentCol = 0;
    } else {
        currentCol++;
    }

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
    
    // Ignore comments
    if (char === '/' && content[i+1] === '/') {
        while (content[i] !== '\n' && i < content.length) i++;
        currentLine++; currentCol = 0;
        continue;
    }

    if (char === '{') braces++;
    if (char === '}') {
        braces--;
        if (braces < 0) {
            console.log(`Extra } found at Line ${currentLine}, Col ${currentCol}`);
            // console.log("Context:", lines[currentLine-1]);
        }
    }
    if (char === '(') parens++;
    if (char === ')') {
        parens--;
        if (parens < 0) {
            console.log(`Extra ) found at Line ${currentLine}, Col ${currentCol}`);
            // console.log("Context:", lines[currentLine-1]);
        }
    }
}
