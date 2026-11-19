import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ArtistItem } from '../../api/types';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, Radius } from '../../theme/spacing';
import { ArtistAvatar } from '../common/ArtistAvatar';

interface ArtistCardProps {
  artist: ArtistItem;
  isSelected: boolean;
  onPress: () => void;
}

export const ArtistCard: React.FC<ArtistCardProps> = ({ artist, isSelected, onPress }) => {
  return (
    <TouchableOpacity
      style={[styles.card, isSelected && styles.selectedCard]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.imageWrapper}>
        <ArtistAvatar
          name={artist.name}
          imageUrl={artist.imageUrl}
          size={60}
          isSelected={isSelected}
          showBadge={true}
        />
      </View>

      <Text style={styles.name} numberOfLines={1}>
        {artist.name}
      </Text>

      <Text style={styles.roleTitle} numberOfLines={1}>
        {artist.roleTitle || (artist.role === 'DIRECTOR' ? 'Music Director' : 'Playback Singer')}
      </Text>

      {artist.languages && artist.languages.length > 0 ? (
        <Text style={styles.languagesText} numberOfLines={1}>
          {artist.languages.slice(0, 3).join(' • ')}
        </Text>
      ) : null}

      <Text style={styles.knownFor} numberOfLines={1}>
        {artist.knownFor?.slice(0, 2).join(', ') || ''}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radius.card,
    padding: Spacing.md,
    margin: Spacing.xs,
    minWidth: 100
  },
  selectedCard: {
    backgroundColor: Colors.surfaceRaised,
    borderColor: Colors.accent
  },
  imageWrapper: {
    position: 'relative',
    width: 60,
    height: 60,
    borderRadius: Radius.control,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceRaised,
    marginBottom: Spacing.sm
  },
  avatar: {
    width: '100%',
    height: '100%'
  },
  checkBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: Radius.circle,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center'
  },
  checkText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000000'
  },
  name: {
    ...Typography.bodyMedium,
    fontSize: 12,
    color: Colors.textPrimary,
    textAlign: 'center'
  },
  roleTitle: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.accent,
    textAlign: 'center',
    marginTop: 1
  },
  languagesText: {
    ...Typography.caption,
    fontSize: 9,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 1
  },
  knownFor: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: 2
  }
});
