import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverPath = path.join(root, 'dist', 'index.js');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));

test('dist entry keeps the node shebang', () => {
  const source = readFileSync(serverPath, 'utf8');
  assert.ok(source.startsWith('#!/usr/bin/env node\n') || source.startsWith('#!/usr/bin/env node\r\n'), 'bin entry needs a shebang');
});

test('MCP initialize and tools/list expose generate and edit', { timeout: 20_000 }, async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    stderr: 'pipe',
  });
  let stderr = '';
  transport.stderr?.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  const client = new Client({ name: 'openai-image-smoke', version: '0.0.0' });
  try {
    await client.connect(transport);
    const info = client.getServerVersion();
    assert.equal(info?.name, 'openai-image');
    assert.equal(info?.version, pkg.version);

    const { tools } = await client.listTools();
    const names = tools.map((tool) => tool.name).sort();
    assert.deepEqual(names, ['openai_image_edit', 'openai_image_generate']);

    for (const tool of tools) {
      const dumped = JSON.stringify(tool);
      assert.match(dumped, /output_dir/, `${tool.name} schema should mention output_dir`);
      assert.match(dumped, /gif/, `${tool.name} schema should mention gif`);
      assert.ok(tool.inputSchema.required?.includes('output_dir'), `${tool.name} should require output_dir`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`${message}\n--- server stderr ---\n${stderr}`);
  } finally {
    await client.close();
  }
});
