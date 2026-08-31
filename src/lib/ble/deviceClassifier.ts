import type { EquipmentItem } from '../../store/gearStore';
import { BLE_SERVICE_UUIDS } from './profiles/constants';
import { hasBleService } from './uuid';

export type BleEquipmentCapability =
  | 'heart_rate'
  | 'running_speed_cadence'
  | 'cycling_speed_cadence'
  | 'cycling_power'
  | 'fitness_machine';

export type BleDeviceSummary = {
  id: string;
  name: string;
  localName?: string | null;
  rssi?: number | null;
  serviceUUIDs: string[];
  kind: EquipmentItem['kind'];
  capabilities: BleEquipmentCapability[];
};

export function classifyBleEquipment(input: {
  id: string;
  name?: string | null;
  localName?: string | null;
  rssi?: number | null;
  serviceUUIDs?: readonly string[] | null;
}): BleDeviceSummary {
  const name = (input.name || input.localName || 'Bluetooth equipment').trim();
  const serviceUUIDs = [...(input.serviceUUIDs ?? [])];
  const capabilities: BleEquipmentCapability[] = [];

  if (hasBleService(serviceUUIDs, BLE_SERVICE_UUIDS.heartRate)) capabilities.push('heart_rate');
  if (hasBleService(serviceUUIDs, BLE_SERVICE_UUIDS.runningSpeedCadence)) capabilities.push('running_speed_cadence');
  if (hasBleService(serviceUUIDs, BLE_SERVICE_UUIDS.cyclingSpeedCadence)) capabilities.push('cycling_speed_cadence');
  if (hasBleService(serviceUUIDs, BLE_SERVICE_UUIDS.cyclingPower)) capabilities.push('cycling_power');
  if (hasBleService(serviceUUIDs, BLE_SERVICE_UUIDS.fitnessMachine)) capabilities.push('fitness_machine');

  return {
    id: input.id,
    name,
    localName: input.localName,
    rssi: input.rssi,
    serviceUUIDs,
    capabilities,
    kind: inferEquipmentKind(name, capabilities),
  };
}

export function inferEquipmentKind(
  name: string,
  capabilities: readonly BleEquipmentCapability[],
): EquipmentItem['kind'] {
  const lowerName = name.toLowerCase();
  if (capabilities.includes('running_speed_cadence')) return 'foot_pod';
  if (capabilities.includes('cycling_power')) return 'power_meter';
  if (capabilities.includes('cycling_speed_cadence')) return 'cadence_sensor';
  if (capabilities.includes('fitness_machine')) {
    if (lowerName.includes('tread') || lowerName.includes('run')) return 'treadmill';
    if (lowerName.includes('bike') || lowerName.includes('cycle') || lowerName.includes('trainer')) return 'trainer';
    return 'trainer';
  }
  if (capabilities.includes('heart_rate')) return 'hr_strap';
  return 'other';
}

export function capabilityLabel(capability: BleEquipmentCapability): string {
  switch (capability) {
  case 'heart_rate': return 'Heart rate';
  case 'running_speed_cadence': return 'Run speed/cadence';
  case 'cycling_speed_cadence': return 'Bike speed/cadence';
  case 'cycling_power': return 'Cycling power';
  case 'fitness_machine': return 'Fitness machine';
  }
}
