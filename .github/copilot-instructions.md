# Obision App Optional Soft - AI Agent Instructions

## Project Overview
GNOME application installer built with TypeScript, GTK4, and Libadwaita for managing Flatpak and Debian package installations. Uses **custom hybrid build system** (`scripts/build.js`) that transforms TypeScript into single-file GJS-executable JavaScript.

**Critical constraint**: GJS (GNOME JavaScript runtime) doesn't support ES modules or CommonJS - all code must be in global scope with direct class references.

**Application ID**: `com.obision.app.optional-soft` (used in GSettings, desktop files, GResource paths)

## Critical Build System ⚠️
**NEVER use `tsc` directly.** Always use `npm run build`, which orchestrates:
1. Runs `tsc` to compile TypeScript → CommonJS in `builddir/`
2. Strips CommonJS artifacts (`exports`, `require()`, `__importDefault`)
3. **Concatenates modules into single `builddir/main.js`** (no module system at runtime)
4. Transforms `@girs` imports → GJS `imports.gi` syntax (e.g., `import Gtk from "@girs/gtk-4.0"` → `const { Gtk } = imports.gi;`)
5. Replaces service references (e.g., `data_service_1.` → direct class access)
6. Copies `data/` resources to `builddir/data/`

**Concatenation order is critical** (see [`scripts/build.js:100-260`](scripts/build.js)):
- LoggerService first (other services depend on logging)
- UtilsService, DataService, SettingsService
- InstallDialog, ApplicationInfoDialog, ApplicationsList components
- ObisionAppOptionalSoftApplication main class last

**File edits**: Always edit TypeScript source in `src/`, never `builddir/` (gitignored, regenerated on build).

## Development Workflows

### Quick Development Cycle
```bash
npm start              # Build + run with NODE_ENV=development (enables detailed logging)
npm run build          # Build only (output: builddir/main.js)
./builddir/main.js     # Run without rebuilding
npm run dev            # TypeScript watch mode (tsc --watch, still need npm run build for GJS)
```

### Packaging & Distribution

**Debian/Native Install:**
```bash
npm run meson-install  # System install → /usr/share/obision-app-optional-soft/ (requires sudo)
npm run deb-build      # Build .deb → ../obision-app-optional-soft_*.deb
npm run install-data   # Copy applications.json + icons to /var/lib/ (alternative data location)
npm run clean          # Clean builddir/ + mesonbuilddir/ (recommended before packaging)
```

**Versioning:**
```bash
npm run release        # Auto-increment minor version + update all manifests
```
Manual version edits must sync: `package.json`, `meson.build` version, `debian/changelog` first entry

**Debugging tips**: 
- Check `builddir/main.js` after build to verify concatenation worked. If service methods are undefined at runtime, verify concatenation order in [`scripts/build.js`](scripts/build.js)
- **GJS version warning**: Always set `imports.gi.versions` BEFORE importing from `imports.gi` (handled in build script)
- **Resource paths**: Try system path first (`/usr/share/`), then `builddir/data/`, then `data/` for development
- **Widget parent errors**: GTK widgets can only have one parent - check UI XML structure before appending programmatically

## Architecture Patterns

### Component Pattern (NOT GTK subclasses)
Components are **composition wrapper classes** that create and manage GTK widgets:
```typescript
class ApplicationsList {
  private listbox: Gtk.ListBox;
  constructor(private parentWindow: Adw.ApplicationWindow) { 
    this.setupUI(); // Creates widgets internally
  }
  public getWidget(): Gtk.ScrolledWindow { return this.scrolledWindow; }
}
// Usage: window.append(new ApplicationsList(window).getWidget());
```
Why? GJS limitations with TypeScript classes + simpler than GTK template patterns.

### Service Singletons (Lazy Init)
All services use static instance pattern accessed via `.instance`:
```typescript
private dataService = DataService.instance; // First access initializes
```
**Initialization order matters**: LoggerService → UtilsService → DataService (data needs utils, utils needs logger).

### Data Flow (JSON → UI)
1. **App startup**: `DataService.constructor()` searches paths for `applications.json`, loads categories + apps
2. **UI build**: `ApplicationsList.loadCategories()` creates `Adw.ExpanderRow` per category
3. **Per category**: `getApplicationsByCategory(id)` → creates `Adw.SwitchRow` for each app
4. **Async status check**: Each row spawns `isApplicationInstalled()` subprocess → updates switch state
5. **Resource loading**: UI files loaded via `Gtk.Builder` with fallback chain (GResource → `/usr/share/` → `data/`)

### File Path Resolution (Critical for Packaging)
`DataService.APPLICATIONS_FILE_DIRS` tries paths in order:
1. `./data/` (development)
2. `/usr/local/share/obision-app-optional-soft/` (local install)
3. `/var/lib/obision-app-optional-soft/` (custom data dir)
4. `/usr/share/obision-app-optional-soft/` (system install)

Icon paths resolved similarly in `resolveIconPath()`. Always relative to found data directory.

## File Structure Conventions
- **Interfaces**: `src/interfaces/*.ts` - Data shapes (Application, Category, InstallApplicationData)
- **Services**: `src/services/*.ts` - Singleton logic (DataService, UtilsService, LoggerService, SettingsService)
- **Components**: `src/components/*.ts` - UI wrappers with `getWidget()` method (ApplicationsList, InstallDialog, ApplicationInfoDialog)
- **Main**: `src/main.ts` - Adw.Application lifecycle + window creation + keyboard shortcuts
- **Data**: `data/applications.json` - Single source for categories + apps, `data/ui/` - GTK Builder XML
- **Build artifacts**: `builddir/` - Generated JS (gitignored), DO NOT edit directly

## Package Management Integration
- **Flatpak**: `flatpak info <package>` to check install, `flatpak install flathub <package>` to install
- **Debian**: `apt show <package>` to check install, `pkexec apt-get install <package>` to install (requires PolicyKit)
- **Execution**: `UtilsService.executeCommand(cmd, args)` uses `Gio.Subprocess` with `STDOUT_PIPE | STDERR_PIPE`
- **Status check**: `isApplicationInstalled(app)` returns `stdout.trim().length > 0` (empty output = not installed)
- **Install operations**: Triggered by `InstallDialog` which shows progress, runs commands synchronously with `communicate_utf8()`
- **GNOME Shell folders**: Apps can auto-organize into category folders via GSettings (`org.gnome.desktop.app-folders`)

## GJS/GTK4 Specifics
- Import from `@girs` in TypeScript: `import Gtk from "@girs/gtk-4.0"`
- Build script converts to: `const { Gtk } = imports.gi;`
- **Adwaita widgets**: Prefer `Adw.ExpanderRow`, `Adw.SwitchRow` for modern GNOME UI
- **Resource loading**: Try GResource first (`add_from_resource('/com/obision/app/optional-soft/ui/...')`), fallback to file paths
- **File I/O**: Use `Gio.File.new_for_path()` + `load_contents()` for JSON (synchronous in GJS)
- **Subprocess execution**: `Gio.Subprocess` with `STDOUT_PIPE | STDERR_PIPE`, then `communicate_utf8()` for synchronous output
- **Async ops**: `GLib.timeout_add()` for deferred execution (e.g., `loadData()` waits for UI ready)
- **Environment vars**: `GLib.getenv('NODE_ENV')` for checking dev mode (enables detailed logging)

## UI Development
- Edit XML in `data/ui/main-window.ui` for layout changes
- Register resources in `data/com.obision.ObisionApps.gresource.xml`
- Use CSS classes like `boxed-list` for Adwaita styling
- Connect signals via `.connect()` in TypeScript, not XML handlers (commented out in UI files)

## TypeScript Gotchas
- **Avoid ES modules**: TypeScript config uses CommonJS (`"module": "CommonJS"`) to simplify build script transformation
- **Type definitions**: `@girs/*` packages provide types (@girs/gtk-4.0, @girs/adw-1, etc.), but GJS runtime uses different import syntax
- **Any casting**: Window content property needs cast: `(window as any).content = widget`
- **Static typing limits**: Some GJS APIs need `any` type (e.g., `application: this.application as any`)
- **No default exports**: Build script strips `__importDefault()` - use named imports or namespace imports

## Application Data Schema
Applications in `applications.json`:
```json
{
  "title": "App Name",
  "description": "...",
  "packageName": "com.example.App or package-name",
  "packageType": "FLATPAK or DEBIAN",
  "icon": "icons/applications/icon.png",
  "categoryId": 1  // optional, links to categories.json
}
```

Categories use numeric IDs (1-8) for Development Tools, Games, Office, Multimedia, Design, Internet, Tools, Education.

## Common Patterns
- **Dialogs**: Use `Adw.MessageDialog` for simple prompts, custom `InstallDialog` for installation progress
- **Lists**: `Gtk.ListBox` with `selection_mode: NONE` + `row-activated` signal
- **Images**: `Gtk.Image` with `file: path` or `icon_name: "symbolic-name"`
- **Async checks**: Package status checked async → UI updated in callback (see `loadApplications()`)
