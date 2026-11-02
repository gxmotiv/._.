import { registerPlugin } from '@capacitor/core';

export interface RobloxLauncherPlugin {
  isInstalled(): Promise<{ installed: boolean }>;
  openApp(): Promise<void>;
  openPlace(options: { placeId: string }): Promise<void>;
}

export interface SafExportPlugin {
  exportText(options: { fileName: string; content: string }): Promise<{ uri: string }>;
}

export const RobloxLauncher = registerPlugin<RobloxLauncherPlugin>('RobloxLauncher');
export const SafExport = registerPlugin<SafExportPlugin>('SafExport');
