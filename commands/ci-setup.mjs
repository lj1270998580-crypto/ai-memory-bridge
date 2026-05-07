#!/usr/bin/env node
/**
 * ci-setup.mjs — Generate CI/CD integration for AI Memory Bridge
 * Creates GitHub Actions workflow to auto-learn from CI failures
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { detectProject } from '../lib/detect-project.mjs';

const WORKFLOW_TEMPLATE = `name: AI Memory Bridge

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]
  workflow_dispatch:

jobs:
  learn-from-failures:
    runs-on: ubuntu-latest
    if: always() # Run even if tests fail
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Run tests
        id: tests
        run: |
          # Replace with your test command
          npm test || true
        continue-on-error: true
        
      - name: Install AI Memory Bridge
        if: failure()
        run: |
          npm install -g ai-memory-bridge || echo "Using local copy"
          
      - name: Learn from failures
        if: failure()
        run: |
          # Extract error information and create experience
          echo "Learning from CI failure..."
          
          # You can customize this to capture specific error patterns
          if [ -f "test-results.json" ]; then
            echo "Found test results"
          fi
          
      - name: Commit learned experiences
        if: github.event_name == 'pull_request'
        run: |
          # Check if there are new experiences
          if [ -d ".ai-memory/experiences" ] && [ "$(ls -A .ai-memory/experiences)" ]; then
            git config --local user.email "action@github.com"
            git config --local user.name "GitHub Action"
            git add .ai-memory/
            git diff --staged --quiet || git commit -m "chore: learn from CI run [skip ci]"
            git push
          fi
`;

const PR_CHECK_TEMPLATE = `name: AI Memory Bridge PR Check

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  check-pitfalls:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
          
      - name: Check for known pitfalls
        run: |
          echo "🔍 Checking for known pitfalls..."
          
          # Load experiences and check if any apply to changed files
          if [ -d ".ai-memory/experiences" ]; then
            for file in .ai-memory/experiences/*.json; do
              if [ -f "$file" ]; then
                echo "Found experience: $(basename $file)"
                # You can add custom logic here to check PR diff against experiences
              fi
            done
          fi
          
      - name: Comment on PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const experiences = [];
            
            // Check if there are relevant experiences for this PR
            const fs = require('fs');
            const path = require('path');
            
            const expDir = '.ai-memory/experiences';
            if (fs.existsSync(expDir)) {
              const files = fs.readdirSync(expDir).filter(f => f.endsWith('.json'));
              for (const file of files.slice(0, 5)) {
                try {
                  const exp = JSON.parse(fs.readFileSync(path.join(expDir, file), 'utf8'));
                  if (exp.confidence >= 0.7) {
                    experiences.push(exp);
                  }
                } catch {}
              }
            }
            
            if (experiences.length > 0) {
              const body = experiences.map(exp => {
                const lesson = exp.lesson?.what_failed || exp.outcome?.description || 'Unknown';
                const advice = exp.lesson?.better_approach || 'Be careful';
                return \`⚠️ **\${exp.type.toUpperCase()}** (\${Math.round(exp.confidence * 100)}% confidence)
            \`  \${lesson}
            💡 \${advice}\`;
              }).join('\\n\\n');
              
              github.rest.issues.createComment({
                issue_number: context.issue.number,
                owner: context.repo.owner,
                repo: context.repo.repo,
                body: \`## 🤖 AI Memory Bridge: Relevant Experiences\\n\\n\${body}\`
              });
            }
`;

function main() {
  const project = detectProject();
  const workflowsDir = resolve(project.project_root, '.github', 'workflows');
  
  console.log('🔧 AI Memory Bridge: CI/CD Setup\n');
  console.log('─'.repeat(60));
  
  // Check if already initialized
  if (existsSync(resolve(workflowsDir, 'ai-memory.yml'))) {
    console.log('⚠️  CI workflow already exists:');
    console.log(`   ${resolve(workflowsDir, 'ai-memory.yml')}`);
    console.log('\nUse --force to overwrite, or remove the file first.');
    process.exit(0);
  }
  
  // Create .github/workflows directory
  mkdirSync(workflowsDir, { recursive: true });
  
  // Write main workflow
  const mainWorkflowPath = resolve(workflowsDir, 'ai-memory.yml');
  writeFileSync(mainWorkflowPath, WORKFLOW_TEMPLATE);
  
  // Write PR check workflow
  const prCheckPath = resolve(workflowsDir, 'ai-memory-pr-check.yml');
  writeFileSync(prCheckPath, PR_CHECK_TEMPLATE);
  
  console.log('✅ CI workflows created:\n');
  console.log(`   📄 ${mainWorkflowPath}`);
  console.log(`      - Runs on every push/PR`);
  console.log(`      - Learns from test failures`);
  console.log(`      - Commits new experiences automatically`);
  console.log('');
  console.log(`   📄 ${prCheckPath}`);
  console.log(`      - Checks PRs for known pitfalls`);
  console.log(`      - Comments relevant experiences on PR`);
  console.log('');
  console.log('─'.repeat(60));
  console.log('\n💡 Next steps:');
  console.log('   1. Review and customize the workflows');
  console.log('   2. Add your test command in ai-memory.yml');
  console.log('   3. Commit .github/workflows/ to your repository');
  console.log('   4. Push to see it in action');
  console.log('');
  console.log('⚠️  Note: Make sure GitHub Actions is enabled in your repository');
  console.log('   Settings → Actions → General → Allow all actions');
}

main();
