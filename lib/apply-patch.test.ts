import { describe, test, expect } from "bun:test";
import {
  ActionType,
  DiffError,
  textToPatch,
  patchToCommit,
  applyCommit,
  processPatch,
  identifyFilesNeeded,
  identifyFilesAdded,
} from "./apply-patch";

describe("apply-patch", () => {
  describe("identifyFilesNeeded", () => {
    test("identifies files needed for update and delete", () => {
      const patchText = `*** Begin Patch
*** Update File: src/file1.ts
@@ some context
 line1
-line2
+line2 modified
 line3
*** Delete File: src/file2.ts
*** End Patch`;

      const result = identifyFilesNeeded(patchText);
      expect(result).toEqual(["src/file1.ts", "src/file2.ts"]);
    });
  });

  describe("identifyFilesAdded", () => {
    test("identifies files to be added", () => {
      const patchText = `*** Begin Patch
*** Add File: src/newfile.ts
+import { something } from "./something";
+
+export function newFunction() {
+  return "new";
+}
*** End Patch`;

      const result = identifyFilesAdded(patchText);
      expect(result).toEqual(["src/newfile.ts"]);
    });
  });

  describe("processPatch", () => {
    test("processes a patch that adds a file", () => {
      const patchText = `*** Begin Patch
*** Add File: src/newfile.ts
+import { something } from "./something";
+
+export function newFunction() {
+  return "new";
+}
*** End Patch`;

      const orig: Record<string, string> = {};
      const result = processPatch(patchText, orig);
      
      expect(result["src/newfile.ts"]).toBe(`import { something } from "./something";

export function newFunction() {
  return "new";
}`);
    });

    test("processes a patch that updates a file", () => {
      const patchText = `*** Begin Patch
*** Update File: src/file.ts
@@ function oldFunction
 export function oldFunction() {
-  return "old";
+  return "updated";
 }
*** End Patch`;

      const orig: Record<string, string> = {
        "src/file.ts": `import { something } from "./something";

export function oldFunction() {
  return "old";
}`,
      };
      
      const result = processPatch(patchText, orig);
      
      expect(result["src/file.ts"]).toBe(`import { something } from "./something";

export function oldFunction() {
  return "updated";
}`);
    });

    test("processes a patch that deletes a file", () => {
      const patchText = `*** Begin Patch
*** Delete File: src/file.ts
*** End Patch`;

      const orig: Record<string, string> = {
        "src/file.ts": `import { something } from "./something";

export function oldFunction() {
  return "old";
}`,
      };
      
      const result = processPatch(patchText, orig);
      
      expect(result["src/file.ts"]).toBeUndefined();
    });

    test("processes a patch that renames (moves) a file", () => {
      const patchText = `*** Begin Patch
*** Update File: src/oldname.ts
*** Move to: src/newname.ts
 export function something() {
   return "something";
 }
*** End Patch`;

      const orig: Record<string, string> = {
        "src/oldname.ts": `export function something() {
  return "something";
}`,
      };
      
      const result = processPatch(patchText, orig);
      
      expect(result["src/oldname.ts"]).toBeUndefined();
      expect(result["src/newname.ts"]).toBe(`export function something() {
  return "something";
}`);
    });

    test("throws error for invalid patch", () => {
      const patchText = `*** Begin Patch
*** Update File: src/file.ts
 invalid context
*** End Patch`;

      const orig: Record<string, string> = {
        "src/file.ts": `export function something() {
  return "something";
}`,
      };
      
      expect(() => processPatch(patchText, orig)).toThrow(DiffError);
    });

    test("processes a complex patch with multiple changes", () => {
      const patchText = `*** Begin Patch
*** Update File: src/file1.ts
@@ export function
 export function func1() {
-  return "old1";
+  return "new1";
 }
*** Add File: src/file3.ts
+export function func3() {
+  return "new3";
+}
*** Delete File: src/file2.ts
*** End Patch`;

      const orig: Record<string, string> = {
        "src/file1.ts": `export function func1() {
  return "old1";
}`,
        "src/file2.ts": `export function func2() {
  return "old2";
}`,
      };
      
      const result = processPatch(patchText, orig);
      
      expect(result["src/file1.ts"]).toBe(`export function func1() {
  return "new1";
}`);
      expect(result["src/file2.ts"]).toBeUndefined();
      expect(result["src/file3.ts"]).toBe(`export function func3() {
  return "new3";
}`);
    });

    test("processes a patch with long content", () => {
      // Create a long source file with many lines
      const longContent = Array.from({ length: 1000 }, (_, i) => 
        `// Line ${i + 1}: ${Array(50).fill(`content-${i + 1}`).join(' ')}`
      ).join('\n');
      
      // Target line is somewhere in the middle (line 500)
      const targetLine = 500;
      const targetLineContent = `// Line ${targetLine}: ${Array(50).fill(`content-${targetLine}`).join(' ')}`;
      
      // Create a patch that modifies this specific line
      const patchText = `*** Begin Patch
*** Update File: src/longfile.ts
@@ Line ${targetLine}:
 ${targetLineContent}
-// Line ${targetLine + 1}: ${Array(50).fill(`content-${targetLine + 1}`).join(' ')}
+// MODIFIED LINE ${targetLine + 1}: This line was changed
 // Line ${targetLine + 2}: ${Array(50).fill(`content-${targetLine + 2}`).join(' ')}
*** End Patch`;
      
      const orig: Record<string, string> = {
        "src/longfile.ts": longContent
      };
      
      const result = processPatch(patchText, orig);
      
      // Split result into lines to check the specific change
      const resultLines = result["src/longfile.ts"]!.split('\n');
      expect(resultLines[targetLine - 1]).toBe(targetLineContent);
      expect(resultLines[targetLine]).toBe("// MODIFIED LINE 501: This line was changed");
      expect(resultLines[targetLine + 1]).toBe(`// Line ${targetLine + 2}: ${Array(50).fill(`content-${targetLine + 2}`).join(' ')}`);
    });

    test("processes a patch with long content and fuzzy matching", () => {
      // Create a long source file with repetitive patterns
      const createRepetitiveContent = () => {
        const sections = [];
        for (let i = 0; i < 50; i++) {
          sections.push(`
// Section ${i + 1}
function section${i + 1}() {
  console.log("This is section ${i + 1}");
  return {
    id: ${i + 1},
    name: "Section ${i + 1}",
    description: "Description for section ${i + 1}",
    properties: {
      created: Date.now(),
      updated: Date.now(),
      tags: ["tag1", "tag2", "tag3"]
    }
  };
}
`);
        }
        return sections.join('\n');
      };
      
      const longContent = createRepetitiveContent();
      
      // Create a patch that modifies a specific section but with slightly different whitespace
      // Note: Each context line needs to start with a space
      const patchText = `*** Begin Patch
*** Update File: src/repetitive.ts
@@ Section 25
 // Section 25
 function section25() {
   console.log("This is section 25");
   return {
     id: 25,
-    name: "Section 25",
-    description: "Description for section 25",
+    name: "MODIFIED Section 25",
+    description: "MODIFIED Description for section 25",
     properties: {
       created: Date.now(),
       updated: Date.now(),
*** End Patch`;
      
      const orig: Record<string, string> = {
        "src/repetitive.ts": longContent
      };
      
      const result = processPatch(patchText, orig);
      
      // Verify the specific section was modified
      expect(result["src/repetitive.ts"]!).toContain('name: "MODIFIED Section 25"');
      expect(result["src/repetitive.ts"]!).toContain('description: "MODIFIED Description for section 25"');
      
      // Make sure other sections remain unchanged
      expect(result["src/repetitive.ts"]!).toContain('name: "Section 24"');
      expect(result["src/repetitive.ts"]!).toContain('name: "Section 26"');
    });
  });

  describe("patchToCommit and applyCommit", () => {
    test("converts patch to commit and applies it", () => {
      const patchText = `*** Begin Patch
*** Update File: src/file1.ts
@@ export function
 export function func1() {
-  return "old1";
+  return "new1";
 }
*** End Patch`;

      const orig: Record<string, string> = {
        "src/file1.ts": `export function func1() {
  return "old1";
}`,
      };
      
      const [patch, _] = textToPatch(patchText, orig);
      const commit = patchToCommit(patch, orig);
      const result = applyCommit(commit);
      
      expect(commit.changes["src/file1.ts"]!.type).toBe(ActionType.UPDATE);
      expect(commit.changes["src/file1.ts"]!.oldContent).toBe(`export function func1() {
  return "old1";
}`);
      expect(commit.changes["src/file1.ts"]!.newContent).toBe(`export function func1() {
  return "new1";
}`);
      
      expect(result["src/file1.ts"]).toBe(`export function func1() {
  return "new1";
}`);
    });
  });
}); 