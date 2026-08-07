import { useRef, useState } from 'react';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/common/app-button';
import { ScanTopBar } from '@/components/scan/scan-top-bar';
import { Viewfinder } from '@/components/scan/viewfinder';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { runCascade } from '@/lib/scan/cascade';
import { useScanStore } from '@/stores/scan';

export default function ScanIndexScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();

  const camera = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const resolving = useRef(false);

  const setCandidate = useScanStore((state) => state.setCandidate);
  const setCapturedUri = useScanStore((state) => state.setCapturedUri);
  const torch = useScanStore((state) => state.torch);

  const resolve = async (barcode: string | null, imageBase64: string | null) => {
    // A guard, not a debounce. The barcode callback fires on every frame that
    // contains a code, and without this a single product on the counter would
    // trigger dozens of vision calls.
    if (resolving.current) return;
    resolving.current = true;
    setBusy(true);

    try {
      const match = await runCascade({ barcode, imageBase64 });
      setCandidate(match);
      router.push('/scan/recognized');
    } finally {
      setBusy(false);
      resolving.current = false;
    }
  };

  const onBarcode = (result: BarcodeScanningResult) => {
    void resolve(result.data, null);
  };

  const capture = async () => {
    if (!ready || !camera.current) return;

    // Quality is deliberately low. The image exists to be recognised, not
    // admired, and a trader on a metered connection should not pay for pixels
    // the model does not use.
    const photo = await camera.current.takePictureAsync({ base64: true, quality: 0.4 });
    if (!photo) return;

    setCapturedUri(photo.uri);
    await resolve(null, photo.base64 ?? null);
  };

  if (!permission) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator color={theme.primary} />
      </ThemedView>
    );
  }

  if (!permission.granted) {
    return (
      <ThemedView style={[styles.centered, { padding: Spacing.four }]}>
        <ThemedText type="subtitle" style={styles.permissionTitle}>
          Camera access needed
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary" style={styles.permissionBody}>
          Scanning is how you log a sale without typing. The camera is only used while this screen
          is open.
        </ThemedText>
        <AppButton label="Allow camera" onPress={requestPermission} />
        <AppButton label="Not now" variant="secondary" onPress={() => router.back()} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <CameraView
        ref={camera}
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        onCameraReady={() => setReady(true)}
        onBarcodeScanned={busy ? undefined : onBarcode}
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'qr'],
        }}
      />

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={{ paddingTop: insets.top + Spacing.two }}>
          <ScanTopBar />
        </View>

        <View style={styles.frameArea} pointerEvents="none">
          <Viewfinder />
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.four }]}>
          <View style={[styles.captionPill, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="small">
              {busy ? 'Identifying…' : 'Point at a barcode, or tap to photograph the item'}
            </ThemedText>
          </View>

          <Pressable
            onPress={capture}
            disabled={busy || !ready}
            style={[styles.shutter, { borderColor: theme.primaryText }]}
          >
            {busy ? (
              <ActivityIndicator color={theme.primaryText} />
            ) : (
              <View style={[styles.shutterInner, { backgroundColor: theme.primaryText }]} />
            )}
          </Pressable>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  permissionTitle: {
    textAlign: 'center',
  },
  permissionBody: {
    textAlign: 'center',
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  frameArea: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    alignItems: 'center',
    gap: Spacing.four,
  },
  captionPill: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.five,
  },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
});
