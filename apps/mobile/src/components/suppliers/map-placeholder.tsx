import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';

const MAP_BG = '#1E2B24';
const GRID_LINE = 'rgba(255,255,255,0.06)';

// TODO: replace with a real map (react-native-maps or similar) once an API key
// and native config are in place — this is a static illustrative placeholder.
export function MapPlaceholder() {
  return (
    <View style={styles.container}>
      {[0.25, 0.5, 0.75].map((position) => (
        <View key={`h-${position}`} style={[styles.gridLineH, { top: `${position * 100}%` }]} />
      ))}
      {[0.2, 0.45, 0.7, 0.9].map((position) => (
        <View key={`v-${position}`} style={[styles.gridLineV, { left: `${position * 100}%` }]} />
      ))}

      <View style={styles.locationDot}>
        <View style={styles.locationDotInner} />
      </View>

      <Feather name="map-pin" size={26} color="#8C8577" style={[styles.pin, styles.pinTopRight]} />
      <Feather
        name="map-pin"
        size={26}
        color="#8C8577"
        style={[styles.pin, styles.pinBottomRight]}
      />
      <Feather
        name="map-pin"
        size={32}
        color="#E29D3A"
        style={[styles.pin, styles.pinHighlighted]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 220,
    borderRadius: Spacing.four,
    backgroundColor: MAP_BG,
    overflow: 'hidden',
  },
  gridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: GRID_LINE,
  },
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth * 2,
    backgroundColor: GRID_LINE,
  },
  locationDot: {
    position: 'absolute',
    left: '48%',
    top: '50%',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(60,140,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3C8CFF',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  pin: {
    position: 'absolute',
  },
  pinTopRight: {
    top: '22%',
    right: '20%',
  },
  pinBottomRight: {
    bottom: '18%',
    right: '30%',
  },
  pinHighlighted: {
    left: '24%',
    top: '38%',
  },
});
