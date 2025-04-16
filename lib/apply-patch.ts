/**
 * A self-contained pure TypeScript utility for applying human-readable
 * "pseudo-diff" patch files to a collection of text files.
 */

// --------------------------------------------------------------------------- //
//  Domain objects
// --------------------------------------------------------------------------- //
export enum ActionType {
  ADD = "add",
  DELETE = "delete",
  UPDATE = "update",
}

export interface FileChange {
  type: ActionType;
  oldContent?: string;
  newContent?: string;
  movePath?: string;
}

export interface Commit {
  changes: Record<string, FileChange>;
}

// --------------------------------------------------------------------------- //
//  Exceptions
// --------------------------------------------------------------------------- //
export class DiffError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiffError";
  }
}

// --------------------------------------------------------------------------- //
//  Helper interfaces used while parsing patches
// --------------------------------------------------------------------------- //
export interface Chunk {
  origIndex: number;
  delLines: string[];
  insLines: string[];
}

export interface PatchAction {
  type: ActionType;
  newFile?: string;
  chunks: Chunk[];
  movePath?: string;
}

export interface Patch {
  actions: Record<string, PatchAction>;
}

// --------------------------------------------------------------------------- //
//  Patch text parser
// --------------------------------------------------------------------------- //
export class Parser {
  private currentFiles: Record<string, string>;
  private lines: string[];
  private index: number;
  public patch: Patch;
  public fuzz: number;

  constructor(currentFiles: Record<string, string>, lines: string[], index = 0) {
    this.currentFiles = currentFiles;
    this.lines = lines;
    this.index = index;
    this.patch = { actions: {} };
    this.fuzz = 0;
  }

  // ------------- low-level helpers -------------------------------------- //
  private _curLine(): string {
    if (this.index >= this.lines.length) {
      throw new DiffError("Unexpected end of input while parsing patch");
    }
    return this.lines[this.index]!;
  }

  public static _norm(line: string): string {
    /**
     * Strip CR so comparisons work for both LF and CRLF input.
     */
    return line.replace(/\r$/, "");
  }

  // ------------- scanning convenience ----------------------------------- //
  public isDone(prefixes?: string[]): boolean {
    if (this.index >= this.lines.length) {
      return true;
    }
    if (
      prefixes &&
      prefixes.length > 0 &&
      prefixes.some((prefix) => Parser._norm(this._curLine()).startsWith(prefix))
    ) {
      return true;
    }
    return false;
  }

  public startsWith(prefix: string | string[]): boolean {
    const prefixArr = typeof prefix === "string" ? [prefix] : prefix;
    return prefixArr.some((p) => Parser._norm(this._curLine()).startsWith(p));
  }

  public readStr(prefix: string): string {
    /**
     * Consume the current line if it starts with *prefix* and return the text
     * **after** the prefix. Raises if prefix is empty.
     */
    if (prefix === "") {
      throw new Error("readStr() requires a non-empty prefix");
    }
    if (Parser._norm(this._curLine()).startsWith(prefix)) {
      const text = this._curLine().substring(prefix.length);
      this.index += 1;
      return text;
    }
    return "";
  }

  public readLine(): string {
    /**
     * Return the current raw line and advance.
     */
    const line = this._curLine();
    this.index += 1;
    return line;
  }

  // ------------- public entry point -------------------------------------- //
  public parse(): void {
    while (!this.isDone(["*** End Patch"])) {
      // ---------- UPDATE ---------- //
      const path = this.readStr("*** Update File: ");
      if (path) {
        if (path in this.patch.actions) {
          throw new DiffError(`Duplicate update for file: ${path}`);
        }
        const moveTo = this.readStr("*** Move to: ");
        if (!(path in this.currentFiles)) {
          throw new DiffError(`Update File Error - missing file: ${path}`);
        }
        const text = this.currentFiles[path]!;
        const action = this._parseUpdateFile(text);
        action.movePath = moveTo || undefined;
        this.patch.actions[path] = action;
        continue;
      }

      // ---------- DELETE ---------- //
      const deletePath = this.readStr("*** Delete File: ");
      if (deletePath) {
        if (deletePath in this.patch.actions) {
          throw new DiffError(`Duplicate delete for file: ${deletePath}`);
        }
        if (!(deletePath in this.currentFiles)) {
          throw new DiffError(`Delete File Error - missing file: ${deletePath}`);
        }
        this.patch.actions[deletePath] = {
          type: ActionType.DELETE,
          chunks: [],
        };
        continue;
      }

      // ---------- ADD ---------- //
      const addPath = this.readStr("*** Add File: ");
      if (addPath) {
        if (addPath in this.patch.actions) {
          throw new DiffError(`Duplicate add for file: ${addPath}`);
        }
        if (addPath in this.currentFiles) {
          throw new DiffError(`Add File Error - file already exists: ${addPath}`);
        }
        this.patch.actions[addPath] = this._parseAddFile();
        continue;
      }

      throw new DiffError(`Unknown line while parsing: ${this._curLine()}`);
    }

    if (!this.startsWith("*** End Patch")) {
      throw new DiffError("Missing *** End Patch sentinel");
    }
    this.index += 1; // consume sentinel
  }

  // ------------- section parsers ---------------------------------------- //
  private _parseUpdateFile(text: string): PatchAction {
    const action: PatchAction = { type: ActionType.UPDATE, chunks: [] };
    const lines = text.split("\n");
    let index = 0;

    while (
      !this.isDone([
        "*** End Patch",
        "*** Update File:",
        "*** Delete File:",
        "*** Add File:",
        "*** End of File",
      ])
    ) {
      const defStr = this.readStr("@@ ");
      let sectionStr = "";
      if (!defStr && Parser._norm(this._curLine()) === "@@") {
        sectionStr = this.readLine();
      }

      if (!(defStr || sectionStr || index === 0)) {
        throw new DiffError(`Invalid line in update section:\n${this._curLine()}`);
      }

      if (defStr.trim()) {
        let found = false;
        if (!lines.slice(0, index).includes(defStr)) {
          for (let i = index; i < lines.length; i++) {
            if (lines[i] === defStr) {
              index = i + 1;
              found = true;
              break;
            }
          }
        }
        if (!found && !lines.slice(0, index).map(s => s.trim()).includes(defStr.trim())) {
          for (let i = index; i < lines.length; i++) {
            if (lines[i]!.trim() === defStr.trim()) {
              index = i + 1;
              this.fuzz += 1;
              found = true;
              break;
            }
          }
        }
      }

      const [nextCtx, chunks, endIdx, eof] = peekNextSection(this.lines, this.index);
      const [newIndex, fuzz] = findContext(lines, nextCtx, index, eof);
      
      if (newIndex === -1) {
        const ctxTxt = nextCtx.join("\n");
        throw new DiffError(
          `Invalid ${eof ? 'EOF ' : ''}context at ${index}:\n${ctxTxt}`
        );
      }
      
      this.fuzz += fuzz;
      
      for (const ch of chunks) {
        ch.origIndex += newIndex;
        action.chunks.push(ch);
      }
      
      index = newIndex + nextCtx.length;
      this.index = endIdx;
    }
    
    return action;
  }

  private _parseAddFile(): PatchAction {
    const lines: string[] = [];
    
    while (
      !this.isDone([
        "*** End Patch",
        "*** Update File:",
        "*** Delete File:",
        "*** Add File:",
      ])
    ) {
      const s = this.readLine();
      if (!s.startsWith("+")) {
        throw new DiffError(`Invalid Add File line (missing '+'): ${s}`);
      }
      lines.push(s.substring(1)); // strip leading '+'
    }
    
    return {
      type: ActionType.ADD,
      newFile: lines.join("\n"),
      chunks: [],
    };
  }
}

// --------------------------------------------------------------------------- //
//  Helper functions
// --------------------------------------------------------------------------- //
function findContextCore(
  lines: string[],
  context: string[],
  start: number
): [number, number] {
  if (!context.length) {
    return [start, 0];
  }

  for (let i = start; i <= lines.length - context.length; i++) {
    if (arraysEqual(lines.slice(i, i + context.length), context)) {
      return [i, 0];
    }
  }
  
  for (let i = start; i <= lines.length - context.length; i++) {
    if (arraysEqual(
      lines.slice(i, i + context.length).map(s => s.replace(/\s+$/, "")),
      context.map(s => s.replace(/\s+$/, ""))
    )) {
      return [i, 1];
    }
  }
  
  for (let i = start; i <= lines.length - context.length; i++) {
    if (arraysEqual(
      lines.slice(i, i + context.length).map(s => s.trim()),
      context.map(s => s.trim())
    )) {
      return [i, 100];
    }
  }
  
  return [-1, 0];
}

function arraysEqual<T>(a: T[], b: T[]): boolean {
  return a.length === b.length && a.every((val, idx) => val === b[idx]);
}

export function findContext(
  lines: string[],
  context: string[],
  start: number,
  eof: boolean
): [number, number] {
  if (eof) {
    const [newIndex, fuzz] = findContextCore(
      lines,
      context,
      Math.max(0, lines.length - context.length)
    );
    
    if (newIndex !== -1) {
      return [newIndex, fuzz];
    }
    
    const [newIndex2, fuzz2] = findContextCore(lines, context, start);
    return [newIndex2, fuzz2 + 10_000];
  }
  
  return findContextCore(lines, context, start);
}

export function peekNextSection(
  lines: string[],
  index: number
): [string[], Chunk[], number, boolean] {
  const old: string[] = [];
  let delLines: string[] = [];
  let insLines: string[] = [];
  const chunks: Chunk[] = [];
  let mode = "keep";
  const origIndex = index;

  while (index < lines.length) {
    const s = lines[index];
    if (!s) {
      index += 1;
      continue;
    }
    
    if (s.startsWith(
      "@@" 
    ) || s.startsWith(
      "*** End Patch"
    ) || s.startsWith(
      "*** Update File:"
    ) || s.startsWith(
      "*** Delete File:"
    ) || s.startsWith(
      "*** Add File:"
    ) || s.startsWith(
      "*** End of File"
    )) {
      break;
    }
    
    if (s === "***") {
      break;
    }
    
    if (s.startsWith("***")) {
      throw new DiffError(`Invalid Line: ${s}`);
    }
    
    index += 1;

    const lastMode = mode;
    let line = s;
    
    if (s === "") {
      line = " ";
    }
    
    if (line[0] === "+") {
      mode = "add";
    } else if (line[0] === "-") {
      mode = "delete";
    } else if (line[0] === " ") {
      mode = "keep";
    } else {
      throw new DiffError(`Invalid Line: ${s}`);
    }
    
    line = line.substring(1);

    if (mode === "keep" && lastMode !== mode) {
      if (insLines.length || delLines.length) {
        chunks.push({
          origIndex: old.length - delLines.length,
          delLines: [...delLines],
          insLines: [...insLines],
        });
      }
      delLines = [];
      insLines = [];
    }

    if (mode === "delete") {
      delLines.push(line);
      old.push(line);
    } else if (mode === "add") {
      insLines.push(line);
    } else if (mode === "keep") {
      old.push(line);
    }
  }

  if (insLines.length || delLines.length) {
    chunks.push({
      origIndex: old.length - delLines.length,
      delLines: [...delLines],
      insLines: [...insLines],
    });
  }

  if (index < lines.length && lines[index] === "*** End of File") {
    index += 1;
    return [old, chunks, index, true];
  }

  if (index === origIndex) {
    throw new DiffError("Nothing in this section");
  }
  
  return [old, chunks, index, false];
}

// --------------------------------------------------------------------------- //
//  Patch → Commit and Commit application
// --------------------------------------------------------------------------- //
function getUpdatedFile(text: string, action: PatchAction, path: string): string {
  if (action.type !== ActionType.UPDATE) {
    throw new DiffError("getUpdatedFile called with non-update action");
  }
  
  const origLines = text.split("\n");
  const destLines: string[] = [];
  let origIndex = 0;

  for (const chunk of action.chunks) {
    if (chunk.origIndex > origLines.length) {
      throw new DiffError(
        `${path}: chunk.origIndex ${chunk.origIndex} exceeds file length`
      );
    }
    
    if (origIndex > chunk.origIndex) {
      throw new DiffError(
        `${path}: overlapping chunks at ${origIndex} > ${chunk.origIndex}`
      );
    }

    destLines.push(...origLines.slice(origIndex, chunk.origIndex));
    origIndex = chunk.origIndex;

    destLines.push(...chunk.insLines);
    origIndex += chunk.delLines.length;
  }

  destLines.push(...origLines.slice(origIndex));
  return destLines.join("\n");
}

export function patchToCommit(patch: Patch, orig: Record<string, string>): Commit {
  const commit: Commit = { changes: {} };
  
  for (const [path, action] of Object.entries(patch.actions)) {
    if (action.type === ActionType.DELETE) {
      commit.changes[path] = {
        type: ActionType.DELETE,
        oldContent: orig[path],
      };
    } else if (action.type === ActionType.ADD) {
      if (action.newFile === undefined) {
        throw new DiffError("ADD action without file content");
      }
      
      commit.changes[path] = {
        type: ActionType.ADD,
        newContent: action.newFile,
      };
    } else if (action.type === ActionType.UPDATE) {
      const newContent = getUpdatedFile(orig[path]!, action, path);
      
      commit.changes[path] = {
        type: ActionType.UPDATE,
        oldContent: orig[path],
        newContent,
        movePath: action.movePath,
      };
    }
  }
  
  return commit;
}

// --------------------------------------------------------------------------- //
//  User-facing helpers
// --------------------------------------------------------------------------- //
export function textToPatch(text: string, orig: Record<string, string>): [Patch, number] {
  const lines = text.split("\n");  // preserves blank lines, no strip()
  
  if (
    lines.length < 2 ||
    !Parser._norm(lines[0]!).startsWith("*** Begin Patch") ||
    Parser._norm(lines[lines.length - 1]!) !== "*** End Patch"
  ) {
    throw new DiffError("Invalid patch text - missing sentinels");
  }

  const parser = new Parser(orig, lines, 1);
  parser.parse();
  return [parser.patch, parser.fuzz];
}

export function identifyFilesNeeded(text: string): string[] {
  const lines = text.split("\n");
  const updateFiles = lines
    .filter(line => line.startsWith("*** Update File: "))
    .map(line => line.substring("*** Update File: ".length));
    
  const deleteFiles = lines
    .filter(line => line.startsWith("*** Delete File: "))
    .map(line => line.substring("*** Delete File: ".length));
    
  return [...updateFiles, ...deleteFiles];
}

export function identifyFilesAdded(text: string): string[] {
  const lines = text.split("\n");
  return lines
    .filter(line => line.startsWith("*** Add File: "))
    .map(line => line.substring("*** Add File: ".length));
}

// --------------------------------------------------------------------------- //
//  Apply commit (pure implementation)
// --------------------------------------------------------------------------- //
export function applyCommit(commit: Commit): Record<string, string> {
  const result: Record<string, string> = {};
  
  for (const [path, change] of Object.entries(commit.changes)) {
    if (change.type === ActionType.DELETE) {
      // Skip deleted files (don't add to result)
    } else if (change.type === ActionType.ADD) {
      if (change.newContent === undefined) {
        throw new DiffError(`ADD change for ${path} has no content`);
      }
      result[path] = change.newContent;
    } else if (change.type === ActionType.UPDATE) {
      if (change.newContent === undefined) {
        throw new DiffError(`UPDATE change for ${path} has no new content`);
      }
      const target = change.movePath || path;
      result[target] = change.newContent;
    }
  }
  
  return result;
}

export function processPatch(
  text: string,
  orig: Record<string, string>
): Record<string, string> {
  if (!text.startsWith("*** Begin Patch")) {
    throw new DiffError("Patch text must start with *** Begin Patch");
  }
  
  const [patch, _fuzz] = textToPatch(text, orig);
  const commit = patchToCommit(patch, orig);
  return applyCommit(commit);
} 