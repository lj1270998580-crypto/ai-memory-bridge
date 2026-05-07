#!/usr/bin/env node
/**
 * profile.mjs — View and edit developer profile
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';

const PROFILE_PATH = resolve(homedir(), '.claude/ai-memory/global/profile.json');

function loadProfile() {
  if (existsSync(PROFILE_PATH)) {
    try {
      return JSON.parse(readFileSync(PROFILE_PATH, 'utf8'));
    } catch {
      return getDefaultProfile();
    }
  }
  return getDefaultProfile();
}

function getDefaultProfile() {
  return {
    version: '1.0',
    updated_at: new Date().toISOString(),
    coding_style: {
      naming_convention: 'camelCase',
      quote_style: 'single',
      semicolons: true,
      trailing_commas: 'es5'
    },
    preferences: {
      error_handling: 'try-catch with specific errors',
      async_style: 'async/await',
      testing: 'write tests for core logic',
      documentation: 'JSDoc for public APIs'
    },
    risk_tolerance: 'medium',
    learning_rate: 'normal'
  };
}

function saveProfile(profile) {
  const dir = resolve(PROFILE_PATH, '..');
  if (!existsSync(dir)) {
    const { mkdirSync } = require('fs');
    mkdirSync(dir, { recursive: true });
  }
  
  profile.updated_at = new Date().toISOString();
  writeFileSync(PROFILE_PATH, JSON.stringify(profile, null, 2));
}

function main() {
  const args = process.argv.slice(2);
  const profile = loadProfile();
  
  if (args.length === 0) {
    // Display profile
    console.log('👤 Developer Profile\n');
    console.log(`Last Updated: ${profile.updated_at}\n`);
    
    console.log('🎨 Coding Style:');
    for (const [key, value] of Object.entries(profile.coding_style)) {
      console.log(`  ${key}: ${value}`);
    }
    console.log('');
    
    console.log('⚙️  Preferences:');
    for (const [key, value] of Object.entries(profile.preferences)) {
      console.log(`  ${key}: ${value}`);
    }
    console.log('');
    
    console.log('🎚️  Settings:');
    console.log(`  Risk Tolerance: ${profile.risk_tolerance}`);
    console.log(`  Learning Rate: ${profile.learning_rate}`);
    console.log('');
    
    console.log('To edit: /amb:profile set \u003ckey\u003e \u003cvalue\u003e');
    console.log('Example: /amb:profile set risk_tolerance high');
    
  } else if (args[0] === 'set' && args.length >= 3) {
    // Set a value
    const key = args[1];
    const value = args.slice(2).join(' ');
    
    // Navigate nested keys (e.g., coding_style.naming_convention)
    const keys = key.split('.');
    let target = profile;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!target[keys[i]]) {
        target[keys[i]] = {};
      }
      target = target[keys[i]];
    }
    
    target[keys[keys.length - 1]] = value;
    saveProfile(profile);
    
    console.log(`✅ Updated: ${key} = ${value}`);
    
  } else if (args[0] === 'reset') {
    // Reset to defaults
    const defaultProfile = getDefaultProfile();
    saveProfile(defaultProfile);
    console.log('✅ Profile reset to defaults');
    
  } else {
    console.log('Usage:');
    console.log('  /amb:profile              — View profile');
    console.log('  /amb:profile set \u003ckey\u003e \u003cvalue\u003e  — Update setting');
    console.log('  /amb:profile reset        — Reset to defaults');
  }
}

main();
