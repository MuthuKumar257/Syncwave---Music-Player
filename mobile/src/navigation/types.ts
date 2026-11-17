import { MovieSoundtrack } from '../api/types';

export type RootStackParamList = {
  LanguageSelection: undefined;
  MusicPreferences: undefined;
  MainTabs: undefined;
  FullPlayer: undefined;
  Queue: undefined;
  MovieDetail: { movie: MovieSoundtrack };
  SongDetail: { songId: string; autoPlay?: boolean };
  PlaylistDetail: { playlistId: string };
  Scheduler: undefined;
  Settings: undefined;
  Login: undefined;
  SignUp: undefined;
};

export type MainTabParamList = {
  HomeTab: undefined;
  DiscoverTab: undefined;
  LibraryTab: undefined;
  SchedulerTab: undefined;
  ProfileTab: undefined;
  SearchTab?: undefined;
  DownloadsTab?: undefined;
};
