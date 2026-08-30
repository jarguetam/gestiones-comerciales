/** Detox Android API 34. iOS fuera de Gate 4. */
module.exports = {
  testRunner: {
    args: {
      $0: 'jest',
      config: 'e2e/jest.config.js',
    },
    jest: {
      setupTimeout: 120000,
    },
  },
  apps: {
    'android.preview': {
      type: 'android.apk',
      binaryPath: '../../releases/gestiones-campo-preview.apk',
    },
  },
  devices: {
    emulator: {
      type: 'android.emulator',
      device: { avdName: 'Pixel_API_34' },
    },
  },
  configurations: {
    'android.emu.release': {
      device: 'emulator',
      app: 'android.preview',
    },
  },
}
