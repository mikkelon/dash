import React, { useEffect } from 'react';
import { X, FileText } from 'lucide-react';
import type { DiffResult } from '../../shared/types';

interface DiffViewerProps {
  diff: DiffResult | null;
  loading: boolean;
  onClose: () => void;
}

export function DiffViewer({ diff, loading, onClose }: DiffViewerProps) {
  if (!diff && !loading) return null;

  // Close on backdrop click
  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop animate-fade-in"
      onClick={handleBackdropClick}
    >
      <div className="bg-card border border-border/60 rounded-xl shadow-2xl shadow-black/40 w-[92vw] max-w-5xl h-[85vh] flex flex-col animate-scale-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 h-12 border-b border-border/60 flex-shrink-0" style={{ background: 'hsl(var(--surface-2))' }}>
          <div className="flex items-center gap-3 min-w-0">
            <FileText size={14} className="text-muted-foreground/50 flex-shrink-0" strokeWidth={1.8} />
            <span className="text-[13px] font-medium text-foreground truncate">
              {diff?.filePath || 'Loading...'}
            </span>
            {diff && !diff.isBinary && (diff.additions > 0 || diff.deletions > 0) && (
              <div className="flex gap-2 text-[11px] font-mono flex-shrink-0 tabular-nums">
                {diff.additions > 0 && (
                  <span className="text-[hsl(var(--git-added))]">+{diff.additions}</span>
                )}
                {diff.deletions > 0 && (
                  <span className="text-[hsl(var(--git-deleted))]">-{diff.deletions}</span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground/50 hover:text-foreground transition-all duration-150"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto font-mono text-[12px] leading-[20px]">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                <span className="text-[13px] text-muted-foreground/50">Loading diff...</span>
              </div>
            </div>
          )}

          {diff?.isBinary && (
            <div className="flex items-center justify-center h-full">
              <span className="text-[13px] text-muted-foreground/40">Binary file — cannot display diff</span>
            </div>
          )}

          {diff && !diff.isBinary && diff.hunks.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <span className="text-[13px] text-muted-foreground/40">No differences</span>
            </div>
          )}

          {diff && !diff.isBinary && diff.hunks.map((hunk, hi) => (
            <div key={hi}>
              {/* Hunk header */}
              <div className="diff-hunk px-5 py-1.5 text-[hsl(var(--git-renamed))]/70 border-y border-border/20 sticky top-0 backdrop-blur-sm text-[11px]">
                {hunk.header}
              </div>

              {/* Lines */}
              {hunk.lines.map((line, li) => {
                const isAdd = line.type === 'add';
                const isDel = line.type === 'delete';

                return (
                  <div
                    key={`${hi}-${li}`}
                    className={`flex ${isAdd ? 'diff-add' : isDel ? 'diff-delete' : ''} transition-colors duration-75`}
                  >
                    {/* Old line number */}
                    <span className="w-14 flex-shrink-0 text-right pr-3 text-muted-foreground/20 select-none border-r border-border/10 tabular-nums">
                      {line.oldLineNumber ?? ''}
                    </span>
                    {/* New line number */}
                    <span className="w-14 flex-shrink-0 text-right pr-3 text-muted-foreground/20 select-none border-r border-border/10 tabular-nums">
                      {line.newLineNumber ?? ''}
                    </span>
                    {/* Marker */}
                    <span className={`w-8 flex-shrink-0 text-center select-none ${
                      isAdd ? 'text-[hsl(var(--git-added))]/60' : isDel ? 'text-[hsl(var(--git-deleted))]/60' : 'text-muted-foreground/15'
                    }`}>
                      {isAdd ? '+' : isDel ? '-' : ' '}
                    </span>
                    {/* Content */}
                    <span className={`flex-1 pr-5 whitespace-pre ${
                      isAdd ? 'text-[hsl(var(--git-added))]/80' : isDel ? 'text-[hsl(var(--git-deleted))]/80' : 'text-foreground/70'
                    }`}>
                      {line.content}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
