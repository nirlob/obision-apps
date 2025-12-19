// //#!/usr/bin/env gjs

import Gio from '@girs/gio-2.0';
import Gtk from '@girs/gtk-4.0';
import Gdk from '@girs/gdk-4.0';
import Adw from '@girs/adw-1';
import { ApplicationsList } from './components/applications-list.js';
import { Application } from './interfaces/application.js';
import { InstallDialog } from './components/install-dialog.js';
import { InstallApplicationData } from './interfaces/install-application.js';
import { LoggerService } from './services/logger-service.js';
import { SettingsService } from './services/settings-service.js';

class ObisionAppOptionalSoftApplication {
  private application: Adw.Application;
  private installApplicationsData: InstallApplicationData[] = [];
  private installButton!: Gtk.Button;
  private installInFolderToggleButton!: Gtk.ToggleButton;
  private logger = LoggerService.instance;
  private settingsService = SettingsService.instance;
  private mainWindow!: Adw.ApplicationWindow;

  constructor() {
    // Create the application
    this.application = new Adw.Application({
      application_id: 'com.obision.app.optional-soft',
      flags: Gio.ApplicationFlags.DEFAULT_FLAGS,
    });

    // Connect signals
    this.application.connect('activate', this.onActivate.bind(this));
    this.application.connect('startup', this.onStartup.bind(this));
  }

  private onStartup(): void {
    this.logger.info('Application starting up');

    // Add application actions for menu
    const aboutAction = new Gio.SimpleAction({ name: 'about' });
    aboutAction.connect('activate', () => {
      const windows = this.application.get_windows();
      if (windows.length > 0) {
        this.showAboutDialog(windows[0]);
      }
    });
    this.application.add_action(aboutAction);

    const preferencesAction = new Gio.SimpleAction({ name: 'preferences' });
    preferencesAction.connect('activate', () => {
      this.logger.info('Preferences action activated');
    });
    this.application.add_action(preferencesAction);

    const quitAction = new Gio.SimpleAction({ name: 'quit' });
    quitAction.connect('activate', () => {
      this.application.quit();
    });
    this.application.add_action(quitAction);

    // Set keyboard shortcuts
    this.application.set_accels_for_action('app.quit', ['<Ctrl>Q']);

    // Set resource path
    // this.application.set_resource_base_path('/data');
  }

  private onActivate(): void {
    this.logger.info('Application activated');

    // Load CSS
    const cssProvider = new Gtk.CssProvider();
    // Try installed path first, then development paths
    try {
      cssProvider.load_from_path('/usr/share/obision-app-optional-soft/style.css');
    } catch (e) {
      try {
        cssProvider.load_from_path('builddir/data/style.css');
      } catch (e2) {
        cssProvider.load_from_path('data/style.css');
      }
    }

    const display = Gdk.Display.get_default();
    if (display) {
      Gtk.StyleContext.add_provider_for_display(display, cssProvider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
    }

    // Create and show the main window
    this.mainWindow = this.createMainWindow();
    this.settingsService.restoreWindowState(this.mainWindow);
    this.logger.info('Window created, presenting');
    this.mainWindow.present();
  }

  private createMainWindow(): Adw.ApplicationWindow {
    // Create the main window
    const window = new Adw.ApplicationWindow({
      application: this.application as any,
      title: 'Optional Applications Installer',
    });

    // Save window state before closing
    window.connect('close-request', () => {
      this.settingsService.saveWindowState(this.mainWindow);
      return false;
    });

    // Load UI from resource
    const builder = Gtk.Builder.new();

    // Fallback: load from file
    try {
      // Try installed path first
      try {
        builder.add_from_file('/usr/share/obision-app-optional-soft/ui/main-window.ui');
      } catch (e) {
        builder.add_from_file('data/ui/main-window.ui');
      }
      this.logger.info('Loaded UI from file');
    } catch (e2) {
      this.logger.error('Could not load UI file', { error: String(e2) });
      this.logger.info('Using fallback UI');

      this.application.quit();
    }

    // Get the main content from the UI file
    const mainContent = builder.get_object('main_content') as Gtk.Box;

    if (mainContent) {
      this.logger.info('Setting up UI with loaded content');

      this.installButton = builder.get_object('install_button') as Gtk.Button;
      this.installButton.connect('clicked', () => {
        const installDialog = new InstallDialog(window, this.installApplicationsData, this.installInFolderToggleButton.get_active());
        installDialog.setApplicationsInstalledCallback(() => this.onApplicationsInstalled());
      });

      // Create toast overlay
      const toastOverlay = new Adw.ToastOverlay();

      // Create header bar with menu button
      const headerBar = new Adw.HeaderBar();

      // Create menu model
      const menuModel = new Gio.Menu();
      menuModel.append('About', 'app.about');
      menuModel.append('Preferences', 'app.preferences');
      menuModel.append('Quit', 'app.quit');

      // Create menu button
      const menuButton = new Gtk.MenuButton({
        icon_name: 'open-menu-symbolic',
        menu_model: menuModel,
        tooltip_text: 'Application menu',
      });
      headerBar.pack_end(menuButton);

      this.installInFolderToggleButton = new Gtk.ToggleButton({
        tooltip_text: 'Generates a new folder in applications screen, if not exists, with the name of the category and sets the applications there',
        icon_name: 'folder-symbolic',
      });
      headerBar.pack_end(this.installInFolderToggleButton);

      // Set up toolbar view with header and content
      const toolbarView = new Adw.ToolbarView();
      toolbarView.add_top_bar(headerBar);
      toolbarView.set_content(mainContent);

      toastOverlay.set_child(toolbarView);

      // Use the content property for Adw.ApplicationWindow
      (window as any).content = toastOverlay;

      const applicationsContent = builder.get_object('applications_content') as Gtk.Box;
      
      const applicationsList = new ApplicationsList(window);
      applicationsList.setInstallCallback((app, install) => this.onApplicationClick(app, install));
      applicationsContent.append(applicationsList.getWidget());

      const searchEntry = new Gtk.SearchEntry({
        hexpand: true,
        placeholder_text: 'Search applications...',
      });

      searchEntry.connect('search-changed', () => {
        const searchText = searchEntry.get_text().toLowerCase();
        applicationsList.filterApplications(searchText);
      });

      headerBar.pack_start(searchEntry);

      const expandAllCategoriesButton = new Gtk.Button({
        tooltip_text: 'Expand all categories',
        icon_name: 'view-list-symbolic',
      });
      expandAllCategoriesButton.connect('clicked', () => {
        applicationsList.expandAllCategories();
      });
      headerBar.pack_end(expandAllCategoriesButton);
    }

    return window;
  }

  private showAboutDialog(parent: Gtk.Window): void {
    const aboutDialog = new Adw.AboutWindow({
      transient_for: parent,
      modal: true,
      application_name: 'Obision App Optional Soft',
      application_icon: 'com.obision.app.optional-soft',
      developer_name: 'Jose Francisco Gonzalez',
      version: '1.0.0',
      developers: ['Jose Francisco Gonzalez <jfgs1609@gmail.com>'],
      copyright: `© ${new Date().getFullYear()} Jose Francisco Gonzalez`,
      license_type: Gtk.License.GPL_3_0,
      website: 'https://obision.com',
      issue_url: 'https://github.com/nirlob/obision-app-optional-soft/issues',
    });

    aboutDialog.present();
  }

  private onApplicationClick(app: Application, install: boolean): void {
    if (this.installApplicationsData.find(data => data.application.packageName === app.packageName)) {
      this.installApplicationsData = this.installApplicationsData.filter(data => data.application.packageName !== app.packageName);
    } else {
      this.installApplicationsData.push({ application: app, install });
    }

    this.installButton.set_sensitive(this.installApplicationsData.length > 0);
  }

  private onApplicationsInstalled(): void {
    this.installApplicationsData = [];
    this.installButton.set_sensitive(false);
  }

  public run(argv: string[]): number {
    return this.application.run(argv);
  }
}

// Main function
function main(argv: string[]): number {
  const app = new ObisionAppOptionalSoftApplication();
  return app.run(argv);
}

// Run the application
if (typeof ARGV !== 'undefined') {
  main(ARGV);
} else {
  main([]);
}
