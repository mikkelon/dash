import React, { useRef, useEffect, useState } from 'react';
import { sessionRegistry } from '../terminal/SessionRegistry';

interface TerminalPaneProps {
  id: string;
  cwd: string;
  autoApprove?: boolean;
}

export function TerminalPane({ id, cwd, autoApprove }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    sessionRegistry.attach({
      id,
      cwd,
      container,
      autoApprove,
    });

    return () => {
      sessionRegistry.detach(id);
    };
  }, [id, cwd, autoApprove]);

  return (
    <div
      ref={containerRef}
      className={`terminal-container w-full h-full relative transition-all duration-150 ${
        isDragOver ? 'ring-2 ring-inset ring-primary/30' : ''
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const files = e.dataTransfer.files;
        if (files.length > 0) {
          const paths = Array.from(files).map((f) => (f as File & { path: string }).path);
          const session = sessionRegistry.get(id);
          if (session) {
            session.writeInput(paths.join(' '));
          }
        }
      }}
    >
      {isDragOver && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-primary/5 pointer-events-none animate-fade-in">
          <div className="px-4 py-2 rounded-lg bg-primary/15 text-primary text-[12px] font-medium">
            Drop files to paste paths
          </div>
        </div>
      )}
    </div>
  );
}
