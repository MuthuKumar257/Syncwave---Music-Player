import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useRecommendationStore } from '../../store/useRecommendationStore';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, Radius } from '../../theme/spacing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsiveMetrics } from '../../utils/responsive';

interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  subtitle: string;
}

const LANGUAGES: LanguageOption[] = [
  { code: 'Tamil', name: 'Tamil', nativeName: 'தமிழ்', subtitle: 'Kollywood & Folk Melodies' },
  { code: 'Telugu', name: 'Telugu', nativeName: 'తెలుగు', subtitle: 'Tollywood Hits & Beats' },
  { code: 'Malayalam', name: 'Malayalam', nativeName: 'മലയാളം', subtitle: 'Mollywood Acoustic & Indie' },
  { code: 'Kannada', name: 'Kannada', nativeName: 'ಕನ್ನಡ', subtitle: 'Sandalwood & Heavy Anthems' },
  { code: 'Hindi', name: 'Hindi', nativeName: 'हिन्दी', subtitle: 'Bollywood & Sufi Ballads' },
  { code: 'English', name: 'English', nativeName: 'English', subtitle: 'Pop, R&B & Global Soundtracks' },
  { code: 'Punjabi', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', subtitle: 'Bhangra, Desi Hip-hop' },
  { code: 'Bengali', name: 'Bengali', nativeName: 'বাংলা', subtitle: 'Rabindra Sangeet & Folk' },
  { code: 'Marathi', name: 'Marathi', nativeName: 'मराठी', subtitle: 'Natya Sangeet & Modern Hits' }
];

export const LanguageSelectionScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { selectedLanguages, toggleLanguage, skipOnboarding } = useRecommendationStore();
  const insets = useSafeAreaInsets();
  const { isSmallPhone } = useResponsiveMetrics();

  const handleContinue = () => {
    navigation.navigate('MusicPreferences');
  };

  const handleSkip = async () => {
    await skipOnboarding();
    navigation.replace('MainTabs');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.stepBadge}>
          <Text style={styles.stepText}>Step 1 of 2</Text>
        </View>
        <Text style={styles.title}>Select Your Languages</Text>
        <Text style={styles.subtitle}>
          Choose one or more languages to personalize your daily soundtrack feeds
        </Text>
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Language Grid */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.grid}>
          {LANGUAGES.map((lang) => {
            const isSelected = selectedLanguages.includes(lang.code);
            return (
              <TouchableOpacity
                key={lang.code}
                style={[styles.card, isSelected && styles.selectedCard]}
                onPress={() => toggleLanguage(lang.code)}
                activeOpacity={0.7}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.langName}>{lang.name}</Text>
                  <View style={[styles.checkbox, isSelected && styles.checkedBox]}>
                    {isSelected ? <Text style={styles.checkmark}>✓</Text> : null}
                  </View>
                </View>
                <Text style={styles.nativeText}>{lang.nativeName}</Text>
                <Text style={styles.cardSubtitle} numberOfLines={1}>
                  {lang.subtitle}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Fixed Bottom Action Bar */}
      <View
        style={[
          styles.bottomBar,
          {
            paddingBottom: Math.max(insets.bottom, Spacing.md),
            paddingHorizontal: isSmallPhone ? Spacing.md : Spacing.xl
          }
        ]}
      >
        <Text style={[styles.selectionCount, { flexShrink: 1, marginRight: 8 }]} numberOfLines={1}>
          {selectedLanguages.length} {selectedLanguages.length === 1 ? 'language' : 'languages'} selected
        </Text>
        <TouchableOpacity
          style={[
            styles.continueButton,
            isSmallPhone && { paddingHorizontal: Spacing.md },
            selectedLanguages.length === 0 && styles.disabledButton
          ]}
          onPress={handleContinue}
          disabled={selectedLanguages.length === 0}
          activeOpacity={0.8}
        >
          <Text style={[styles.continueButtonText, isSmallPhone && { fontSize: 13 }]}>
            {isSmallPhone ? 'Continue →' : 'Continue to Artists →'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline,
    position: 'relative'
  },
  stepBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.tag,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.hairline
  },
  stepText: {
    ...Typography.monoSmall,
    color: Colors.textSecondary
  },
  title: {
    ...Typography.h1,
    color: Colors.textPrimary
  },
  subtitle: {
    ...Typography.body2,
    color: Colors.textTertiary,
    marginTop: 4
  },
  skipButton: {
    position: 'absolute',
    top: Spacing.lg,
    right: Spacing.xl,
    padding: Spacing.xs
  },
  skipText: {
    ...Typography.body2,
    color: Colors.textTertiary
  },
  scrollContent: {
    padding: Spacing.lg
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },
  card: {
    width: '48%',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radius.card,
    padding: Spacing.md,
    marginBottom: Spacing.md
  },
  selectedCard: {
    backgroundColor: Colors.surfaceRaised,
    borderColor: Colors.accent
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  langName: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    fontWeight: '600'
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: Radius.circle,
    borderWidth: 1,
    borderColor: Colors.hairlineLight,
    justifyContent: 'center',
    alignItems: 'center'
  },
  checkedBox: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent
  },
  checkmark: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000000'
  },
  nativeText: {
    ...Typography.subtitle,
    color: Colors.accent,
    marginTop: 6
  },
  cardSubtitle: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 4
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.hairline,
    backgroundColor: Colors.surface
  },
  selectionCount: {
    ...Typography.caption,
    fontFamily: Typography.monoSmall.fontFamily,
    color: Colors.textTertiary
  },
  continueButton: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md
  },
  disabledButton: {
    opacity: 0.5
  },
  continueButtonText: {
    ...Typography.bodyMedium,
    fontWeight: '600',
    color: '#000000'
  }
});
