import fs from 'fs';
// import path from 'path';

const rootPkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
const frontendPkg = JSON.parse(fs.readFileSync('frontend/package.json', 'utf-8'));
const backendPkg = JSON.parse(fs.readFileSync('backend/package.json', 'utf-8'));

const redundantDeps = Object.keys(rootPkg.dependencies || {}).filter(dep =>
  (frontendPkg.dependencies && dep in frontendPkg.dependencies) ||
  (backendPkg.dependencies && dep in backendPkg.dependencies)
);

console.log("Redundant root-level dependencies:");
console.log(redundantDeps.join('\n'));
