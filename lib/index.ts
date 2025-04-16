/**
 * DeePaste - A pure TypeScript utility for applying human-readable pseudo-diff patch files
 */

export {
  ActionType,
  type FileChange,
  type Commit,
  type Chunk,
  type PatchAction,
  type Patch,
  DiffError,
  textToPatch,
  patchToCommit,
  applyCommit,
  processPatch,
  identifyFilesNeeded,
  identifyFilesAdded,
} from './apply-patch';

/**
 * Partial editing features powered by LLM
 */
export {
  partialEditTool,
  partialEdit
} from './partial-edit';