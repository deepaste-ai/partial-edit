# DeePaste

A pure TypeScript utility for applying human-readable pseudo-diff patch files with partial editing capabilities powered by LLM.

## Features

- **Patch Processing**: Apply human-readable pseudo-diff patches to text files
- **Partial Editing**: Make context-aware edits to code using LLM
- **No Dependencies**: Pure TypeScript implementation
- **Developer-Friendly**: Simple API for integration

## Installation

```bash
npm install @deepaste/partial-edit
# or
bun add @deepaste/partial-edit
```

### CLI Usage

You can use the partial-edit CLI directly with bunx:

```bash
# Run directly with bunx
export OPENAI_API_KEY=sk-proj-xxx
bunx @deepaste/partial-edit path/to/file.ts "Add error handling to this function"

# Or install globally
bun install -g @deepaste/partial-edit
export OPENAI_API_KEY=sk-proj-xxx
partial-edit path/to/file.ts "Add error handling to this function"
```

The CLI will:
1. Create a backup of your original file (with `.old` extension)
2. Apply the requested changes
3. Save the generated patch for reference (with `.patch` extension)

## Usage

### Apply Patches

```typescript
import { processPatch } from '@deepaste/partial-edit';

// Original files
const files = {
  'example.ts': 'console.log("Hello World");'
};

// Patch in human-readable format
const patchText = `
*** Begin Patch
*** Update File: example.ts
 console.log("Hello World");
-console.log("Hello World");
+console.log("Hello, DeePaste!");
*** End Patch
`;

// Apply the patch
const result = processPatch(patchText, files);
console.log(result['example.ts']); // 'console.log("Hello, DeePaste!");'
```

### Partial Edit with LLM

```typescript
import { partialEdit } from '@deepaste/partial-edit';

const originalCode = `
function sum(a: number, b: number): number {
  return a + b;
}
`;

async function example() {
  const result = await partialEdit(
    originalCode,
    "Modify the function to accept an array of numbers instead of two parameters"
  );
  
  console.log(result.patch); // The generated patch
  console.log(result.finalContent); // The edited code
}
```

## Related Concepts

DeePaste's approach to applying patches is similar to techniques discussed in OpenAI's GPT-4.1 prompting guide. The guide mentions that providing both exact code to be replaced and replacement code with clear delimiters produces high success rates in code modification tasks. Formats like pseudo-diffs that don't rely on line numbers are especially effective for LLM-powered code editing.

For more details, see the [GPT-4.1 Prompting Guide on Generating and Applying File Diffs](https://cookbook.openai.com/examples/gpt4-1_prompting_guide#appendix-generating-and-applying-file-diffs).

## API Reference

### Core Functions

- `processPatch(patchText: string, files: Record<string, string>): Record<string, string>`
- `partialEdit(originalContent: string, task: string): Promise<{ patch: string; finalContent: string }>`
- `textToPatch(text: string, orig: Record<string, string>): [Patch, number]`
- `patchToCommit(patch: Patch, orig: Record<string, string>): Commit`
- `applyCommit(commit: Commit): Record<string, string>`

### Utilities

- `identifyFilesNeeded(text: string): string[]`
- `identifyFilesAdded(text: string): string[]`

## Patch Format

DeePaste uses a human-readable patch format:

```
*** Begin Patch
*** Update File: path/to/file.ext
@@ context_identifier (optional)
 [context line]
-[line to remove]
+[line to add]
 [context line]
*** End Patch
```

## License

MIT

# DeePaste

一个纯 TypeScript 工具，用于应用人类可读的伪差异补丁文件，具有由 LLM 驱动的部分编辑功能。

## 功能特性

- **补丁处理**：将人类可读的伪差异补丁应用到文本文件
- **部分编辑**：使用 LLM 进行上下文感知的代码编辑
- **无依赖**：纯 TypeScript 实现
- **开发者友好**：简单的集成 API

## 安装

```bash
npm install @deepaste/partial-edit
# 或
bun add @deepaste/partial-edit
```

### CLI 使用方法

你可以直接使用 bunx 运行 partial-edit CLI：

```bash
# 直接使用 bunx 运行
bunx @deepaste/partial-edit 文件路径.ts "为这个函数添加错误处理"

# 或者全局安装
bun install -g @deepaste/partial-edit
partial-edit 文件路径.ts "为这个函数添加错误处理"
```

CLI 工具会：
1. 创建原始文件的备份（带 `.old` 扩展名）
2. 应用请求的更改
3. 保存生成的补丁以供参考（带 `.patch` 扩展名）

## 使用方法

### 应用补丁

```typescript
import { processPatch } from '@deepaste/partial-edit';

// 原始文件
const files = {
  'example.ts': 'console.log("Hello World");'
};

// 人类可读格式的补丁
const patchText = `
*** Begin Patch
*** Update File: example.ts
 console.log("Hello World");
-console.log("Hello World");
+console.log("Hello, DeePaste!");
*** End Patch
`;

// 应用补丁
const result = processPatch(patchText, files);
console.log(result['example.ts']); // 'console.log("Hello, DeePaste!");'
```

### 使用 LLM 的部分编辑

```typescript
import { partialEdit } from '@deepaste/partial-edit';

const originalCode = `
function sum(a: number, b: number): number {
  return a + b;
}
`;

async function example() {
  const result = await partialEdit(
    originalCode,
    "修改函数，使其接受一个数字数组而不是两个参数"
  );
  
  console.log(result.patch); // 生成的补丁
  console.log(result.finalContent); // 编辑后的代码
}
```

## 相关概念

DeePaste 应用补丁的方式与 OpenAI 的 GPT-4.1 提示指南中讨论的技术类似。该指南提到，在代码修改任务中，同时提供需要替换的确切代码和带有明确分隔符的替换代码可以产生高成功率。像伪差异这样不依赖行号的格式对于 LLM 驱动的代码编辑特别有效。

更多详情，请查看 [GPT-4.1 生成和应用文件差异的提示指南](https://cookbook.openai.com/examples/gpt4-1_prompting_guide#appendix-generating-and-applying-file-diffs)。

## API 参考

### 核心函数

- `processPatch(patchText: string, files: Record<string, string>): Record<string, string>`
- `partialEdit(originalContent: string, task: string): Promise<{ patch: string; finalContent: string }>`
- `textToPatch(text: string, orig: Record<string, string>): [Patch, number]`
- `patchToCommit(patch: Patch, orig: Record<string, string>): Commit`
- `applyCommit(commit: Commit): Record<string, string>`

### 工具函数

- `identifyFilesNeeded(text: string): string[]`
- `identifyFilesAdded(text: string): string[]`

## 补丁格式

DeePaste 使用人类可读的补丁格式：

```
*** Begin Patch
*** Update File: path/to/file.ext
@@ context_identifier (可选)
 [上下文行]
-[要删除的行]
+[要添加的行]
 [上下文行]
*** End Patch
```

## 许可证

MIT
