import { registerPlugin } from '@capacitor/core';

export interface OverlayPlugin {
  checkPermission(): Promise<{ granted: boolean }>;
  requestPermission(): Promise<void>;
  showOverlay(): Promise<void>;
  hideOverlay(): Promise<void>;
}

export const Overlay = registerPlugin<OverlayPlugin>('Overlay');
