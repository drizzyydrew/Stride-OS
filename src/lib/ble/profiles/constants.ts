export const BLE_SERVICE_UUIDS = {
  heartRate: '180D',
  runningSpeedCadence: '1814',
  cyclingSpeedCadence: '1816',
  cyclingPower: '1818',
  fitnessMachine: '1826',
} as const;

export const BLE_CHARACTERISTIC_UUIDS = {
  heartRateMeasurement: '2A37',
  rscMeasurement: '2A53',
  cscMeasurement: '2A5B',
  cyclingPowerMeasurement: '2A63',
  treadmillData: '2ACD',
  indoorBikeData: '2AD2',
} as const;

export const BLE_FITNESS_SERVICE_UUIDS = Object.values(BLE_SERVICE_UUIDS);
