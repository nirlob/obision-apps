import Gio from '@girs/gio-2.0';
import Adw from '@girs/adw-1';
import { LoggerService } from './logger-service';

export class SettingsService {
  static _instance: SettingsService;
  private logger = LoggerService.instance;
  private settings: Gio.Settings;

  private constructor() {
    this.settings = new Gio.Settings({ schema_id: 'com.obision.app.optional-soft' });
  }

  public static get instance(): SettingsService {
    if (!SettingsService._instance) {
      SettingsService._instance = new SettingsService();
    }
    return SettingsService._instance;
  }

  /**
   * Save the current window state (size and maximized state)
   */
  public saveWindowState(window: Adw.ApplicationWindow): void {
    const surface = window.get_surface();
    if (!surface) {
      this.logger.warning('Cannot save window state: surface not available');
      return;
    }

    // Save maximized state
    const isMaximized = window.is_maximized();
    this.settings.set_boolean('window-maximized', isMaximized);
    this.logger.debug('Saved window maximized state', { maximized: isMaximized });

    // Only save size and position if not maximized
    if (!isMaximized) {
      const width = window.get_width();
      const height = window.get_height();
      
      this.settings.set_int('window-width', width);
      this.settings.set_int('window-height', height);
      this.logger.debug('Saved window size', { width, height });
    }

    this.logger.info('Window state saved successfully');
  }

  /**
   * Restore the window state (size and maximized state)
   */
  public restoreWindowState(window: Adw.ApplicationWindow): void {
    const width = this.settings.get_int('window-width');
    const height = this.settings.get_int('window-height');
    const isMaximized = this.settings.get_boolean('window-maximized');

    // Restore size
    if (width > 0 && height > 0) {
      window.set_default_size(width, height);
      this.logger.debug('Restored window size', { width, height });
    } else {
      // Use default size
      window.set_default_size(1000, 800);
      this.logger.debug('Using default window size', { width: 1000, height: 800 });
    }

    // Restore maximized state
    if (isMaximized) {
      window.maximize();
      this.logger.debug('Restored window maximized state');
    }

    this.logger.info('Window state restored successfully');
  }

  /**
   * Get a boolean setting
   */
  public getBoolean(key: string): boolean {
    return this.settings.get_boolean(key);
  }

  /**
   * Set a boolean setting
   */
  public setBoolean(key: string, value: boolean): void {
    this.settings.set_boolean(key, value);
  }

  /**
   * Get an integer setting
   */
  public getInt(key: string): number {
    return this.settings.get_int(key);
  }

  /**
   * Set an integer setting
   */
  public setInt(key: string, value: number): void {
    this.settings.set_int(key, value);
  }

  /**
   * Get a string setting
   */
  public getString(key: string): string {
    return this.settings.get_string(key);
  }

  /**
   * Set a string setting
   */
  public setString(key: string, value: string): void {
    this.settings.set_string(key, value);
  }
}
