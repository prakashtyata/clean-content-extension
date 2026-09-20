# Clean Content Editor

Clean and strip HTML formatting from Google Docs, Word, and rich text. Preserve links and get **pure, semantic HTML** instantly — no inline styles, wrapper spam, or Google Docs artifacts.

## Features

- **WYSIWYG editor** — paste rich content, format it visually (bold, italic, headings, lists, links), and watch the clean HTML update live.
- **Google Docs / Word cleanup** — removes `<meta>`, `<style>`, `<script>`, comments (`<!--StartFragment-->`), wrapper `<span>`/`<font>`/`<div>` tags, empty paragraphs, and non-semantic attributes.
- **Smart link handling** — Google `/url?q=` redirect links are restored to their real destination automatically.
- **Semantic output** — `b` → `strong`, `i` → `em`, headings preserved, tables keep useful attributes (`colspan`, `rowspan`, `scope`), nested list artifacts promoted to flat lists.
- **Clean HTML output** — live stats (words, characters, links, paragraphs), copy as HTML / plain text / Markdown, dark mode.
- **Settings** — auto-copy result, preserve images or keep them as `[Image: alt]` links, strip empty paragraphs, preserve headings, smart quotes → straight quotes. Persisted per-user.
- **Keyboard shortcuts** — full toolbar plus `Ctrl+Shift+C` (copy), `Ctrl+Shift+X` (clear), `Ctrl+Z/Y` (undo/redo).
- **100% offline** — works without a network connection.

## Installation (unpacked)

1. Download or clone this repository.
2. Open your browser's extension page:
   - Chrome / Edge: `chrome://extensions` or `edge://extensions`
   - Brave: `brave://extensions`
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the folder containing `manifest.json` (this repo root).
5. Pin the extension and click the icon to open it.

> Optionally, zip the repo folder and drag it into `chrome://extensions` to load it as a packaged extension after enabling Developer mode.

## Usage

1. Copy content from Google Docs, Word, an email, or any rich text source.
2. Click **Clean Content** and paste into the editor (`Ctrl+V`).
3. The **Clean HTML** panel updates instantly. Adjust settings inside the ⚙️ panel if needed.
4. Click **Copy** (or press `Ctrl+Shift+C`) to get the clean content on your clipboard — as HTML, plain text, or Markdown.

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+B` / `Ctrl+I` / `Ctrl+U` | Bold / Italic / Underline |
| `Ctrl+Z` / `Ctrl+Y` | Undo / Redo |
| `Ctrl+Shift+C` | Copy clean content |
| `Ctrl+Shift+X` | Clear editor |

## Settings

| Setting | Default | Effect |
|---|---|---|
| Auto-copy cleaned HTML | Off | Copies the result to the clipboard automatically |
| Preserve images | Off | Keeps `<img>` tags instead of removing them |
| Retain image links | Off | Replaces removed images with `[Image: alt]` links to their URL |
| Strip empty paragraphs | On | Removes empty `<p>` / `<p>&nbsp;</p>` blocks |
| Preserve headings | On | Keeps `h1`–`h6`; when off, headings become paragraphs |
| Smart quotes → straight quotes | On | Converts curly quotes, dashes, ellipses, and non-breaking spaces |

## Project Structure

```
clean-content-extension/
├── manifest.json   # MV3 manifest
├── popup.html      # Popup UI
├── popup.css       # Styling (light/dark)
├── popup.js        # Editor logic + HTML cleaning engine
└── icons/          # Extension icons (16/48/128)
```

## Development

The cleaning engine lives in `cleanHTML()` inside `popup.js`. It works entirely DOM-based:

1. parse the source into a detached `div`
2. drop non-semantic nodes (`style`, `meta`, `link`, `script`, comments)
3. unwrap wrapper tags and normalize `b`/`i`
4. strip attributes against a per-tag allowlist (links, images, table cells)
5. apply punctuation normalization to text nodes only
6. serialize and format the output with readable line breaks

After editing, reload the extension on `chrome://extensions` and verify by pasting content from Google Docs or Word.

## Credits

- **Developer:** Prakash Tyata — [prakashtyata.com.np](https://prakashtyata.com.np)
- **Publisher:** SoftART — [softart.com.np](https://softart.com.np)

## License

MIT — see [LICENSE](LICENSE).