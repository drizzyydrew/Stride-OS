import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';

import ScreenHeader from '../../../src/components/layout/ScreenHeader';
import FeatureTourTarget from '../../../src/components/featureTour/FeatureTourTarget';
import { useFeatureTour } from '../../../src/components/featureTour/FeatureTourProvider';
import { useColors } from '../../../src/theme/useColors';
import { useGearStore, type EquipmentItem } from '../../../src/store/gearStore';
import { useActivityStore } from '../../../src/store/activityStore';
import { deriveShoeMileage, shoeWearReminderCopy } from '../../../src/utils/gear';
import {
  connectToBleEquipment,
  disconnectBleEquipment,
  getBleUnavailableReason,
  startBleEquipmentScan,
  type BleScanHandle,
} from '../../../src/lib/ble/manager';
import { capabilityLabel, type BleDeviceSummary } from '../../../src/lib/ble/deviceClassifier';
import { useLiveSensorStore } from '../../../src/store/liveSensorStore';
import { enabledForCurrentIOSShell, statusLabel, WATCH_PLATFORM_SUPPORT } from '../../../src/lib/wearables/platforms';

export default function GearScreen() {
  const C = useColors();
  useFeatureTour('gear');
  const router = useRouter();
  const shoes = useGearStore(s => s.shoes);
  const equipment = useGearStore(s => s.equipment);
  const defaultShoeId = useGearStore(s => s.defaultShoeId);
  const addShoe = useGearStore(s => s.addShoe);
  const updateShoe = useGearStore(s => s.updateShoe);
  const retireShoe = useGearStore(s => s.retireShoe);
  const setDefaultShoe = useGearStore(s => s.setDefaultShoe);
  const addEquipment = useGearStore(s => s.addEquipment);
  const updateEquipment = useGearStore(s => s.updateEquipment);
  const retireEquipment = useGearStore(s => s.retireEquipment);
  const liveSensorDevices = useLiveSensorStore(s => s.devices);
  const recordBleReading = useLiveSensorStore(s => s.recordBleReading);
  const markDeviceConnected = useLiveSensorStore(s => s.markDeviceConnected);
  const markDeviceDisconnected = useLiveSensorStore(s => s.markDeviceDisconnected);
  const markDeviceError = useLiveSensorStore(s => s.markDeviceError);
  const activities = useActivityStore(s => s.activities);
  const mileage = useMemo(() => deriveShoeMileage(activities, shoes), [activities, shoes]);

  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [equipmentName, setEquipmentName] = useState('');
  const [scanActive, setScanActive] = useState(false);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const [scannedDevices, setScannedDevices] = useState<BleDeviceSummary[]>([]);
  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null);
  const scanHandleRef = useRef<BleScanHandle | null>(null);
  const bleUnavailableReason = getBleUnavailableReason();
  const connectedDevices = useMemo(
    () => Object.values(liveSensorDevices).filter(device => device.connected),
    [liveSensorDevices],
  );

  useEffect(() => () => {
    scanHandleRef.current?.stop();
    scanHandleRef.current = null;
  }, []);

  function saveShoe() {
    if (!brand.trim() || !model.trim()) return;
    addShoe({ brand, model, typicalUse: 'running' });
    setBrand('');
    setModel('');
  }

  async function pickShoeImage(shoeId: string, source: 'camera' | 'library') {
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Photo access needed', source === 'camera'
        ? 'Camera access is needed to add a shoe photo from the camera.'
        : 'Photo library access is needed to choose a shoe photo.');
      return;
    }
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.72 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.72 });
    if (result.canceled || !result.assets[0]?.uri) return;
    updateShoe(shoeId, {
      imageUri: result.assets[0].uri,
      imageSource: source,
      imageUpdatedAt: Date.now(),
    });
  }

  function removeShoeImage(shoeId: string) {
    updateShoe(shoeId, {
      imageUri: undefined,
      imageSource: undefined,
      imageUpdatedAt: undefined,
    });
  }

  function saveEquipment() {
    if (!equipmentName.trim()) return;
    addEquipment({ kind: 'other', name: equipmentName });
    setEquipmentName('');
  }

  async function toggleBleScan() {
    if (scanHandleRef.current) {
      scanHandleRef.current.stop();
      scanHandleRef.current = null;
      setScanActive(false);
      setScanStatus('Bluetooth scan stopped.');
      return;
    }

    setScannedDevices([]);
    setScanStatus('Scanning for heart-rate straps, foot pods, treadmills, trainers, and bike sensors...');
    const handle = await startBleEquipmentScan(
      device => {
        setScannedDevices(current => {
          const existing = current.find(item => item.id === device.id);
          if (existing) {
            return current.map(item => item.id === device.id ? { ...item, ...device } : item);
          }
          return [...current, device].sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999));
        });
      },
      message => {
        setScanStatus(message);
      },
    );
    scanHandleRef.current = handle;
    setScanActive(Boolean(handle));
  }

  async function connectScannedDevice(device: BleDeviceSummary) {
    setConnectingDeviceId(device.id);
    setScanStatus(`Connecting to ${device.name}...`);
    try {
      await connectToBleEquipment(device, {
        onReading: recordBleReading,
        onError: message => {
          markDeviceError(device.id, message);
          setScanStatus(message);
        },
      });
      markDeviceConnected(device);
      const existing = equipment.find(item => item.blePeripheralId === device.id);
      const patch = {
        kind: device.kind,
        name: device.name,
        blePeripheralId: device.id,
        bleServiceUUIDs: device.serviceUUIDs,
        bleCapabilities: device.capabilities,
        bleLastConnectedAt: Date.now(),
        active: true,
      };
      if (existing) {
        updateEquipment(existing.id, patch);
      } else {
        addEquipment(patch);
      }
      setScanStatus(`${device.name} connected. Start a workout to use live metrics.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bluetooth connection failed.';
      markDeviceError(device.id, message);
      setScanStatus(message);
    } finally {
      setConnectingDeviceId(null);
    }
  }

  async function connectStoredEquipment(item: EquipmentItem) {
    if (!item.blePeripheralId) return;
    await connectScannedDevice({
      id: item.blePeripheralId,
      name: item.name,
      serviceUUIDs: item.bleServiceUUIDs ?? [],
      capabilities: item.bleCapabilities ?? [],
      kind: item.kind,
    });
  }

  async function disconnectDevice(deviceId: string) {
    await disconnectBleEquipment(deviceId);
    markDeviceDisconnected(deviceId);
  }

  function capabilityText(device: Pick<BleDeviceSummary, 'capabilities'>): string {
    return device.capabilities.length
      ? device.capabilities.map(capabilityLabel).join(' · ')
      : 'Fitness device';
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.bg }]} edges={['top']}>
      <ScreenHeader eyebrow="GEAR" title="Shoes & Equipment" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <FeatureTourTarget targetId="gear.shoes" style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[s.section, { color: C.textDim }]}>ADD SHOE</Text>
          <View style={s.inputRow}>
            <TextInput
              value={brand}
              onChangeText={setBrand}
              placeholder="Brand"
              placeholderTextColor={C.textDim}
              style={[s.input, { backgroundColor: C.cardAlt, borderColor: C.border, color: C.text }]}
            />
            <TextInput
              value={model}
              onChangeText={setModel}
              placeholder="Model"
              placeholderTextColor={C.textDim}
              style={[s.input, { backgroundColor: C.cardAlt, borderColor: C.border, color: C.text }]}
            />
          </View>
          <TouchableOpacity style={[s.primary, { backgroundColor: C.primary, opacity: brand.trim() && model.trim() ? 1 : 0.55 }]} onPress={saveShoe} disabled={!brand.trim() || !model.trim()}>
            <Text style={[s.primaryText, { color: C.onPrimary }]}>Save Shoe</Text>
          </TouchableOpacity>
        </FeatureTourTarget>

        <Text style={[s.section, { color: C.textDim }]}>VISUAL SHOE CATALOG</Text>
        {shoes.length === 0 ? (
          <FeatureTourTarget targetId="gear.rotation" style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[s.body, { color: C.textMuted }]}>No shoes added yet. Mileage will be derived from linked activities after you assign shoes to runs.</Text>
          </FeatureTourTarget>
        ) : (
          <FeatureTourTarget targetId="gear.rotation">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.shoeCarousel}>
            {shoes.map(shoe => {
              const summary = mileage.find(item => item.shoeId === shoe.id);
              const miles = summary?.miles ?? 0;
              const reminder = shoeWearReminderCopy(shoe, miles);
              const isDefault = defaultShoeId === shoe.id;
              return (
                <View key={shoe.id} style={[s.shoeCard, { backgroundColor: C.card, borderColor: C.border, opacity: shoe.active ? 1 : 0.68 }]}>
                  <View style={[s.shoeImageWrap, { backgroundColor: C.cardAlt }]}>
                    {shoe.imageUri ? (
                      <Image source={{ uri: shoe.imageUri }} style={s.shoeImage} resizeMode="cover" />
                    ) : (
                      <Ionicons name="walk-outline" size={42} color={C.primary} />
                    )}
                  </View>
                  <View style={s.shoeBadgeRow}>
                    <Text style={[s.badge, { color: shoe.active ? C.primary : C.textMuted, borderColor: shoe.active ? C.primary : C.border }]}>
                      {shoe.active ? 'Active' : 'Retired'}
                    </Text>
                    {isDefault ? <Text style={[s.badge, { color: C.text, borderColor: C.border }]}>Primary</Text> : null}
                  </View>
                  <Text style={[s.title, { color: C.text }]} numberOfLines={2}>{shoe.brand} {shoe.model}</Text>
                  <Text style={[s.body, { color: C.textMuted }]}>{miles.toFixed(1)} mi · {summary?.activityCount ?? 0} activities</Text>
                  {reminder ? <Text style={[s.body, { color: C.warning }]}>{reminder}</Text> : null}
                  <View style={s.photoActions}>
                    <TouchableOpacity onPress={() => pickShoeImage(shoe.id, 'library')} style={[s.iconButton, { borderColor: C.border }]} accessibilityRole="button" accessibilityLabel={`Choose photo for ${shoe.brand} ${shoe.model}`}>
                      <Ionicons name="images-outline" size={17} color={C.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => pickShoeImage(shoe.id, 'camera')} style={[s.iconButton, { borderColor: C.border }]} accessibilityRole="button" accessibilityLabel={`Take photo for ${shoe.brand} ${shoe.model}`}>
                      <Ionicons name="camera-outline" size={17} color={C.primary} />
                    </TouchableOpacity>
                    {shoe.imageUri ? (
                      <TouchableOpacity onPress={() => removeShoeImage(shoe.id)} style={[s.iconButton, { borderColor: C.border }]} accessibilityRole="button" accessibilityLabel={`Remove photo for ${shoe.brand} ${shoe.model}`}>
                        <Ionicons name="close-outline" size={17} color={C.textMuted} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <View style={s.actions}>
                    <TouchableOpacity onPress={() => setDefaultShoe(isDefault ? undefined : shoe.id)} accessibilityRole="button">
                      <Text style={[s.link, { color: C.primary }]}>{isDefault ? 'Clear Primary' : 'Set Primary'}</Text>
                    </TouchableOpacity>
                    {shoe.active ? (
                      <TouchableOpacity onPress={() => retireShoe(shoe.id)} accessibilityRole="button">
                        <Text style={[s.link, { color: C.textMuted }]}>Retire</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </ScrollView>
          </FeatureTourTarget>
        )}

        <FeatureTourTarget targetId="gear.equipment" style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[s.section, { color: C.textDim }]}>ADD EQUIPMENT</Text>
          <Text style={[s.body, { color: C.textMuted, marginBottom: 8 }]}>
            Save manual equipment, or pair standard Bluetooth fitness sensors for live workout metrics.
          </Text>
          <TextInput
            value={equipmentName}
            onChangeText={setEquipmentName}
            placeholder="HR strap, bike, treadmill, trainer…"
            placeholderTextColor={C.textDim}
            style={[s.input, { backgroundColor: C.cardAlt, borderColor: C.border, color: C.text }]}
          />
          <TouchableOpacity style={[s.primary, { backgroundColor: C.primary, opacity: equipmentName.trim() ? 1 : 0.55 }]} onPress={saveEquipment} disabled={!equipmentName.trim()}>
            <Text style={[s.primaryText, { color: C.onPrimary }]}>Save Equipment</Text>
          </TouchableOpacity>
          {bleUnavailableReason ? (
            <Text style={[s.body, { color: C.textMuted, marginTop: 8 }]}>{bleUnavailableReason}</Text>
          ) : (
            <>
              <TouchableOpacity
                style={[s.secondary, { borderColor: scanActive ? C.warning : C.primary }]}
                activeOpacity={0.75}
                onPress={toggleBleScan}
                accessibilityRole="button"
                accessibilityLabel={scanActive ? 'Stop Bluetooth equipment scan' : 'Scan for Bluetooth equipment'}
              >
                <Ionicons name={scanActive ? 'stop-circle-outline' : 'bluetooth-outline'} size={17} color={scanActive ? C.warning : C.primary} />
                <Text style={[s.link, { color: scanActive ? C.warning : C.primary }]}>
                  {scanActive ? 'Stop Bluetooth Scan' : 'Scan for Bluetooth Equipment'}
                </Text>
              </TouchableOpacity>
              {scanStatus ? <Text style={[s.body, { color: C.textMuted, marginTop: 8 }]}>{scanStatus}</Text> : null}
            </>
          )}
        </FeatureTourTarget>

        <Text style={[s.section, { color: C.textDim }]}>WATCH + DEVICE SUPPORT</Text>
        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          {WATCH_PLATFORM_SUPPORT.map(platform => {
            const enabled = enabledForCurrentIOSShell(platform);
            return (
              <View key={platform.id} style={[s.platformRow, { borderBottomColor: C.border }]}>
                <View style={[s.platformIcon, { backgroundColor: enabled ? C.primaryDim : C.cardAlt }]}>
                  <Ionicons
                    name={platform.primaryPath === 'bluetooth' ? 'bluetooth-outline' : platform.primaryPath === 'watchos' ? 'watch-outline' : 'cloud-outline'}
                    size={16}
                    color={enabled ? C.primary : C.textMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.platformHeader}>
                    <Text style={[s.platformTitle, { color: C.text }]}>{platform.label}</Text>
                    <Text style={[s.badge, { color: enabled ? C.primary : C.textMuted, borderColor: enabled ? C.primary : C.border }]}>
                      {statusLabel(platform.status)}
                    </Text>
                  </View>
                  <Text style={[s.body, { color: C.textMuted }]}>{platform.liveMetrics.join(' · ')}</Text>
                  <Text style={[s.platformNeed, { color: C.textDim }]}>{platform.setupNeed}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {!bleUnavailableReason && connectedDevices.length ? (
          <>
            <Text style={[s.section, { color: C.textDim }]}>CONNECTED SENSORS</Text>
            {connectedDevices.map(device => (
              <View key={device.id} style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
                <View style={s.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.title, { color: C.text }]}>{device.name}</Text>
                    <Text style={[s.body, { color: C.textMuted }]}>{capabilityText(device)} · live</Text>
                    {device.lastError ? <Text style={[s.body, { color: C.warning }]}>{device.lastError}</Text> : null}
                  </View>
                  <TouchableOpacity onPress={() => disconnectDevice(device.id)} accessibilityRole="button">
                    <Text style={[s.link, { color: C.textMuted }]}>Disconnect</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        ) : null}

        {!bleUnavailableReason && scannedDevices.length ? (
          <>
            <Text style={[s.section, { color: C.textDim }]}>FOUND NEARBY</Text>
            {scannedDevices.map(device => {
              const connected = liveSensorDevices[device.id]?.connected;
              const connecting = connectingDeviceId === device.id;
              return (
                <View key={device.id} style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
                  <View style={s.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.title, { color: C.text }]}>{device.name}</Text>
                      <Text style={[s.body, { color: C.textMuted }]}>
                        {capabilityText(device)}{typeof device.rssi === 'number' ? ` · signal ${device.rssi}` : ''}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => connected ? disconnectDevice(device.id) : connectScannedDevice(device)}
                      disabled={connecting}
                      accessibilityRole="button"
                    >
                      <Text style={[s.link, { color: connecting ? C.textDim : C.primary }]}>
                        {connecting ? 'Connecting' : connected ? 'Disconnect' : 'Connect'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </>
        ) : null}

        <Text style={[s.section, { color: C.textDim }]}>EQUIPMENT</Text>
        {equipment.length === 0 ? (
        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[s.body, { color: C.textMuted }]}>Manual equipment and paired Bluetooth sensors will appear here.</Text>
        </View>
        ) : equipment.map(item => (
          <View key={item.id} style={[s.card, { backgroundColor: C.card, borderColor: C.border, opacity: item.active ? 1 : 0.6 }]}>
            <View style={s.row}>
              <View>
                <Text style={[s.title, { color: C.text }]}>{item.name}</Text>
                <Text style={[s.body, { color: C.textMuted }]}>
                  {item.kind.replaceAll('_', ' ')}
                  {item.bleCapabilities?.length ? ` · ${item.bleCapabilities.map(capabilityLabel).join(' · ')}` : ''}
                  {item.blePeripheralId ? ' · paired' : ' · manual fallback ready'}
                </Text>
              </View>
              <View style={s.equipmentActions}>
                {item.blePeripheralId ? (
                  <TouchableOpacity
                    onPress={() => liveSensorDevices[item.blePeripheralId!]?.connected ? disconnectDevice(item.blePeripheralId!) : connectStoredEquipment(item)}
                    accessibilityRole="button"
                  >
                    <Text style={[s.link, { color: C.primary }]}>
                      {liveSensorDevices[item.blePeripheralId]?.connected ? 'Disconnect' : 'Connect'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
                {item.active ? <TouchableOpacity onPress={() => retireEquipment(item.id)}><Text style={[s.link, { color: C.textMuted }]}>Retire</Text></TouchableOpacity> : null}
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: 18, paddingBottom: 120 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  inputRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 13 },
  primary: { minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  secondary: { minHeight: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 10, flexDirection: 'row', gap: 8 },
  primaryText: { fontSize: 13, fontWeight: '900' },
  section: { fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 8 },
  title: { fontSize: 16, fontWeight: '900' },
  body: { fontSize: 12, lineHeight: 18, marginTop: 3 },
  actions: { flexDirection: 'row', gap: 16, marginTop: 10 },
  equipmentActions: { alignItems: 'flex-end', gap: 10 },
  link: { fontSize: 12, fontWeight: '900' },
  shoeCarousel: { gap: 12, paddingRight: 18, paddingBottom: 12 },
  shoeCard: { width: 228, borderWidth: 1, borderRadius: 16, padding: 14 },
  shoeImageWrap: { height: 132, borderRadius: 13, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  shoeImage: { width: '100%', height: '100%' },
  shoeBadgeRow: { flexDirection: 'row', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, fontSize: 10, fontWeight: '900' },
  photoActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  iconButton: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  platformRow: { flexDirection: 'row', gap: 10, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  platformIcon: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  platformHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  platformTitle: { fontSize: 13, fontWeight: '900', flex: 1 },
  platformNeed: { fontSize: 11, lineHeight: 15, marginTop: 4 },
});
