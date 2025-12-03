# Obision Install - AI Agent Instructions

## Project Overview
A GNOME application installer built with TypeScript, GTK4, and Libadwaita. Uses a hybrid build system: TypeScript → GJS-compatible JavaScript via custom Node.js build script.

## Critical Build System
**DO NOT use `tsc` directly.** Use `npm run build` which:
1. Compiles TypeScript to CommonJS in `builddir/`
2. Strips CommonJS/TypeScript artifacts (exports, requires, `__importDefault`)
3. Combines all modules into single `builddir/main.js` with GJS-compatible imports
4. Converts `@girs` imports to GJS `imports.gi` syntax
5. Copies resources (`data/ui/`, `data/json/`, `data/icons/`) to `builddir/`

**Build script order matters**: `scripts/build.js` concatenates files in specific sequence (services → components → main) to avoid undefined references in single-file output.

## Run Commands
- **Development**: `npm start` (builds + runs)
- **Production install**: `npm run meson-install` (compiles via Meson + installs system-wide)
- **Direct run**: `./builddir/main.js` (after building)
- **Locale testing**: `npm run start:en|es|fr`

## Architecture

### Component Pattern
Components are instantiated classes, not GTK widgets themselves:
```typescript
class ApplicationsList {
  private listbox: Gtk.ListBox;
  constructor(private parentWindow: Adw.ApplicationWindow) { 
    this.setupUI(); 
  }
  public getWidget(): Gtk.ScrolledWindow { return this.scrolledWindow; }
}
// Usage: window.append(new ApplicationsList(window).getWidget());
```

### Service Singletons
Services use static instance pattern (`DataService.instance`, `UtilsService.instance`). Access via:
```typescript
private dataService = DataService.instance;
```

### Data Flow
1. `DataService` loads JSON from `data/json/` on init (categories.json, applications.json)
2. `ApplicationsList` reads categories → creates `Adw.ExpanderRow` for each
3. For each category, queries `getApplicationsByCategory(id)` → creates `Adw.SwitchRow` per app
4. UI files (`data/ui/main-window.ui`) loaded via `Gtk.Builder` from GResource bundle or fallback file path

## File Structure Conventions
- **Interfaces**: `src/interfaces/*.ts` (Application, Category) - define data shapes
- **Services**: `src/services/*.ts` - singleton business logic (DataService, UtilsService)
- **Components**: `src/components/*.ts` - UI component classes with `getWidget()` method
- **Main**: `src/main.ts` - application lifecycle + window creation
- **Data**: `data/json/` - application/category definitions, `data/ui/` - GTK Builder XML

## Package Management Integration
- **Flatpak**: Uses `flatpak info`, `flatpak remote-info flathub` commands
- **Debian**: Uses `apt show` command
- All async via `UtilsService.executeCommand()` returning `Promise<{stdout, stderr}>`
- Install status checked via `UtilsService.isApplicationInstalled(app)` (tests if command output has content)

## GJS/GTK4 Specifics
- Import from `@girs` in TypeScript: `import Gtk from "@girs/gtk-4.0"`
- Build script converts to: `const { Gtk } = imports.gi;`
- **Adwaita widgets**: Prefer `Adw.ExpanderRow`, `Adw.SwitchRow` for modern GNOME UI
- **Resource loading**: Try GResource first (`add_from_resource('/com/obision/ObisionApps/ui/...')`), fallback to file path
- **File I/O**: Use `Gio.File.new_for_path()` + `load_contents()` for JSON

## UI Development
- Edit XML in `data/ui/main-window.ui` for layout changes
- Register resources in `data/com.obision.ObisionApps.gresource.xml`
- Use CSS classes like `boxed-list` for Adwaita styling
- Connect signals via `.connect()` in TypeScript, not XML handlers (commented out in UI files)

## TypeScript Gotchas
- **Avoid ES modules**: TypeScript config uses CommonJS to simplify build script transformation
- **Type definitions**: `@girs/*` packages provide types, but GJS runtime uses different import syntax
- **Any casting**: Window content property needs cast: `(window as any).content = widget`
- **Static typing limits**: Some GJS APIs need `any` type (e.g., `application: this.application as any`)

## Development Workflow
1. Edit TypeScript in `src/`
2. Run `npm run build` (or `npm start` to build + run)
3. Test with `./builddir/main.js`
4. For production: `npm run meson-install` (requires sudo for system install)

## Application Data Schema
Applications in `applications.json`:
```json
{
  "title": "App Name",
  "description": "...",
  "packageName": "com.example.App or package-name",
  "packageType": "FLATPAK or DEBIAN",
  "icon": "data/icons/applications/icon.png",
  "categoryId": 1  // optional, links to categories.json
}
```

Categories use numeric IDs (1-6) for Development Tools, Games, Office, Multimedia, Design, Tools.

## Common Patterns
- **Dialogs**: Use `Adw.MessageDialog` for simple prompts, `Gtk.Dialog` for complex forms
- **Lists**: `Gtk.ListBox` with `selection_mode: NONE` + `row-activated` signal
- **Images**: `Gtk.Image` with `file: path` or `icon_name: "symbolic-name"`
- **Async checks**: Package status checked async → UI updated in callback (see `loadApplications()`)
