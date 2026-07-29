import { useMemo, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';

import ScreenHeader from '../../../src/components/layout/ScreenHeader';
import { useColors } from '../../../src/theme/useColors';
import { useGearStore } from '../../../src/store/gearStore';
import { useActivityStore } from '../../../src/store/activityStore';
import { deriveShoeMileage, shoeWearReminderCopy } from '../../../src/utils/gear';
import { getBleUnavailableReason } from '../../../src/lib/ble/manager';

export default function GearScreen() {
  const C = useColors();
  const router = useRouter();
  const shoes = useGearStore(s => s.shoes);
  const equipment = useGearStore(s => s.equipment);
  const defaultShoeId = useGearStore(s => s.defaultShoeId);
  const addShoe = useGearStore(s => s.addShoe);
  const updateShoe = useGearStore(s => s.updateShoe);
  const retireShoe = useGearStore(s => s.retireShoe);
  const setDefaultShoe = useGearStore(s => s.setDefaultShoe);
  const addEquipment = useGearStore(s => s.addEquipment);
  const retireEquipment = useGearStore(s => s.retireEquipment);
  const activities = useActivityStore(s => s.activities);
  const mileage = useMemo(() => deriveShoeMileage(activities, shoes), [activities, shoes]);

  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [equipmentName, setEquipmentName] = useState('');
  const bleUnavailableReason = getBleUnavailableReason();

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

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.bg }]} edges={['top']}>
      <ScreenHeader eyebrow="GEAR" title="Shoes & Equipment" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
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
        </View>

        <Text style={[s.section, { color: C.textDim }]}>VISUAL SHOE CATALOG</Text>
        {shoes.length === 0 ? (
          <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[s.body, { color: C.textMuted }]}>No shoes added yet. Mileage will be derived from linked activities after you assign shoes to runs.</Text>
          </View>
        ) : (
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
        )}

        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[s.section, { color: C.textDim }]}>ADD EQUIPMENT</Text>
          <Text style={[s.body, { color: C.textMuted, marginBottom: 8 }]}>
            Pairing supports BLE heart-rate straps, treadmills/trainers, foot pods, cycling speed/cadence sensors, and power meters on device. Manual fallback remains available.
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
            <TouchableOpacity style={[s.secondary, { borderColor: C.primary }]} activeOpacity={0.75}>
              <Ionicons name="bluetooth-outline" size={17} color={C.primary} />
              <Text style={[s.link, { color: C.primary }]}>Scan for Bluetooth Equipment</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={[s.section, { color: C.textDim }]}>EQUIPMENT</Text>
        {equipment.length === 0 ? (
          <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[s.body, { color: C.textMuted }]}>Equipment will support pairing and source preferences in the Bluetooth phase. Manual fallback stays available.</Text>
          </View>
        ) : equipment.map(item => (
          <View key={item.id} style={[s.card, { backgroundColor: C.card, borderColor: C.border, opacity: item.active ? 1 : 0.6 }]}>
            <View style={s.row}>
              <View>
                <Text style={[s.title, { color: C.text }]}>{item.name}</Text>
                <Text style={[s.body, { color: C.textMuted }]}>
                  {item.kind.replaceAll('_', ' ')}{item.blePeripheralId ? ` · paired ${item.blePeripheralId}` : ' · manual fallback ready'}
                </Text>
              </View>
              {item.active ? <TouchableOpacity onPress={() => retireEquipment(item.id)}><Text style={[s.link, { color: C.textMuted }]}>Retire</Text></TouchableOpacity> : null}
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
  link: { fontSize: 12, fontWeight: '900' },
  shoeCarousel: { gap: 12, paddingRight: 18, paddingBottom: 12 },
  shoeCard: { width: 228, borderWidth: 1, borderRadius: 16, padding: 14 },
  shoeImageWrap: { height: 132, borderRadius: 13, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  shoeImage: { width: '100%', height: '100%' },
  shoeBadgeRow: { flexDirection: 'row', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, fontSize: 10, fontWeight: '900' },
  photoActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  iconButton: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
