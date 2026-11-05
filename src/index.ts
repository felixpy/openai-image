#!/usr/bin/env node
// Minimal MCP server (stdio) wrapping OpenAI images.generate and images.edit.
import fs from 'node:fs';
import path from 'node:path';
import OpenAI, { toFile } from 'openai';
import type { ImageEditParamsNonStreaming, ImageGenerateParamsNonStreaming, ImagesResponse } from 'openai/resources/images';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2.6-flare';
// Reported on MCP initialize. Read from package.json so release-please version bumps stay in sync.
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };

// Lazy client: a missing key becomes a tool error, not a startup crash.
// The SDK reads OPENAI_API_KEY and OPENAI_BASE_URL from env itself; the key is never logged.
let client: OpenAI | undefined;
const openai = () => (client ??= new OpenAI({ maxRetries: 2, timeout: 180_000 }));

// Loose schemas on purpose: the API validates values, so new options need no code change.
const extra = z.record(z.string(), z.unknown()).optional()
  .describe('Extra API params shallow-merged into the request last, e.g. {"complexity":"high"}');
const outputDir = z.string().refine(path.isAbsolute, 'must be an absolute path')
  .describe('Absolute directory to save images in. Follow your workspace conventions: the current project folder if any, else your own tmp dir.');
const imageOptions = {
  output_dir: outputDir,
  model: z.string().optional().describe(`Image model (default ${IMAGE_MODEL}). e.g. gpt-image-2.6-flare (fast), gpt-image-2.6-sunburst (detail/precise edits), gpt-image-2.5-flare, gpt-image-2.5-sunburst`),
  size: z.string().optional().describe('auto, 1024x1024, 1536x1024, 1024x1536, or WIDTHxHEIGHT (both multiples of 16, aspect 1:3 to 3:1, max 3840x2160). For GIF this is the size of each frame; keep it small (e.g. 512x512) to fit the pixel budget'),
  quality: z.string().optional().describe('auto (default), low, medium, high, xhigh, max'),
  complexity: z.string().optional().describe('Planning effort, separate from quality: low, medium, high (2.6 default high)'),
  n: z.number().int().min(1).max(10).optional().describe('Number of images, 1-10'),
  background: z.string().optional().describe('auto (default), opaque, transparent (transparent needs png, webp or svg)'),
  output_format: z.string().optional().describe('png (default), jpeg, webp; generate also supports gif (animated) and svg'),
  output_compression: z.number().int().min(0).max(100).optional().describe('0-100, jpeg/webp only'),
  frame_count: z.number().int().min(2).optional().describe('GIF only: number of frames (default 9; SDK says 2-16, guide says 2-64). Describe the motion and a return to the starting pose in the prompt for a smooth loop'),
  frame_duration_ms: z.number().int().min(20).optional().describe('GIF only: ms per frame, 20-2000, rounded to 10 (default 200)'),
  moderation: z.string().optional().describe('auto (default), low'),
  safety_identifier: z.string().optional().describe('Optional stable hashed end-user id for OpenAI abuse monitoring'),
  extra,
};

// Defined fields first, then `extra` on top. Undefined values are dropped.
function merge<T>(defaults: object, { extra, ...fields }: Record<string, unknown>): T {
  const defined = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
  return { ...defaults, ...defined, ...(extra as object | undefined) } as T;
}

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');
const ok = (data: object) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] });

function toolError(e: unknown) {
  // APIError carries status/code/type/param; `error` holds the raw body (e.g. moderation_blocked details).
  const err = e instanceof OpenAI.APIError
    ? { status: e.status, code: e.code, type: e.type, param: e.param, message: e.message, request_id: e.requestID, error: e.error }
    : { message: e instanceof Error ? e.message : String(e) };
  return { isError: true, content: [{ type: 'text' as const, text: JSON.stringify(err, null, 2) }] };
}

const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
const upload = (p: string) =>
  toFile(fs.createReadStream(p), path.basename(p), { type: MIME[path.extname(p).slice(1).toLowerCase()] ?? 'application/octet-stream' });

// Write b64 images to disk; return only paths + metadata (no base64 into the agent's context).
function saveImages(res: ImagesResponse, dir: string, model: string, requestedFormat?: string | null) {
  const format = res.output_format ?? requestedFormat ?? 'png';
  fs.mkdirSync(dir, { recursive: true });
  const prefix = stamp();
  const files: string[] = [], urls: string[] = [], revised: string[] = [];
  (res.data ?? []).forEach((d, i) => {
    if (d.revised_prompt) revised.push(d.revised_prompt);
    if (d.url) urls.push(d.url);
    if (!d.b64_json) return;
    const file = path.join(dir, `image-${prefix}-${i}.${format}`);
    fs.writeFileSync(file, Buffer.from(d.b64_json, 'base64'));
    files.push(file);
  });
  return ok({
    model, files, ...(urls.length && { urls }), usage: res.usage ?? null,
    ...(revised.length && { revised_prompt: revised.length === 1 ? revised[0] : revised }),
    size: res.size, quality: res.quality, output_format: format,
  });
}

const server = new McpServer({ name: 'openai-image', version: pkg.version });

server.registerTool('openai_image_generate', {
  description: 'Generate images (OpenAI images.generate): still images, animated GIF (output_format=gif) or SVG. Saves files to output_dir and returns their paths.',
  inputSchema: {
    prompt: z.string().describe('Text prompt (max 32000 chars)'),
    ...imageOptions,
    svg: z.object({ model: z.string(), reasoning: z.record(z.string(), z.unknown()).optional() }).optional()
      .describe('SVG only (output_format=svg, n=1): author model and reasoning, e.g. {"model":"...","reasoning":{"effort":"high"}}. Needs SVG model-selection access; omit otherwise'),
  },
}, async ({ output_dir, ...args }) => {
  try {
    const params = { ...merge<object>({ model: IMAGE_MODEL }, args), stream: false } as ImageGenerateParamsNonStreaming;
    return saveImages(await openai().images.generate(params), output_dir, String(params.model), params.output_format);
  } catch (e) { return toolError(e); }
});

server.registerTool('openai_image_edit', {
  description: 'Edit images or compose from up to 16 reference images (OpenAI images.edit), optionally guided by a mask or markup overlay. Saves files to output_dir and returns their paths.',
  inputSchema: {
    prompt: z.string().describe('Edit instructions'),
    image_paths: z.array(z.string()).min(1).describe('Local paths of one or more input/reference images'),
    mask_path: z.string().optional().describe('Optional PNG mask, same size as the first image (transparent = area to edit). Cannot combine with markup_path'),
    markup_path: z.string().optional().describe('Optional transparent PNG overlay with marks/arrows/notes drawn on it, same size as the first image, to guide the edit. Cannot combine with mask_path'),
    input_fidelity: z.string().optional().describe('high or low; gpt-image-1.5 / 1-mini only, omit for gpt-image-2 and later'),
    ...imageOptions,
  },
}, async ({ output_dir, image_paths, mask_path, markup_path, ...rest }) => {
  try {
    const params = {
      ...merge<object>({ model: IMAGE_MODEL }, rest),
      image: await Promise.all(image_paths.map(upload)), // SDK type: Uploadable | Array<Uploadable>
      ...(mask_path && { mask: await upload(mask_path) }),
      ...(markup_path && { markup: await upload(markup_path) }),
      stream: false,
    } as ImageEditParamsNonStreaming;
    return saveImages(await openai().images.edit(params), output_dir, String(params.model), params.output_format);
  } catch (e) { return toolError(e); }
});

await server.connect(new StdioServerTransport());
