#!/usr/bin/env bun
import { existsSync, readFileSync, writeFileSync, renameSync } from 'fs';
import { partialEdit } from '../../lib/partial-edit';

/**
 * CLI tool for partial editing of files using LLM
 * 
 * Usage: 
 *   bun partial-edit-cli.ts <file-path> "<edit-task-description>"
 * 
 * Example:
 *   bun partial-edit-cli.ts src/example.ts "Add error handling to the fetchData function"
 */

async function main() {
  // Check arguments
  if (process.argv.length < 4) {
    console.error('Usage: bun partial-edit-cli.ts <file-path> "<edit-task-description>"');
    process.exit(1);
  }

  const filePath = process.argv[2];
  const task = process.argv[3];

  // Validate file exists
  if (!filePath || !existsSync(filePath)) {
    console.error(`Error: File '${filePath}' does not exist.`);
    process.exit(1);
  }

  if (!task) {
    console.error('Error: Task description is required');
    process.exit(1);
  }

  try {
    // Read the original content
    const originalContent = readFileSync(filePath, 'utf-8');
    
    console.log(`📝 Editing file: ${filePath}`);
    console.log(`✨ Task: ${task}`);
    console.log('🔄 Generating changes...');
    
    // Generate patch and apply changes
    const { patch, finalContent } = await partialEdit(originalContent, task);
    
    // Backup original file
    const backupPath = `${filePath}.old`;
    console.log(`💾 Backing up original to: ${backupPath}`);
    renameSync(filePath, backupPath);
    
    // Write the new content to the original file
    console.log(`📄 Writing updated content to: ${filePath}`);
    writeFileSync(filePath, finalContent, 'utf-8');
    
    // Write the patch to a .patch file
    const patchPath = `${filePath}.patch`;
    console.log(`🔍 Writing patch to: ${patchPath}`);
    writeFileSync(patchPath, patch, 'utf-8');
    
    console.log('✅ Done!');
    
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
}); 