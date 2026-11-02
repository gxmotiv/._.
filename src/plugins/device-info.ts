import { registerPlugin } from '@capacitor/core';

export interface DeviceInfo {
  model: string;
  manufacturer: string;
  androidId: string;
}

interface DeviceInfoPlugin {
  getDeviceInfo(): Promise<DeviceInfo>;
}

export const DeviceInfo = registerPlugin<DeviceInfoPlugin>('DeviceInfo');
