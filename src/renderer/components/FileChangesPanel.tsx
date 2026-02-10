import React, { useState } from 'react';
import {
  Plus,
  Minus,
  Undo2,
  ChevronDown,
  ChevronRight,
  FileText,
  FilePlus,
  FileX,
  FileDiff,
  FileQuestion,
  AlertTriangle,
  GitBranch,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import type { FileChange, FileChangeStatus, GitStatus } from '../../shared/types';

interface FileChangesPanelProps {
  gitStatus: GitStatus | null;
  loading: boolean;
  onStageFile: (filePath: string) => void;
  onUnstageFile: (filePath: string) => void;
  onStageAll: () => void;
  onUnstageAll: () => void;
  onDiscardFile: (filePath: string) => void;
  onViewDiff: (filePath: string, staged: boolean) => void;
}

const STATUS_COLORS: Record<FileChangeStatus, string> = {
  modified: 'text-[hsl(var(--git-modified))]',
  added: 'text-[hsl(var(--git-added))]',
  deleted: 'text-[hsl(var(--git-deleted))]',
  renamed: 'text-[hsl(var(--git-renamed))]',
  untracked: 'text-[hsl(var(--git-untracked))]',
  conflicted: 'text-[hsl(var(--git-conflicted))]',
};

const STATUS_BADGE_COLORS: Record<FileChangeStatus, string> = {
  modified: 'bg-[hsl(var(--git-modified)/0.12)] text-[hsl(var(--git-modified))]',
  added: 'bg-[hsl(var(--git-added)/0.12)] text-[hsl(var(--git-added))]',
  deleted: 'bg-[hsl(var(--git-deleted)/0.12)] text-[hsl(var(--git-deleted))]',
  renamed: 'bg-[hsl(var(--git-renamed)/0.12)] text-[hsl(var(--git-renamed))]',
  untracked: 'bg-[hsl(var(--git-untracked)/0.12)] text-[hsl(var(--git-untracked))]',
  conflicted: 'bg-[hsl(var(--git-conflicted)/0.12)] text-[hsl(var(--git-conflicted))]',
};

const STATUS_LABELS: Record<FileChangeStatus, string> = {
  modified: 'M',
  added: 'A',
  deleted: 'D',
  renamed: 'R',
  untracked: 'U',
  conflicted: '!',
};

function StatusIcon({ status }: { status: FileChangeStatus }) {
  const className = `w-3.5 h-3.5 ${STATUS_COLORS[status]}`;
  switch (status) {
    case 'modified':
      return <FileDiff className={className} strokeWidth={1.8} />;
    case 'added':
      return <FilePlus className={className} strokeWidth={1.8} />;
    case 'deleted':
      return <FileX className={className} strokeWidth={1.8} />;
    case 'untracked':
      return <FileQuestion className={className} strokeWidth={1.8} />;
    case 'conflicted':
      return <AlertTriangle className={className} strokeWidth={1.8} />;
    default:
      return <FileText className={className} strokeWidth={1.8} />;
  }
}

function FileItem({
  file,
  onStage,
  onUnstage,
  onDiscard,
  onViewDiff,
}: {
  file: FileChange;
  onStage: () => void;
  onUnstage: () => void;
  onDiscard: () => void;
  onViewDiff: () => void;
}) {
  const fileName = file.path.split('/').pop() || file.path;
  const dirPath = file.path.includes('/') ? file.path.substring(0, file.path.lastIndexOf('/')) : '';

  return (
    <div
      className="group flex items-center gap-2 px-2 py-[5px] rounded-md text-[12px] cursor-pointer hover:bg-accent/50 transition-all duration-150"
      onClick={onViewDiff}
    >
      <StatusIcon status={file.status} />

      <span className="truncate flex-1 min-w-0" title={file.path}>
        <span className="text-foreground/90">{fileName}</span>
        {dirPath && (
          <span className="text-muted-foreground/40 ml-1">{dirPath}/</span>
        )}
      </span>

      {/* Stat badge */}
      {(file.additions > 0 || file.deletions > 0) && (
        <span className="flex gap-1 text-[10px] font-mono flex-shrink-0 tabular-nums">
          {file.additions > 0 && (
            <span className="text-[hsl(var(--git-added))]">+{file.additions}</span>
          )}
          {file.deletions > 0 && (
            <span className="text-[hsl(var(--git-deleted))]">-{file.deletions}</span>
          )}
        </span>
      )}

      {/* Status badge */}
      <span className={`w-[18px] h-[16px] rounded flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${STATUS_BADGE_COLORS[file.status]}`}>
        {STATUS_LABELS[file.status]}
      </span>

      {/* Hover actions */}
      <div className="opacity-0 group-hover:opacity-100 flex gap-px flex-shrink-0 transition-all duration-150">
        {file.staged ? (
          <button
            onClick={(e) => { e.stopPropagation(); onUnstage(); }}
            className="p-[3px] rounded hover:bg-accent text-muted-foreground/50 hover:text-foreground"
            title="Unstage"
          >
            <Minus size={11} strokeWidth={2} />
          </button>
        ) : (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); onStage(); }}
              className="p-[3px] rounded hover:bg-accent text-muted-foreground/50 hover:text-foreground"
              title="Stage"
            >
              <Plus size={11} strokeWidth={2} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDiscard(); }}
              className="p-[3px] rounded hover:bg-destructive/15 text-muted-foreground/50 hover:text-destructive"
              title="Discard changes"
            >
              <Undo2 size={11} strokeWidth={2} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function FileChangesPanel({
  gitStatus,
  loading,
  onStageFile,
  onUnstageFile,
  onStageAll,
  onUnstageAll,
  onDiscardFile,
  onViewDiff,
}: FileChangesPanelProps) {
  const [stagedExpanded, setStagedExpanded] = useState(true);
  const [unstagedExpanded, setUnstagedExpanded] = useState(true);

  if (!gitStatus) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: 'hsl(var(--surface-1))' }}>
        <p className="text-[11px] text-muted-foreground/40">
          {loading ? 'Loading...' : 'No task selected'}
        </p>
      </div>
    );
  }

  const stagedFiles = gitStatus.files.filter((f) => f.staged);
  const unstagedFiles = gitStatus.files.filter((f) => !f.staged);
  const totalChanges = gitStatus.files.length;

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: 'hsl(var(--surface-1))' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-10 flex-shrink-0 border-b border-border/60">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase text-muted-foreground/70 tracking-[0.08em]">
            Changes
          </span>
          {totalChanges > 0 && (
            <span className="min-w-[18px] h-[16px] flex items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary tabular-nums px-1">
              {totalChanges}
            </span>
          )}
        </div>
        {gitStatus.branch && (
          <div className="flex items-center gap-1.5 text-muted-foreground/40 max-w-[45%]">
            <GitBranch size={10} strokeWidth={2} className="flex-shrink-0" />
            <span className="text-[10px] font-mono truncate" title={gitStatus.branch}>
              {gitStatus.branch}
            </span>
            {(gitStatus.ahead > 0 || gitStatus.behind > 0) && (
              <div className="flex items-center gap-1 flex-shrink-0">
                {gitStatus.ahead > 0 && (
                  <span className="flex items-center gap-0.5 text-[9px] text-[hsl(var(--git-added))]">
                    <ArrowUp size={8} strokeWidth={2.5} />{gitStatus.ahead}
                  </span>
                )}
                {gitStatus.behind > 0 && (
                  <span className="flex items-center gap-0.5 text-[9px] text-[hsl(var(--git-deleted))]">
                    <ArrowDown size={8} strokeWidth={2.5} />{gitStatus.behind}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* File lists */}
      <div className="flex-1 overflow-y-auto">
        {totalChanges === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <div className="w-8 h-8 rounded-xl bg-accent/40 flex items-center justify-center">
              <FileDiff size={14} className="text-muted-foreground/30" strokeWidth={1.5} />
            </div>
            <p className="text-[11px] text-muted-foreground/40">No changes</p>
          </div>
        )}

        {/* Staged */}
        {stagedFiles.length > 0 && (
          <div className="animate-fade-in">
            <button
              onClick={() => setStagedExpanded(!stagedExpanded)}
              className="flex items-center justify-between w-full px-3 h-8 text-[11px] font-medium text-muted-foreground/60 hover:bg-accent/30 transition-all duration-150"
            >
              <div className="flex items-center gap-1.5">
                {stagedExpanded
                  ? <ChevronDown size={11} strokeWidth={2} />
                  : <ChevronRight size={11} strokeWidth={2} />
                }
                <span>Staged</span>
                <span className="text-[10px] text-muted-foreground/30 font-normal tabular-nums">{stagedFiles.length}</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onUnstageAll(); }}
                className="p-[3px] rounded hover:bg-accent text-muted-foreground/40 hover:text-foreground transition-colors"
                title="Unstage all"
              >
                <Minus size={11} strokeWidth={2} />
              </button>
            </button>
            {stagedExpanded && (
              <div className="px-1 pb-1">
                {stagedFiles.map((file) => (
                  <FileItem
                    key={`staged-${file.path}`}
                    file={file}
                    onStage={() => {}}
                    onUnstage={() => onUnstageFile(file.path)}
                    onDiscard={() => {}}
                    onViewDiff={() => onViewDiff(file.path, true)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Unstaged */}
        {unstagedFiles.length > 0 && (
          <div className="animate-fade-in">
            <button
              onClick={() => setUnstagedExpanded(!unstagedExpanded)}
              className="flex items-center justify-between w-full px-3 h-8 text-[11px] font-medium text-muted-foreground/60 hover:bg-accent/30 transition-all duration-150"
            >
              <div className="flex items-center gap-1.5">
                {unstagedExpanded
                  ? <ChevronDown size={11} strokeWidth={2} />
                  : <ChevronRight size={11} strokeWidth={2} />
                }
                <span>Changes</span>
                <span className="text-[10px] text-muted-foreground/30 font-normal tabular-nums">{unstagedFiles.length}</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onStageAll(); }}
                className="p-[3px] rounded hover:bg-accent text-muted-foreground/40 hover:text-foreground transition-colors"
                title="Stage all"
              >
                <Plus size={11} strokeWidth={2} />
              </button>
            </button>
            {unstagedExpanded && (
              <div className="px-1 pb-1">
                {unstagedFiles.map((file) => (
                  <FileItem
                    key={`unstaged-${file.path}`}
                    file={file}
                    onStage={() => onStageFile(file.path)}
                    onUnstage={() => {}}
                    onDiscard={() => onDiscardFile(file.path)}
                    onViewDiff={() => onViewDiff(file.path, false)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
