#!/usr/bin/env node
import { detectProject } from '../lib/detect-project.mjs';

console.log('CWD:', process.cwd());
const project = detectProject();
console.log('Project:', project);
