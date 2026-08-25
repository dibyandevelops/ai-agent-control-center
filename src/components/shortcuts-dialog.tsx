"use client";

import { Keyboard, X } from "lucide-react";
import React from "react";

interface ShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
}

interface ShortcutSection {
  title: string;
  items: ShortcutItem[];
}

const SHORTCUT_SECTIONS: ShortcutSection[] = [
  {
    title: "Navigation",
    items: [
      { keys: ["G", "O"], description: "Go to Overview" },
      { keys: ["G", "A"], description: "Go to Agents inventory" },
      { keys: ["G", "P"], description: "Go to Policies & rules" },
      { keys: ["G", "I"], description: "Go to Integrations" },
      { keys: ["G", "U"], description: "Go to Audit log" },
      { keys: ["G", "C"], description: "Go to API Credentials" },
      { keys: ["G", "T"], description: "Go to Team & Operators" },
    ],
  },
  {
    title: "Global Actions",
    items: [
      { keys: ["⌘ / Ctrl", "K"], description: "Open Command Palette" },
      { keys: ["?"], description: "Open Keyboard Shortcuts" },
      { keys: ["T"], description: "Toggle Light / Dark theme" },
      { keys: ["Esc"], description: "Close active drawer or modal" },
    ],
  },
  {
    title: "Agent Table Controls",
    items: [
      { keys: ["Click"], description: "Open agent deep-dive drawer" },
      { keys: ["Search"], description: "Focus agent search filter" },
    ],
  },
];

export function ShortcutsDialog({ open, onClose }: ShortcutsDialogProps) {
  if (!open) return null;

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={onClose}
    >
      <div
        className="dialog max-w-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="dialog-header">
          <div className="dialog-title">
            <div className="grid h-8 w-8 place-items-center rounded-lg border border-sentinel-border bg-sentinel-accent-soft text-sentinel-accent">
              <Keyboard className="h-4 w-4" />
            </div>
            <div>
              <h2 id="shortcuts-title">Keyboard Shortcuts</h2>
              <p>Navigate and control SentinelOps at terminal speed.</p>
            </div>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close shortcuts dialog"
          >
            <X />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-5 space-y-6">
          {SHORTCUT_SECTIONS.map((section) => (
            <div key={section.title} className="space-y-2.5">
              <h3 className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-sentinel-muted">
                {section.title}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {section.items.map((item) => (
                  <div
                    key={item.description}
                    className="flex items-center justify-between gap-3 rounded-xl border border-sentinel-border bg-sentinel-canvas/60 px-3 py-2 text-xs"
                  >
                    <span className="text-sentinel-text text-[11px] truncate">
                      {item.description}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.keys.map((key) => (
                        <kbd
                          key={key}
                          className="inline-flex min-h-[22px] min-w-[22px] items-center justify-center rounded border border-sentinel-border bg-sentinel-surface px-1.5 font-mono text-[10px] font-semibold text-sentinel-text shadow-sm"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-sentinel-border bg-sentinel-surface-raised px-5 py-3 text-right">
          <button
            type="button"
            className="secondary-button"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
