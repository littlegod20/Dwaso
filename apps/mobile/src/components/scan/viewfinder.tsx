import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const FRAME_SIZE = 300;
const CORNER_SIZE = 32;
const CORNER_THICKNESS = 4;

type ViewfinderProps = {
  label?: ReactNode;
  filled?: boolean;
};

export function Viewfinder({ label, filled }: ViewfinderProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      {label}
      <View style={styles.frameWrapper}>
        <View
          style={[
            styles.innerRect,
            { backgroundColor: filled ? theme.backgroundSelected : theme.backgroundElement },
          ]}
        />
        <Corner style={styles.cornerTopLeft} color={theme.primary} />
        <Corner style={styles.cornerTopRight} color={theme.primary} />
        <Corner style={styles.cornerBottomLeft} color={theme.primary} />
        <Corner style={styles.cornerBottomRight} color={theme.primary} />
      </View>
    </View>
  );
}

function Corner({ style, color }: { style: object; color: string }) {
  return <View style={[styles.corner, { borderColor: color }, style]} />;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.three,
  },
  frameWrapper: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
  },
  innerRect: {
    ...StyleSheet.absoluteFill,
    margin: CORNER_THICKNESS,
    borderRadius: Spacing.three,
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderWidth: CORNER_THICKNESS,
    borderRadius: Spacing.two,
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
});
