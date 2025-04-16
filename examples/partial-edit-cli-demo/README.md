# Partial Edit CLI

A powerful command line tool that uses GPT-4.1 language model to make partial edits to files.

## Installation

## Usage

```bash
bun partial-edit <file_path> "<edit description>"
```

Or run directly with bun:

```bash
bun examples/partial-edit-cli/index.ts <file_path> "<edit description>"
```

## Examples

### Example 1: Modify HTML Structure

```bash
bun partial-edit-cli.ts playground/complex-webpage.html "Highlight the Data Table Example."
```

### Example 2: Improve Documentation

```bash
bun partial-edit-cli.ts playground/smolagent-readme.md "Seriously, take out the emojis."
```

## How It Works

The tool reads the file, sends it to GPT-4.1 with your instructions, applies the changes, and creates backup files.

## Notes

- Requires OpenAI API key
- Works best with small to medium-sized files 