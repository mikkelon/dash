import React, { useState } from 'react';
import { FolderOpen, Plus, Trash2, Archive, Settings, GitBranch, ChevronRight, ChevronDown, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type { Project, Task } from '../../shared/types';

interface LeftSidebarProps {
  projects: Project[];
  activeProjectId: string | null;
  onSelectProject: (id: string) => void;
  onOpenFolder: () => void;
  onDeleteProject: (id: string) => void;
  tasksByProject: Record<string, Task[]>;
  activeTaskId: string | null;
  onSelectTask: (projectId: string, taskId: string) => void;
  onNewTask: (projectId: string) => void;
  onDeleteTask: (id: string) => void;
  onArchiveTask: (id: string) => void;
  onOpenSettings: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function LeftSidebar({
  projects,
  activeProjectId,
  onSelectProject,
  onOpenFolder,
  onDeleteProject,
  tasksByProject,
  activeTaskId,
  onSelectTask,
  onNewTask,
  onDeleteTask,
  onArchiveTask,
  onOpenSettings,
  collapsed,
  onToggleCollapse,
}: LeftSidebarProps) {
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());

  function toggleCollapse(projectId: string) {
    setCollapsedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  }

  if (collapsed) {
    return (
      <div className="h-full flex flex-col items-center py-3" style={{ background: 'hsl(var(--surface-1))' }}>
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-md hover:bg-accent/60 text-muted-foreground/60 hover:text-foreground transition-colors titlebar-no-drag"
          title="Expand sidebar"
        >
          <PanelLeftOpen size={18} strokeWidth={1.5} />
        </button>

        <button
          onClick={onOpenFolder}
          className="mt-1 p-1.5 rounded-md hover:bg-accent/60 text-muted-foreground/60 hover:text-foreground transition-colors titlebar-no-drag"
          title="Open folder"
        >
          <FolderOpen size={18} strokeWidth={1.5} />
        </button>

        <div className="w-6 border-t border-border/30 my-2" />

        <div className="flex-1 overflow-y-auto flex flex-col items-center gap-1.5 w-full px-1.5">
          {projects.map((project) => {
            const isActive = project.id === activeProjectId;
            return (
              <button
                key={project.id}
                onClick={() => onSelectProject(project.id)}
                className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-medium transition-colors titlebar-no-drag ${
                  isActive
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground/50 hover:bg-accent/60 hover:text-foreground'
                }`}
                title={project.name}
              >
                {project.name.charAt(0).toUpperCase()}
              </button>
            );
          })}
        </div>

        <div className="w-6 border-t border-border/30 my-2" />

        <button
          onClick={onOpenSettings}
          className="p-2 rounded-md hover:bg-accent/60 text-muted-foreground/40 hover:text-foreground transition-colors titlebar-no-drag"
          title="Settings"
        >
          <Settings size={18} strokeWidth={1.5} />
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" style={{ background: 'hsl(var(--surface-1))' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <span className="text-[13px] font-medium text-muted-foreground/50 select-none">
          Projects
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={onOpenFolder}
            className="p-1.5 rounded-md hover:bg-accent/60 text-muted-foreground/50 hover:text-foreground transition-colors titlebar-no-drag"
            title="Open folder"
          >
            <FolderOpen size={16} strokeWidth={1.5} />
          </button>
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-md hover:bg-accent/60 text-muted-foreground/50 hover:text-foreground transition-colors titlebar-no-drag"
            title="Collapse sidebar"
          >
            <PanelLeftClose size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 pt-1">
        {projects.length === 0 && (
          <div className="px-2 py-10 text-center">
            <p className="text-[13px] text-muted-foreground/40 leading-relaxed">
              Open a folder to get started
            </p>
          </div>
        )}

        <div className="space-y-px">
          {projects.map((project) => {
            const isActive = project.id === activeProjectId;
            const isCollapsed = collapsedProjects.has(project.id);
            const projectTasks = (tasksByProject[project.id] || []).filter((t) => !t.archivedAt);

            return (
              <div key={project.id}>
                {/* Project row */}
                <div
                  className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg text-[15px] cursor-pointer transition-colors relative ${
                    isActive
                      ? 'text-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => {
                    onSelectProject(project.id);
                    if (collapsedProjects.has(project.id)) {
                      toggleCollapse(project.id);
                    }
                  }}
                >
                  {/* Active accent */}
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-4 rounded-r-full bg-primary" />
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCollapse(project.id);
                    }}
                    className="p-0.5 rounded flex-shrink-0 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                  >
                    {isCollapsed ? (
                      <ChevronRight size={16} strokeWidth={1.8} />
                    ) : (
                      <ChevronDown size={16} strokeWidth={1.8} />
                    )}
                  </button>

                  <span className="truncate flex-1">{project.name}</span>

                  {projectTasks.length > 0 && (
                    <span className="text-xs text-muted-foreground/30 tabular-nums flex-shrink-0">
                      {projectTasks.length}
                    </span>
                  )}

                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNewTask(project.id);
                      }}
                      className="p-1 rounded-md hover:bg-foreground/10 text-muted-foreground/40 hover:text-foreground transition-colors"
                      title="New task"
                    >
                      <Plus size={16} strokeWidth={1.8} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteProject(project.id);
                      }}
                      className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive transition-colors"
                      title="Remove project"
                    >
                      <Trash2 size={16} strokeWidth={1.5} />
                    </button>
                  </div>
                </div>

                {/* Tasks */}
                {!isCollapsed && (
                  <div className="ml-[26px]">
                    {projectTasks.map((task) => {
                      const isActiveTask = task.id === activeTaskId;
                      return (
                        <div
                          key={task.id}
                          className={`group flex items-center gap-2 px-2.5 py-[7px] rounded-lg text-sm cursor-pointer transition-colors relative ${
                            isActiveTask
                              ? 'text-foreground font-medium'
                              : 'text-muted-foreground/60 hover:text-foreground'
                          }`}
                          onClick={() => onSelectTask(project.id, task.id)}
                        >
                          {/* Active indicator */}
                          {isActiveTask && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-3 rounded-full bg-primary/70" />
                          )}

                          {/* Status dot */}
                          <div className="relative flex-shrink-0">
                            <div
                              className={`w-[7px] h-[7px] rounded-full ${
                                task.status === 'active'
                                  ? 'bg-[hsl(var(--git-added))] status-pulse'
                                  : isActiveTask
                                    ? 'bg-primary/50'
                                    : 'bg-muted-foreground/20'
                              }`}
                            />
                          </div>

                          <span className="truncate flex-1">{task.name}</span>

                          {isActiveTask && (
                            <GitBranch size={13} className="text-muted-foreground/30 flex-shrink-0" strokeWidth={1.8} />
                          )}

                          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onArchiveTask(task.id);
                              }}
                              className="p-1 rounded-md hover:bg-foreground/10 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                              title="Archive task"
                            >
                              <Archive size={15} strokeWidth={1.5} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteTask(task.id);
                              }}
                              className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive transition-colors"
                              title="Delete task"
                            >
                              <Trash2 size={15} strokeWidth={1.5} />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {projectTasks.length === 0 && isActive && (
                      <div className="px-2.5 py-2">
                        <p className="text-xs text-muted-foreground/30">
                          No tasks yet
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Settings */}
      <div className="px-2 py-2 border-t border-border/30">
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-2.5 px-2.5 py-2 w-full rounded-lg text-sm text-muted-foreground/50 hover:text-foreground transition-colors titlebar-no-drag"
        >
          <Settings size={17} strokeWidth={1.5} />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
}
