import { vi } from 'vitest';

// In-memory AsyncStorage mock
const asyncStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn(async (key: string) => store[key] || null),
    setItem: vi.fn(async (key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn(async (key: string) => {
      delete store[key];
    }),
    clear: vi.fn(async () => {
      store = {};
    }),
    getAllKeys: vi.fn(async () => Object.keys(store)),
    multiGet: vi.fn(async (keys: string[]) => keys.map((key) => [key, store[key] || null] as [string, string | null])),
    multiSet: vi.fn(async (pairs: [string, string][]) => {
      pairs.forEach(([key, val]) => {
        store[key] = val;
      });
    }),
    multiRemove: vi.fn(async (keys: string[]) => {
      keys.forEach((key) => {
        delete store[key];
      });
    })
  };
})();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: asyncStorageMock
}));

// react-native-track-player mock
vi.mock('react-native-track-player', () => ({
  default: {
    setupPlayer: vi.fn().mockResolvedValue(true),
    updateOptions: vi.fn().mockResolvedValue(true),
    add: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn().mockResolvedValue(undefined),
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockResolvedValue(undefined),
    skipToNext: vi.fn().mockResolvedValue(undefined),
    skipToPrevious: vi.fn().mockResolvedValue(undefined),
    seekTo: vi.fn().mockResolvedValue(undefined),
    setVolume: vi.fn().mockResolvedValue(undefined),
    registerPlaybackService: vi.fn()
  },
  Capability: {
    Play: 'play',
    Pause: 'pause',
    SkipToNext: 'next',
    SkipToPrevious: 'prev',
    SeekTo: 'seek',
    Stop: 'stop'
  },
  State: {
    None: 'none',
    Ready: 'ready',
    Playing: 'playing',
    Paused: 'paused',
    Stopped: 'stopped',
    Buffering: 'buffering'
  },
  AppKilledPlaybackBehavior: {
    ContinuePlayback: 'continue'
  }
}));

// react-native mock
vi.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    select: (options: Record<string, any>) => options.android || options.default
  },
  Dimensions: {
    get: vi.fn((_dim: string) => ({
      width: 375,
      height: 812,
      scale: 3,
      fontScale: 1
    })),
    set: vi.fn(),
    addEventListener: vi.fn().mockReturnValue({ remove: vi.fn() })
  },
  PixelRatio: {
    get: vi.fn(() => 2),
    getFontScale: vi.fn(() => 1),
    getPixelSizeForLayoutSize: vi.fn((size: number) => size * 2),
    roundToNearestPixel: vi.fn((size: number) => Math.round(size))
  },
  useWindowDimensions: vi.fn(() => ({
    width: 375,
    height: 812,
    scale: 3,
    fontScale: 1
  })),
  StyleSheet: {
    create: (styles: any) => styles
  },
  AppRegistry: {
    registerComponent: vi.fn()
  },
  NativeModules: {},
  StatusBar: {
    setBarStyle: vi.fn()
  },
  Share: {
    share: vi.fn().mockResolvedValue({ action: 'sharedAction' })
  },
  Linking: {
    getInitialURL: vi.fn().mockResolvedValue(null),
    addEventListener: vi.fn().mockReturnValue({ remove: vi.fn() }),
    openURL: vi.fn().mockResolvedValue(true),
    canOpenURL: vi.fn().mockResolvedValue(true)
  }
}));

// react-navigation mock
vi.mock('@react-navigation/native', () => ({
  createNavigationContainerRef: () => ({
    isReady: () => true,
    reset: vi.fn(),
    navigate: vi.fn(),
    goBack: vi.fn(),
    dispatch: vi.fn()
  }),
  useNavigation: () => ({
    navigate: vi.fn(),
    goBack: vi.fn(),
    canGoBack: () => true,
    reset: vi.fn()
  })
}));

// react-native-safe-area-context mock
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: vi.fn(() => ({ top: 44, bottom: 34, left: 0, right: 0 })),
  SafeAreaProvider: ({ children }: any) => children,
  SafeAreaView: ({ children }: any) => children,
  useSafeAreaFrame: vi.fn(() => ({ x: 0, y: 0, width: 375, height: 812 }))
}));

// API client mock
vi.mock('../src/api/client', () => ({
  cancelPendingUserRequests: vi.fn(),
  apiClient: {
    get: vi.fn().mockResolvedValue({ data: { success: true, data: [] } }),
    post: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
    put: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
    delete: vi.fn().mockResolvedValue({ data: { success: true, data: {} } }),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() }
    }
  }
}));
