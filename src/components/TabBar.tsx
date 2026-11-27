import React from 'react';
import { FileText, Package, Plus, X } from 'lucide-react';
import { isLetraArchivePath, type DocumentTab } from '../../shared/types';

interface TabBarProps {
  tabs: DocumentTab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
}) => {
  return (
    <div className="flex items-center h-9 shrink-0 border-b border-[var(--letra-border)] bg-[var(--letra-chrome-bg)] px-2 gap-1 overflow-x-auto no-scrollbar select-none">
      {tabs.map((tab) => {
        const active = tab.id === activeTabId;
        const isDirty = tab.content !== tab.savedContent;

        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={active}
            onClick={() => onSelectTab(tab.id)}
            title={tab.filePath || tab.title}
            className={`group flex items-center gap-1.5 h-7 pl-2.5 pr-1.5 rounded-lg text-xs max-w-[200px] shrink-0 transition-all cursor-pointer ${
              active
                ? 'bg-[var(--letra-elevated)] text-[var(--letra-fg)] font-medium shadow-xs ring-1 ring-[var(--letra-border)]'
                : 'text-[var(--letra-muted)] hover:text-[var(--letra-fg)] hover:bg-[var(--letra-hover)]'
            }`}
          >
            {isLetraArchivePath(tab.filePath || tab.title) ? (
              <Package className="w-3.5 h-3.5 shrink-0 text-indigo-500" />
            ) : (
              <FileText className="w-3.5 h-3.5 shrink-0 opacity-65" />
            )}
            <span className="truncate">{tab.title}</span>

            <button
              type="button"
              aria-label={`Close ${tab.title}`}
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(tab.id);
              }}
              className="ml-0.5 p-0.5 rounded hover:bg-[var(--letra-border)] transition-colors cursor-pointer shrink-0 flex items-center justify-center w-4 h-4"
            >
              {isDirty ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 group-hover:hidden" />
                  <X className="w-3 h-3 hidden group-hover:block" />
                </>
              ) : (
                <X className="w-3 h-3 opacity-0 group-hover:opacity-80" />
              )}
            </button>
          </div>
        );
      })}

      <button
        type="button"
        title="New Tab (⌘/Ctrl + N)"
        onClick={onNewTab}
        className="p-1.5 rounded-lg text-[var(--letra-muted)] hover:text-[var(--letra-fg)] hover:bg-[var(--letra-hover)] transition-colors cursor-pointer shrink-0"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
