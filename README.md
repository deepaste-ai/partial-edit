# Partial Edit

A pure TypeScript utility for applying human-readable pseudo-diff patch files with partial editing capabilities powered by LLM.

## Motivation

When dealing with very long documents or code files, language models typically need to output the entire content to make changes, which is wasteful and slow for small modifications. Partial Edit solves this problem by enabling targeted, partial edits through a patch-based approach, making the editing process much more efficient for minor changes to large files.

This project is a TypeScript implementation of the approach described in OpenAI's GPT-4.1 prompting guide, which demonstrates that providing both exact code to be replaced and replacement code with clear delimiters produces high success rates in code modification tasks. Partial Edit encapsulates this technique into an easy-to-use API, focusing on pseudo-diff formats that don't rely on line numbers, which are especially effective for LLM-powered code editing.

For more details, see the [GPT-4.1 Prompting Guide on Generating and Applying File Diffs](https://cookbook.openai.com/examples/gpt4-1_prompting_guide#appendix-generating-and-applying-file-diffs).

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
# Set your OpenAI API key
export OPENAI_API_KEY=sk-proj-xxx

# Run directly with bunx
bunx @deepaste/partial-edit path/to/file.ts "Add error handling to this function"

# Or install globally
bun install -g @deepaste/partial-edit
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
+console.log("Hello, Partial Edit!");
*** End Patch
`;

// Apply the patch
const result = processPatch(patchText, files);
console.log(result['example.ts']); // 'console.log("Hello, Partial Edit!");'
```

### Partial Edit with LLM

```typescript
import { partialEdit } from '@deepaste/partial-edit';

// Set your OpenAI API key in your environment
// process.env.OPENAI_API_KEY = 'your-api-key';

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

## Development

### Publishing

To publish only the compiled code:

```bash
# Build and prepare the package
bun run prepublishOnly

# Publish to npm
bun publish
```

The published package will only include:
- The compiled code in the `dist` directory
- The CLI executable in the `bin` directory

## Patch Format

Partial Edit uses a human-readable patch format:

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
