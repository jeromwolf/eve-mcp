#!/usr/bin/env node

// Test MCP server response
const input = '{"jsonrpc":"2.0","method":"tools/list","id":1}';

import { spawn } from 'child_process';

const proc = spawn('node', ['build/index.js'], {
  env: { ...process.env, OPENAI_API_KEY: 'test' }
});

let output = '';
let errorOutput = '';

proc.stdout.on('data', (data) => {
  output += data.toString();
});

proc.stderr.on('data', (data) => {
  errorOutput += data.toString();
});

proc.on('close', (code) => {
  console.log('=== STDOUT ===');
  console.log(output);
  console.log('\n=== STDERR ===');
  console.log(errorOutput);
  console.log('\n=== JSON PARSE TEST ===');
  try {
    const json = JSON.parse(output);
    console.log('✅ JSON is valid');
    console.log('Tools count:', json.result.tools.length);
  } catch (e) {
    console.log('❌ JSON parse error:', e.message);
    console.log('First 100 chars:', output.substring(0, 100));
  }
});

proc.stdin.write(input);
proc.stdin.end();