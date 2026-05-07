#!/usr/bin/env node
/**
 * setup-openclaw.mjs — Configure AI Memory Bridge for OpenClaw
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';

const OPENCLAW_DIR = resolve(homedir(), '.openclaw');
const SKILLS_DIR = resolve(OPENCLAW_DIR, 'skills');
const AMB_DIR = resolve(homedir(), '.claude', 'skills', 'ai-memory-bridge');

console.log('🔧 Configuring AI Memory Bridge for OpenClaw\n');

// 1. Create OpenClaw skills directory
mkdirSync(SKILLS_DIR, { recursive: true });

// 2. Create skill manifest for OpenClaw
const manifest = {
  name: "ai-memory-bridge",
  version: "1.0.0",
  description: "AI Memory Bridge - Learn from mistakes and avoid pitfalls",
  hooks: {
    preToolUse: `node ${AMB_DIR.replace(/\\/g, '/')}hooks/pre-tool.mjs`,
    postToolUse: `node ${AMB_DIR.replace(/\\/g, '/')}hooks/post-tool.mjs`,
    sessionStart: `node ${AMB_DIR.replace(/\\/g, '/')}hooks/session-start.mjs`
  },
  commands: {
    "amb:init": `node ${AMB_DIR.replace(/\\/g, '/')}commands/init.mjs`,
    "amb:status": `node ${AMB_DIR.replace(/\\/g, '/')}commands/status.mjs`,
    "amb:search": `node ${AMB_DIR.replace(/\\/g, '/')}commands/search.mjs`,
    "amb:learn": `node ${AMB_DIR.replace(/\\/g, '/')}commands/learn.mjs`,
    "amb:forget": `node ${AMB_DIR.replace(/\\/g, '/')}commands/forget.mjs`,
    "amb:loop": `node ${AMB_DIR.replace(/\\/g, '/')}commands/loop.mjs`,
    "amb:promote": `node ${AMB_DIR.replace(/\\/g, '/')}commands/promote.mjs`,
    "amb:profile": `node ${AMB_DIR.replace(/\\/g, '/')}commands/profile.mjs`,
    "amb:dashboard": `node ${AMB_DIR.replace(/\\/g, '/')}commands/dashboard.mjs`,
    "amb:rules": `node ${AMB_DIR.replace(/\\/g, '/')}commands/rules.mjs`,
    "amb:ci-setup": `node ${AMB_DIR.replace(/\\/g, '/')}commands/ci-setup.mjs`
  }
};

const manifestPath = resolve(SKILLS_DIR, 'ai-memory-bridge.json');
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

console.log(`✅ Created OpenClaw skill manifest:`);
console.log(`   ${manifestPath}\n`);

// 3. Create wrapper scripts for easy use
const wrapperDir = resolve(OPENCLAW_DIR, 'bin');
mkdirSync(wrapperDir, { recursive: true });

const commands = [
  'amb-init', 'amb-status', 'amb-search', 'amb-learn', 
  'amb-forget', 'amb-loop', 'amb-promote', 'amb-profile',
  'amb-dashboard', 'amb-rules', 'amb-ci-setup'
];

for (const cmd of commands) {
  const scriptName = cmd.replace('amb-', '');
  const scriptPath = resolve(wrapperDir, `${cmd}.cmd`);
  const mjsPath = resolve(AMB_DIR, 'commands', `${scriptName}.mjs`).replace(/\\/g, '/');
  
  writeFileSync(scriptPath, `@echo off\nnode "${mjsPath}" %*\n`);
}

console.log(`✅ Created command wrappers in:`);
console.log(`   ${wrapperDir}\n`);

// 4. Check if PATH includes wrapper dir
console.log('📋 Setup Instructions:\n');
console.log('Option 1: Add to PATH (recommended)');
console.log(`   setx PATH "%PATH%;${wrapperDir}"`);
console.log('   Then restart your terminal\n');

console.log('Option 2: Use full path');
console.log(`   ${wrapperDir}\\amb-status.cmd`);
console.log(`   ${wrapperDir}\\amb-search.cmd npm\n`);

console.log('Option 3: Use with OpenClaw');
console.log('   openclaw agent --skill ai-memory-bridge');
console.log('   (if OpenClaw supports skill loading)\n');

console.log('─'.repeat(60));
console.log('\n💡 Quick Test:');
console.log(`   node "${AMB_DIR.replace(/\\/g, '/')}commands/status.mjs"`);
