'use client';

import { useState, useEffect, useCallback } from 'react';
import { XCircle, Command } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ShortcutItem {
  keys: string[];
  label: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: ShortcutItem[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['Ctrl+K', '⌘K'], label: 'Command Palette' },
      { keys: ['1-9'], label: 'Switch to view (numbered)' },
    ],
  },
  {
    title: 'Chat',
    shortcuts: [
      { keys: ['Enter'], label: 'Send message' },
      { keys: ['Shift+Enter'], label: 'New line' },
      { keys: ['Escape'], label: 'Stop generation' },
    ],
  },
  {
    title: 'General',
    shortcuts: [
      { keys: ['?'], label: 'Show shortcuts' },
      { keys: ['Escape'], label: 'Close overlay' },
    ],
  },
];

export function KeyboardShortcuts() {
  const [isOpen, setIsOpen] = useState(false);

  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // '?' is Shift+/ — check both
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        // Don't trigger if user is typing in an input/textarea
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      // Close on Escape
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        close();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, close]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={close}
          />

          {/* Card */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="relative mx-4 max-w-md w-full rounded-xl border border-border/50 bg-card p-6 shadow-2xl"
          >
            {/* Header */}
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">
                Keyboard Shortcuts
              </h2>
              <button
                onClick={close}
                className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            {/* Shortcut Groups */}
            <div className="max-h-80 overflow-y-auto space-y-5 pr-1">
              {SHORTCUT_GROUPS.map((group) => (
                <div key={group.title}>
                  <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.title}
                  </h3>
                  <div className="space-y-2">
                    {group.shortcuts.map((shortcut) => (
                      <div
                        key={shortcut.label}
                        className="flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/50"
                      >
                        <span className="text-xs text-muted-foreground">
                          {shortcut.label}
                        </span>
                        <div className="flex items-center gap-1">
                          {shortcut.keys.map((key, idx) => (
                            <span key={key}>
                              <kbd className="bg-muted border border-border rounded px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground">
                                {key}
                              </kbd>
                              {idx < shortcut.keys.length - 1 && (
                                <span className="mx-1 text-[10px] text-muted-foreground/50">
                                  /
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="mt-4 border-t border-border/50 pt-3 text-center">
              <span className="text-[10px] text-muted-foreground/60">
                Press <kbd className="bg-muted border border-border rounded px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground">?</kbd> to toggle
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
