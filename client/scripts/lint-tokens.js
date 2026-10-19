import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '../src');

// Allowed tokens and allowed standard industrial tokens
const ALLOWED_HEX = new Set([
  '#14161A', '#1B1E23', '#22262C', '#2A2E35', '#E7E9EC', '#9AA0A8', '#676D76',
  '#F4F3EF', '#FFFFFF', '#EAE8E2', '#D9D7D0', '#1A1C1F', '#5F646B', '#8C929B',
  '#F2A900', '#D99800',
  '#3FA37A', '#8A9099', '#4C8DD6', '#D9473F', '#E08A2E', '#5A5F66',
  '#111317', '#1D2128', '#4A505A', '#21252B', '#E6E4DD', '#E8E6E0', '#A6A49D', '#F9F8F5', '#E2DFD7'
]);

const BANNED_PATTERNS = [
  { pattern: /backdrop-blur/g, name: 'backdrop-blur (Banned: No glassmorphism)' },
  { pattern: /bg-gradient/g, name: 'bg-gradient (Banned: No gradients)' },
  { pattern: /shadow-(md|lg|xl|2xl)/g, name: 'heavy shadow (Banned: Elevation by tone only)' },
  { pattern: /from-(purple|blue|indigo|cyan)-/g, name: 'gradient color stop (Banned)' },
];

let totalViolations = 0;
const violations = [];

function checkFile(filePath) {
  const relPath = path.relative(srcDir, filePath);
  // Exclude compiled output and token definitions
  if (relPath.includes('compiled.css') || relPath.includes('tokens.css') || relPath.includes('tailwind-input.css')) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  // Check banned string patterns
  for (const { pattern, name } of BANNED_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach(m => {
        violations.push({
          file: relPath,
          issue: `Found banned pattern "${m}" (${name})`,
        });
        totalViolations++;
      });
    }
  }

  // Check for arbitrary hex codes outside allowed token set
  const hexMatches = content.match(/#[0-9a-fA-F]{3,8}/g) || [];
  for (const hex of hexMatches) {
    const upper = hex.toUpperCase();
    if (!ALLOWED_HEX.has(upper) && upper !== '#FFF' && upper !== '#000') {
      violations.push({
        file: relPath,
        issue: `Hardcoded hex color "${hex}" is outside the Precision Graphite token set`,
      });
      totalViolations++;
    }
  }
}

function traverse(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      traverse(full);
    } else if (f.endsWith('.tsx') || f.endsWith('.ts') || f.endsWith('.css')) {
      checkFile(full);
    }
  }
}

console.log('================================================================');
console.log('  RUNNING PRECISION GRAPHITE DESIGN SYSTEM TOKEN & BAN AUDIT    ');
console.log('================================================================');

traverse(srcDir);

if (totalViolations > 0) {
  console.error(`\nFAILED: Found ${totalViolations} design-system violations:`);
  violations.forEach(v => {
    console.error(`  - [${v.file}] ${v.issue}`);
  });
  process.exit(1);
} else {
  console.log(`\nPASSED: 0 violations found across all UI source files!`);
  console.log('All surfaces, typography, status glyphs, and borders strictly conform to Precision Graphite.');
  console.log('================================================================');
  process.exit(0);
}
