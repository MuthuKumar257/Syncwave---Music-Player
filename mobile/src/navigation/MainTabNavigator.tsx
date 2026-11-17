import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainTabParamList, RootStackParamList } from './types';
import { HomeScreen } from '../screens/home/HomeScreen';
import { SearchScreen } from '../screens/search/SearchScreen';
import { LibraryScreen } from '../screens/library/LibraryScreen';
import { SchedulerScreen } from '../screens/scheduler/SchedulerScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { MiniPlayer } from '../components/player/MiniPlayer';
import { Colors } from '../theme/colors';
import { HomeIcon, DiscoverIcon, LibraryIcon, SchedulerIcon, ProfileIcon } from '../components/common/Icon';

const Tab = createBottomTabNavigator<MainTabParamList>();

const VISIBLE_TABS: Array<{
  name: keyof MainTabParamList;
  label: string;
  iconComponent: React.FC<{ size?: number; color?: string; strokeWidth?: number }>;
}> = [
  { name: 'HomeTab', label: 'Home', iconComponent: HomeIcon },
  { name: 'DiscoverTab', label: 'Discover', iconComponent: DiscoverIcon },
  { name: 'LibraryTab', label: 'Library', iconComponent: LibraryIcon },
  { name: 'SchedulerTab', label: 'Scheduler', iconComponent: SchedulerIcon },
  { name: 'ProfileTab', label: 'Profile', iconComponent: ProfileIcon }
];

const CustomTabBar: React.FC<BottomTabBarProps> = ({ state, navigation }) => {
  const insets = useSafeAreaInsets();
  const rootNav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // Find the current active tab index among VISIBLE_TABS
  const currentRoute = state.routes[state.index];
  const activeTabName = currentRoute?.name;

  return (
    <View style={styles.persistentContainer}>
      {/* 1. Persistent Compact Mini Player (Fixed directly above Bottom Navigation) */}
      <MiniPlayer
        onPress={() => rootNav.navigate('FullPlayer')}
        onOpenQueue={() => rootNav.navigate('Queue')}
      />

      {/* 2. Five-Item Bottom Navigation (Fixed at bottom, respects safe-area insets) */}
      <View
        style={[
          styles.tabBar,
          {
            paddingBottom: Math.max(insets.bottom, 6),
            height: 52 + Math.max(insets.bottom, 6)
          }
        ]}
      >
        {VISIBLE_TABS.map((tab) => {
          const isActive =
            activeTabName === tab.name ||
            (tab.name === 'DiscoverTab' && activeTabName === 'SearchTab');

          const onPress = () => {
            const isCurrent = activeTabName === tab.name;
            if (!isCurrent) {
              navigation.navigate(tab.name);
            }
          };

          const IconComp = tab.iconComponent;
          const iconColor = isActive ? Colors.accent : Colors.textTertiary;

          return (
            <TouchableOpacity
              key={tab.name}
              accessibilityRole="button"
              accessibilityState={isActive ? { selected: true } : {}}
              accessibilityLabel={tab.label}
              onPress={onPress}
              style={styles.tabItem}
              activeOpacity={0.7}
            >
              <View style={styles.tabIconBox}>
                <IconComp size={18} color={iconColor} strokeWidth={isActive ? 2 : 1.5} />
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: isActive ? Colors.accent : Colors.textTertiary,
                    fontWeight: isActive ? '600' : '400'
                  }
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

export const MainTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false
      }}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen} />
      <Tab.Screen name="DiscoverTab" component={SearchScreen} />
      <Tab.Screen name="LibraryTab" component={LibraryScreen} />
      <Tab.Screen name="SchedulerTab" component={SchedulerScreen} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} />
      {/* Backwards-compatible route aliases */}
      <Tab.Screen
        name="SearchTab"
        component={SearchScreen}
        options={{ tabBarItemStyle: { display: 'none' } }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  persistentContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 100
  },
  tabBar: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 6,
    paddingHorizontal: 4
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingVertical: 2
  },
  tabIconBox: {
    width: 22,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3
  },
  tabLabel: {
    fontSize: 10,
    letterSpacing: 0.1
  }
});
