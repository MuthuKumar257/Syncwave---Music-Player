import { TextStyle, Platform } from 'react-native';

const fontFamily = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'System'
});

const fontMono = Platform.select({
  ios: 'Courier',
  android: 'monospace',
  default: 'monospace'
});

export const Typography: Record<string, TextStyle> = {
  h1: {
    fontFamily,
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.5
  },
  h2: {
    fontFamily,
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.3
  },
  title: {
    fontFamily,
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2
  },
  subtitle: {
    fontFamily,
    fontSize: 15,
    fontWeight: '500'
  },
  body: {
    fontFamily,
    fontSize: 14,
    fontWeight: '400'
  },
  bodyMedium: {
    fontFamily,
    fontSize: 14,
    fontWeight: '500'
  },
  body2: {
    fontFamily,
    fontSize: 13,
    fontWeight: '400'
  },
  small: {
    fontFamily,
    fontSize: 11,
    fontWeight: '500'
  },
  caption: {
    fontFamily,
    fontSize: 10,
    fontWeight: '500'
  },
  mono: {
    fontFamily: fontMono,
    fontSize: 12,
    fontVariant: ['tabular-nums']
  },
  monoSmall: {
    fontFamily: fontMono,
    fontSize: 10,
    fontVariant: ['tabular-nums']
  }
};
