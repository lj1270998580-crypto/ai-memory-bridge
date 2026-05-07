#!/usr/bin/env node
import { spawnSync } from 'child_process';
import { resolve } from 'path';
import { existsSync, readdirSync } from 'fs';

const postHook = resolve(process.env.USERPROFILE, '.claude/skills/ai-memory-bridge/hooks/post-tool.mjs');

console.log('Testing post-tool hook directly...');
console.log('Hook path:', postHook);

const result = spawnSync('node', [postHook], {
  input: JSON.stringify({
    tool_name: "Bash",
    tool_input: { command: "npm install" },
    tool_output: { stderr: "npm ERR! ERESOLVE could not resolve", exit_code: 1 },
    session_id: "test"
  }),
  encoding: 'utf8',
  timeout: 5000,
  env: { ...process.env, AMB_DEBUG: '1' }
});

console.log('Exit code:', result.status);
console.log('Stderr:', result.stderr);
console.log('Stdout:', result.stdout);

const testDir = resolve('D:/.ai-memory/experiences');
console.log('\nExp dir:', testDir);
console.log('Exists:', existsSync(testDir));

if (existsSync(testDir)) {
  const files = readdirSync(testDir).filter(f => f.endsWith('.json'));
  console.log('Files:', files.length);
}
