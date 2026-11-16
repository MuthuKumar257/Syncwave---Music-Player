import { LinkingOptions } from '@react-navigation/native';
import { Linking } from 'react-native';
import { RootStackParamList } from './types';

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    'https://syncwave.app',
    'https://www.syncwave.app',
    'http://syncwave.app',
    'syncwave://'
  ],
  config: {
    screens: {
      SongDetail: {
        path: 'song/:songId',
        parse: {
          songId: (id: string) => decodeURIComponent(id)
        }
      },
      PlaylistDetail: {
        path: 'playlist/:playlistId',
        parse: {
          playlistId: (id: string) => decodeURIComponent(id)
        }
      },
      MainTabs: {
        screens: {
          HomeTab: 'home',
          SearchTab: {
            path: 'artist/:artistId'
          },
          LibraryTab: {
            path: 'playlist/:playlistId'
          },
          DownloadsTab: 'downloads',
          ProfileTab: 'profile'
        }
      },
      FullPlayer: 'player',
      Scheduler: 'scheduler',
      Login: 'login',
      SignUp: 'signup'
    }
  },
  async getInitialURL() {
    const url = await Linking.getInitialURL();
    return url;
  },
  subscribe(listener) {
    const onReceiveURL = ({ url }: { url: string }) => listener(url);
    const subscription = Linking.addEventListener('url', onReceiveURL);
    return () => {
      subscription.remove();
    };
  }
};
