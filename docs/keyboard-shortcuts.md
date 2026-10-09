# Browser-safe node shortcuts

Click/focus a node row first. These shortcuts apply only to the node table, never
to inputs, editors, buttons, menus, dialogs, another page or an active IME composition.

Node rows also support file-manager-style mouse selection:

- Click a row to select only that node.
- Ctrl/Cmd-click toggles an individual node without clearing the rest of the selection.
- Shift-click selects the contiguous range from the last selection anchor; Ctrl/Cmd+Shift-click
  adds that range to the existing selection.

| Key | Action |
| --- | --- |
| A | Select all visible nodes |
| C | Copy selected share links |
| E | Edit focused/context node |
| S | Share selected nodes |
| 1 | TCP latency test |
| 2 | Real latency test |
| 3 | Download speed test |
| 4 | UDP test |
| 5 | Fast real latency test |
| 6 | Mixed test |
| Enter | Activate focused node |
| Delete | Delete selection (confirmation retained) |
| T / U / D / B | Move to top / up / down / bottom |
| Shift+F10 / ContextMenu | Open row context menu |
| Escape | Close the topmost application layer |

Node actions do not bind Ctrl, Alt or Meta chords. In particular, Ctrl+T/O/R/F/D/W/L
remain browser-owned; no attempt is made to prevent non-cancelable browser shortcuts.
Backspace is not a delete shortcut. Menu hints use the same keys as the actual mapping.

Within code textareas only: Tab inserts two spaces, Shift+Tab moves focus, Ctrl+Enter
(or Cmd+Enter) saves. This is editor-scoped, not a global browser shortcut.
