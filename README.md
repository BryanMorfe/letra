# Letra

**Letra** is an elegant, print-ready desktop Markdown studio for **macOS** and **Linux**, built with Electron, React, TypeScript, and CodeMirror 6.

## Highlights

- **Raw, Split & Preview Views** — Switch seamlessly between Raw Markdown, resizable Split View (with optional synchronized scrolling), and Rendered Preview (`⌘/Ctrl + 1 / 2 / 3`).
- **Beyond Plain Markdown** — Full GFM (tables, checklists, footnotes), **LaTeX math** via KaTeX (`$...$`, `$$...$$`, `\(...\)`, `\[...\]`), **Mermaid diagrams**, syntax-highlighted code blocks, GitHub-style callouts (`> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`), and safely sanitized Markdown HTML.
- **Print-Ready Page Mode** — Preview documents laid out across discrete paper sheets (**US Letter**, **US Legal**, **A4**, **A5**, **B5**, **Executive**, or **Custom** sizes in `in`/`mm`), portrait or landscape, customizable margins, running headers/footers with `{title}`, `{date}`, `{page}`, `{pages}`, and explicit page breaks (`<!-- pagebreak -->` or `\newpage`).
- **Adaptive Themes** — Light, Dark, and System (default, reacts live to OS appearance), plus optional White Paper Print Preview in Dark Mode.
- **Effortless Asset Importing** — Drag & drop, paste from clipboard, or import images, SVGs, audio, and video directly into a co-located `./assets/` folder next to your `.md` file — with a one-click toggle to embed as base64.
- **Multi-Tab Workspace & Sidebar** — Open multiple documents in tabs, browse local folders in the collapsible file tree, or jump across sections via the live Document Outline (TOC).
- **PDF & Standalone HTML Export** — Export crisp vector PDFs honoring Page Mode dimensions, margins, headers/footers, and page numbers, or export self-contained HTML documents.

---

## Installation

Download the latest prebuilt release for macOS or Linux from the [GitHub Releases page](https://github.com/BryanMorfe/letra/releases/latest).

### macOS

1. Download the macOS installer from [Releases](https://github.com/BryanMorfe/letra/releases/latest):
   - **Apple Silicon (M1 / M2 / M3 / M4):** `Letra-0.1.0-arm64.dmg` (or `Letra-0.1.0-arm64-mac.zip`)
2. Open the `.dmg` file and drag **Letra.app** into your **Applications** folder.
3. Because prebuilt releases are currently ad-hoc signed (not Apple-notarized), clear the macOS quarantine flag once after copying to `/Applications`:

```bash
xattr -cr /Applications/Letra.app
```

4. Launch **Letra** from Spotlight (`⌘ Space` → `Letra`) or `/Applications`.

> **Tip:** You can also right-click any `.md` file in Finder and choose **Open With → Letra**.

### Linux

Download either the universal **AppImage** or the Debian/Ubuntu **`.deb`** package from [Releases](https://github.com/BryanMorfe/letra/releases/latest):

#### Option 1: AppImage (Any Linux Distro)

```bash
chmod +x Letra-0.1.0.AppImage
./Letra-0.1.0.AppImage
```

> **Note (Ubuntu 22.04+ / Fedora):** AppImages require `libfuse2`. On Ubuntu/Debian, install it with `sudo apt install libfuse2` (or `libfuse2t64` on Ubuntu 24.04+). If you run into Electron sandbox permissions on some distros, run with `./Letra-0.1.0.AppImage --no-sandbox`.

#### Option 2: Debian / Ubuntu (`.deb`)

```bash
sudo apt install ./letra_0.1.0_amd64.deb
```

Then launch **Letra** from your application launcher or by running `letra` in your terminal.

---

## Keyboard Shortcuts

| Action | macOS | Linux |
| :--- | :--- | :--- |
| New Document | `⌘ N` | `Ctrl + N` |
| Open File / Folder | `⌘ O` / `⌘ ⇧ O` | `Ctrl + O` / `Ctrl + Shift + O` |
| Save / Save As | `⌘ S` / `⌘ ⇧ S` | `Ctrl + S` / `Ctrl + Shift + S` |
| Raw / Split / Preview | `⌘ 1` / `⌘ 2` / `⌘ 3` | `Ctrl + 1` / `Ctrl + 2` / `Ctrl + 3` |
| Toggle Page Mode | `⌘ ⇧ P` | `Ctrl + Shift + P` |
| Toggle Sidebar | `⌘ \` | `Ctrl + \` |
| Import Image / Asset | `⌘ ⇧ I` | `Ctrl + Shift + I` |
| Export PDF / HTML | `⌘ E` / `⌘ ⇧ E` | `Ctrl + E` / `Ctrl + Shift + E` |

---

## Building from Source

Requires **Node.js 20+** and **npm**.

```bash
git clone https://github.com/BryanMorfe/letra.git
cd letra
npm install

# Run in development mode
npm run dev
```

### Verification & Packaging

```bash
npm run typecheck
npm test
npm run build

# Build native installers into release/
npm run package:mac    # macOS .dmg & .zip
npm run package:linux  # Linux .AppImage & .deb
```

## License

MIT © [Bryan Morfe](https://github.com/BryanMorfe)
