<div align="center">

<h1>openai-image</h1>

<p>在任意 MCP 客户端里用 OpenAI 生成和编辑图片。</p>

<p>
  <a href="https://www.npmjs.com/package/@felixpy/openai-image"><img alt="npm 版本" src="https://img.shields.io/npm/v/@felixpy/openai-image"></a>
  <a href="LICENSE"><img alt="MIT 许可证" src="https://img.shields.io/github/license/felixpy/openai-image"></a>
  <a href="https://github.com/felixpy/openai-image/actions/workflows/ci.yml"><img alt="CI 状态" src="https://img.shields.io/github/actions/workflow/status/felixpy/openai-image/ci.yml?branch=main&label=CI"></a>
  <a href="package.json"><img alt="Node.js 20 或更高版本" src="https://img.shields.io/badge/node-%3E%3D20-339933?logo=nodedotjs&logoColor=white"></a>
</p>

<img src="docs/assets/hero.gif" alt="动画 GIF：一只卡通猫坐在笔记本电脑前竖起大拇指，标题是 Works on my machine" width="512">

<p>
  <a href="README.md">English</a>
  &nbsp;·&nbsp;
  <a href="README_ZH.md">简体中文</a>
</p>

</div>

`openai-image` 是一个通过 stdio 通信的 [Model Context Protocol](https://modelcontextprotocol.io) 服务器。它调用 OpenAI 官方 Images API，把文件写到绝对路径 `output_dir`，并返回路径和元数据。工具结果里不会出现 base64。

```sh
npx -y @felixpy/openai-image
```

## 快速开始

### 1. API 密钥

服务器从环境变量读取 `OPENAI_API_KEY`。发起工具调用时必须提供，且不会写入日志。缺少密钥不会阻止进程启动。

```sh
export OPENAI_API_KEY=sk-...
```

| 变量 | 默认值 | 作用 |
|---|---|---|
| `OPENAI_API_KEY` | 工具调用时必填 | 由 OpenAI SDK 发送。不要提交到仓库。 |
| `OPENAI_IMAGE_MODEL` | `gpt-image-2.6-flare` | 调用未传 `model` 时使用的模型。 |
| `OPENAI_BASE_URL` | OpenAI 默认地址 | 可选。由 OpenAI SDK 读取。 |

### 2. 注册服务器

下面的配置都通过 stdio 启动已发布的包。请在本地把 `sk-...` 换成自己的密钥，不要把真实密钥提交到仓库。

#### Cursor

`~/.cursor/mcp.json` 或项目里的 `.cursor/mcp.json`：

```json
{
  "mcpServers": {
    "openai-image": {
      "command": "npx",
      "args": ["-y", "@felixpy/openai-image"],
      "env": {
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

#### Claude Desktop

macOS：`~/Library/Application Support/Claude/claude_desktop_config.json`  
Windows：`%APPDATA%\Claude\claude_desktop_config.json`  
Linux：`~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "openai-image": {
      "command": "npx",
      "args": ["-y", "@felixpy/openai-image"],
      "env": {
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

#### Claude Code

```sh
claude mcp add openai-image \
  -e OPENAI_API_KEY=sk-... \
  -- npx -y @felixpy/openai-image
```

#### Codex

`~/.codex/config.toml`：

```toml
[mcp_servers.openai-image]
command = "npx"
args = ["-y", "@felixpy/openai-image"]
env = { OPENAI_API_KEY = "sk-..." }
```

## 工具

| 工具 | API | 必填 | 还可以传 |
|---|---|---|---|
| `openai_image_generate` | `images.generate` | `prompt`、`output_dir` | 共用图片参数，以及 `svg` |
| `openai_image_edit` | `images.edit` | `prompt`、`image_paths`、`output_dir` | 共用图片参数，以及 `mask_path`、`markup_path`、`input_fidelity` |

`openai_image_generate` 生成静态图、动画 GIF（`output_format=gif`）或 SVG。`openai_image_edit` 编辑图片，或用最多 16 张参考图合成，可选遮罩或标注图层。两个工具都把文件保存到 `output_dir`，并返回路径。

<p align="center">
  <img src="docs/assets/edit.gif" alt="一盆仙人掌旋转的动画 GIF" width="240">
  <img src="docs/assets/meme.png" alt="静态 PNG：一只卡通猫坐在笔记本电脑前竖起大拇指，标题是 Works on my machine" width="240">
</p>
<p align="center"><sub>编辑得到的 GIF（2026-11-05 已验证）以及生成得到的静态 PNG。</sub></p>

成功时返回一段 JSON 文本。只有 API 实际返回时，结果里才会带上 URL 和 `revised_prompt`。

```json
{
  "model": "gpt-image-2.6-flare",
  "files": ["/absolute/path/image-2026-11-05T00-00-00-000Z-0.png"],
  "usage": null,
  "size": "1024x1024",
  "quality": "auto",
  "output_format": "png"
}
```

API 失败（包括 `moderation_blocked`）会作为工具错误返回，字段包括 `status`、`code`、`type`、`param`、`message`、`request_id` 和原始 `error`。客户端设置为 `maxRetries: 2`，超时 180 秒。

## 参数

模式故意用宽松的字符串，具体取值由 API 校验，这样新增选项通常不用改代码。尚未单独列出的字段可以放进 `extra`，它会最后浅合并进请求。

### 共用参数

| 参数 | 必填 | 范围与说明 |
|---|---|---|
| `output_dir` | 是 | 绝对路径目录。相对路径会被拒绝。目录不存在时会创建。 |
| `model` | 否 | 默认是 `OPENAI_IMAGE_MODEL`，否则为 `gpt-image-2.6-flare`。例如：`gpt-image-2.6-flare`（更快）、`gpt-image-2.6-sunburst`（细节和精确编辑）、`gpt-image-2.5-flare`、`gpt-image-2.5-sunburst`。 |
| `size` | 否 | `auto`、`1024x1024`、`1536x1024`、`1024x1536`，或 `宽x高`。两边都须是 16 的倍数，宽高比在 1:3 到 3:1 之间，最大 `3840x2160`。GIF 里这是每一帧的尺寸。帧要小一些，例如 `512x512`，才能落在像素预算内。 |
| `quality` | 否 | `auto`（默认）、`low`、`medium`、`high`、`xhigh`、`max`。 |
| `complexity` | 否 | 规划力度，和画质分开：`low`、`medium`、`high`。gpt-image-2.6 默认是 `high`。 |
| `n` | 否 | 整数，1 到 10。 |
| `background` | 否 | `auto`（默认）、`opaque`、`transparent`。透明背景需要 `png`、`webp` 或 `svg`。 |
| `output_format` | 否 | `png`（默认）、`jpeg`、`webp`。生成还支持 `gif`（动画）和 `svg`。 |
| `output_compression` | 否 | 整数，0 到 100。仅 `jpeg` 和 `webp`。 |
| `frame_count` | 否 | 仅 GIF。整数，最小 2，默认 9。SDK 文档是 2–16，图像指南是 2–64。提示词里写清动作，并回到起始姿势，循环会更顺。 |
| `frame_duration_ms` | 否 | 仅 GIF。整数，20 到 2000，会取整到 10 的倍数。默认 200。 |
| `moderation` | 否 | `auto`（默认）、`low`。 |
| `safety_identifier` | 否 | 可选。稳定的终端用户哈希 id，供 OpenAI 滥用监测使用。 |
| `extra` | 否 | 对象，最后浅合并进请求，例如 `{"complexity":"high"}`。 |

### `openai_image_generate`

| 参数 | 必填 | 范围与说明 |
|---|---|---|
| `prompt` | 是 | 文本提示词。最多 32000 个字符。 |
| `svg` | 否 | 仅 SVG，且 `output_format=svg`、`n=1`。对象形如 `{"model":"...","reasoning":{"effort":"high"}}`。需要 SVG 模型选择权限，否则不要传。 |

### `openai_image_edit`

| 参数 | 必填 | 范围与说明 |
|---|---|---|
| `prompt` | 是 | 编辑说明。 |
| `image_paths` | 是 | 本地路径。至少 1 个。API 最多接受 16 张参考图。 |
| `mask_path` | 否 | PNG 遮罩，尺寸与第一张图相同。透明像素是要编辑的区域。不能和 `markup_path` 一起用。 |
| `markup_path` | 否 | 带标记、箭头或注释的透明 PNG，尺寸与第一张图相同。不能和 `mask_path` 一起用。 |
| `input_fidelity` | 否 | `high` 或 `low`。仅 `gpt-image-1.5` 和 `1-mini`。gpt-image-2 及之后的模型不要传。 |

编辑同样接受共用参数，包括 `output_format`。编辑输出 GIF 已于 2026-11-05 验证。

## 说明

- **GIF。** 生成或编辑时把 `output_format` 设为 `gif`。用 `frame_count` 和 `frame_duration_ms` 控制循环。编辑输出 GIF 已于 2026-11-05 验证。
- **`output_dir` 必须是绝对路径。** 相对路径会在调用 API 之前被拒绝。
- **工具结果不含 base64。** 图片字节写到磁盘。工具返回文件路径、模型、`usage`，以及 API 提供时的 `revised_prompt`。
- **透传。** `extra` 最后浅合并，因此新的 API 字段不必等发版就能使用。

## 开发

需要 Node.js 20 或更高版本。

```sh
npm ci
npm test
npm run build
npm start
```

`npm test` 会构建 `dist/`，并完成一次 MCP `initialize` 和 `tools/list` 握手。它不会调用 OpenAI API，也不需要 `OPENAI_API_KEY`。

提交规范和 Pull Request 见 [CONTRIBUTING.md](CONTRIBUTING.md)。npm 的一次性配置见 [docs/publishing.md](docs/publishing.md)。

## 项目

- [贡献指南](CONTRIBUTING.md)
- [安全策略](SECURITY.md)
- [许可证](LICENSE)（MIT）
- [变更记录](CHANGELOG.md)
- [行为准则](CODE_OF_CONDUCT.md)
- [发布说明](docs/publishing.md)
