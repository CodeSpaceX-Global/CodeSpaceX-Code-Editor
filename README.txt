CodeSpace Full Local IDE
========================

WHAT'S INCLUDED
- Desktop workspace at index.html
- Separate mobile-first entry at mobile.html
- Responsive file explorer, tabs, editor and preview
- HTML / CSS / JavaScript learning guides with insertable snippets
- Offline autocomplete/suggestion popup for HTML, CSS and JavaScript
- Tab expands matching shortcuts (e.g. !, h1, color, clg) or inserts indentation
- Common editor shortcuts: Ctrl/Cmd+S, Ctrl/Cmd+Enter, Ctrl/Cmd+/, Ctrl/Cmd+F/H/G/P, Ctrl/Cmd+Shift+K, Alt+Up/Down
- Built-in extension center (toggle snippet packs and tools on/off)
- HTML, CSS and JS shortcut expansion
- Local browser storage
- Create files and folders, rename/delete from the file explorer context menu or long-press
- Offline syntax-color overlay for common HTML/JS tokens, font zoom and light/dark editor toggle
- Auto-close brackets, quotes and common HTML tags; built-in textarea undo/redo
- Search/replace across project files; live preview console captures console output and JS errors
- Preview device widths for phone, tablet and desktop
- Preview localStorage shim persists key/value data across preview runs in this browser
- Image/media/font/binary file import and ZIP preservation; local image assets are embedded into preview
- Create files, save, run preview, basic whitespace formatting
- Export complete project as a ZIP archive
- Import individual files into the current project
- Open/import a folder (keeps relative subfolder paths on supported desktop browsers)
- Upload/import an existing ZIP project archive
- Optional JSON backup import remains available
- Keyboard shortcuts: Ctrl/Cmd+S save, Ctrl/Cmd+Enter run, Tab inserts spaces

RUN IN VS CODE
1. Extract the ZIP.
2. Open the folder in VS Code.
3. Recommended: install the Live Server extension.
4. Right-click index.html -> Open with Live Server.
5. For mobile-first UI, open mobile.html with Live Server instead.
   On the same Wi-Fi, use Live Server's network URL if your firewall permits it.

LOCAL STORAGE
Project files are stored in browser localStorage on that device/profile. Export a ZIP
backup before clearing browser data. This is not cloud storage and edits are not
automatically written back to the original computer folder. Importing a folder copies
its supported text/code files into the browser workspace; it does not keep a live link
with that folder.

EXTENSIONS
The Extension Center provides built-in CodeSpace features/snippet packs. It does not
install arbitrary extensions from the Visual Studio Code Marketplace. The app runs
without a CDN or framework dependency.

LIMITATIONS
This is a lightweight local IDE starter, not a complete VS Code replacement. It uses
a plain textarea with built-in offline suggestions/snippets; it does not provide full
syntax highlighting, language-server IntelliSense, multi-cursor editing, Git, terminal,
arbitrary binary assets or full VS Code extension compatibility. Folder import and ZIP
import/export are supported for text/code files; binary assets are skipped. Shortcuts are a useful subset,
not every VS Code keybinding or every Emmet abbreviation.
The preview combines project CSS/JS files into the first HTML page; complex relative
asset paths and multi-page routing may require additional implementation. The built-in
ZIP reader/writer is bundled locally, so ZIP actions do not require a CDN connection.

MOBILE TOUCH TOOLBAR (latest update)
- Touch buttons: Tab, Suggest, Expand, braces, parentheses, semicolon, comment, undo and redo.
- Suggest opens an on-screen list that can be tapped; keyboard Ctrl/Tab shortcuts are not required.
- On small screens the suggestion panel is raised above the touch toolbar.
