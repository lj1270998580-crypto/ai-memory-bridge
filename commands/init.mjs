#!/usr/bin/env node
/**
 * init.mjs — Initialize AI Memory Bridge for current project
 * Scans project structure and generates DNA
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { detectProject, getStoragePaths, ensureDirs } from '../lib/detect-project.mjs';

function main() {
  try {
    const project = detectProject();
    const paths = getStoragePaths(project);
    
    console.log('🔧 AI Memory Bridge: Initializing...\n');
    console.log(`Project: ${project.project_name}`);
    console.log(`Root: ${project.project_root}`);
    console.log(`ID: ${project.project_id}\n`);
    
    // Ensure directories exist
    mkdirSync(paths.project.experiences, { recursive: true });
    mkdirSync(project.global_memory_dir, { recursive: true });
    mkdirSync(resolve(project.global_memory_dir, 'experiences'), { recursive: true });
    
    // Generate or update DNA
    const dna = generateDNA(project);
    
    writeFileSync(paths.project.dna, JSON.stringify(dna, null, 2));
    
    console.log('✅ Generated DNA:');
    console.log(`  Name: ${dna.name}`);
    console.log(`  Stack: ${dna.stack.join(', ')}`);
    console.log(`  Goal: ${dna.goal}`);
    
    if (dna.constraints.length > 0) {
      console.log(`  Constraints: ${dna.constraints.length}`);
    }
    
    console.log('\n📁 Created:');
    console.log(`  ${paths.project.dna}`);
    console.log(`  ${paths.project.experiences}/`);
    
    // Check if .gitignore exists and suggest adding .ai-memory
    const gitignorePath = resolve(project.project_root, '.gitignore');
    if (existsSync(gitignorePath)) {
      const gitignore = readFileSync(gitignorePath, 'utf8');
      if (!gitignore.includes('.ai-memory')) {
        console.log('\n💡 Tip: Add ".ai-memory/" to .gitignore if you want to keep experiences local-only.');
        console.log('   Or keep it tracked to share team experiences.');
      }
    }
    
    console.log('\n🚀 Ready! Hooks will automatically learn from tool executions.');
    console.log('   Run /amb:status to see memory stats.');
    
  } catch (err) {
    console.error('❌ Initialization failed:', err.message);
    process.exit(1);
  }
}

function generateDNA(project) {
  const dna = {
    name: project.project_name,
    version: '1.0.0',
    generated_at: new Date().toISOString(),
    stack: [],
    goal: '',
    constraints: [],
    pain_points: [],
    conventions: {}
  };
  
  // Detect stack from files
  const root = project.project_root;
  
  if (existsSync(resolve(root, 'package.json'))) {
    try {
      const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
      
      if (pkg.dependencies?.next || pkg.devDependencies?.next) dna.stack.push('Next.js');
      if (pkg.dependencies?.react || pkg.devDependencies?.react) dna.stack.push('React');
      if (pkg.dependencies?.vue || pkg.devDependencies?.vue) dna.stack.push('Vue');
      if (pkg.dependencies?.express) dna.stack.push('Express');
      if (pkg.dependencies?.typescript || pkg.devDependencies?.typescript) dna.stack.push('TypeScript');
      if (pkg.dependencies?.prisma || pkg.devDependencies?.prisma) dna.stack.push('Prisma');
      if (pkg.dependencies?.drizzle_orm) dna.stack.push('Drizzle');
      if (pkg.dependencies?.tailwindcss || pkg.devDependencies?.tailwindcss) dna.stack.push('TailwindCSS');
      
      // Test frameworks
      if (pkg.devDependencies?.jest) dna.stack.push('Jest');
      if (pkg.devDependencies?.vitest) dna.stack.push('Vitest');
      if (pkg.devDependencies?.playwright) dna.stack.push('Playwright');
      
      dna.goal = pkg.description || '';
    } catch {
      // Invalid package.json
    }
  }
  
  if (existsSync(resolve(root, 'requirements.txt'))) {
    dna.stack.push('Python');
    if (existsSync(resolve(root, 'manage.py'))) dna.stack.push('Django');
    if (existsSync(resolve(root, 'app.py'))) dna.stack.push('Flask');
  }
  
  if (existsSync(resolve(root, 'Cargo.toml'))) {
    dna.stack.push('Rust');
  }
  
  if (existsSync(resolve(root, 'go.mod'))) {
    dna.stack.push('Go');
  }
  
  if (existsSync(resolve(root, 'Dockerfile')) || existsSync(resolve(root, 'docker-compose.yml'))) {
    dna.stack.push('Docker');
  }
  
  // Detect conventions
  if (existsSync(resolve(root, 'tsconfig.json'))) {
    try {
      const tsconfig = JSON.parse(readFileSync(resolve(root, 'tsconfig.json'), 'utf8'));
      if (tsconfig.compilerOptions?.strict) {
        dna.constraints.push('Strict TypeScript mode');
      }
    } catch {}
  }
  
  if (existsSync(resolve(root, '.eslintrc')) || existsSync(resolve(root, '.eslintrc.js'))) {
    dna.constraints.push('ESLint configured');
  }
  
  if (existsSync(resolve(root, '.prettierrc'))) {
    dna.constraints.push('Prettier configured');
  }
  
  // Default conventions
  if (dna.stack.includes('TypeScript')) {
    dna.conventions.typeScript = {
      strict: true,
      noImplicitAny: true,
      preferInterfaces: true
    };
  }
  
  return dna;
}

main();
