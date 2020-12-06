import { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback } from 'homebridge';

import { GlueHomePlatformPlugin } from './platform';
import { GlueApi } from './api/client';
import { Lock, EventType, LockOperationType } from './api';


export class GlueLockAccessory {
  private lockMechanism: Service;
  private batteryService: Service;

  private lockCurrentState: Record<EventType, number> = {
    'pressAndGo': this.platform.Characteristic.LockCurrentState.SECURED,
    'localLock': this.platform.Characteristic.LockCurrentState.SECURED,
    'manualLock': this.platform.Characteristic.LockCurrentState.SECURED,
    'remoteLock': this.platform.Characteristic.LockCurrentState.SECURED,
    'localUnlock': this.platform.Characteristic.LockCurrentState.UNSECURED,
    'manualUnlock': this.platform.Characteristic.LockCurrentState.UNSECURED,
    'remoteUnlock': this.platform.Characteristic.LockCurrentState.UNSECURED,
  };

  private lockTargetState: Record<number, LockOperationType> = {
    0: LockOperationType.Unlock,
    1: LockOperationType.Lock,
  };

  constructor(
    protected readonly platform: GlueHomePlatformPlugin,
    protected readonly accessory: PlatformAccessory,
    protected readonly glueClient: GlueApi,
    protected lock: Lock,
  ) {
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'GlueHome')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, lock.serialNumber)
      .setCharacteristic(this.platform.Characteristic.Name, lock.description)
      .setCharacteristic(this.platform.Characteristic.Model, `${lock.productType}${lock.productVersion}`)
      .setCharacteristic(this.platform.Characteristic.FirmwareRevision, lock.firmwareVersion);

    this.lockMechanism = this.accessory.getService(this.platform.Service.LockMechanism)
      || this.accessory.addService(this.platform.Service.LockMechanism);

    this.lockMechanism.getCharacteristic(this.platform.Characteristic.LockCurrentState)
      .on('get', this.getLockCurrentState.bind(this));

    this.lockMechanism.getCharacteristic(this.platform.Characteristic.LockTargetState)
      .on('get', this.getLockTargetState.bind(this))
      .on('set', this.setLockTargetState.bind(this));

    this.batteryService = this.accessory.getService(this.platform.Service.BatteryService)
      || this.accessory.addService(this.platform.Service.BatteryService);
    this.batteryService
      .getCharacteristic(this.platform.Characteristic.BatteryLevel)
      .on('get', this.getBatteryLevel.bind(this));

    this.batteryService
      .getCharacteristic(this.platform.Characteristic.StatusLowBattery)
      .on('get', this.getBatteryStatus.bind(this));

    this.batteryService.getCharacteristic(this.platform.Characteristic.ChargingState)
      .on('get', this.getBatteryChargingState.bind(this));

    this.refreshLockData();
  }

  getLockCurrentState(callback: CharacteristicSetCallback) {
    const currentLockState = this.computeLockCurrentState();
    this.platform.log.debug(`getLockTargetState for lock ${this.lock.description} with value ${currentLockState}`);

    callback(null, currentLockState);
  }

  getLockTargetState(callback: CharacteristicSetCallback) {
    const state = this.computeLockCurrentState();
    this.platform.log.debug(`getLockTargetState for lock ${this.lock.description} with value ${state}`);
    callback(null, state);
  }

  setLockTargetState(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.platform.log.debug(`setLockTargetState setLockTargetState to ${value} for lock ${this.lock.description}`);
    const targetValue = value as number;

    if (this.lock.hubId) {
      this.glueClient
        .createLockOperation(this.lock.id, { type: this.lockTargetState[targetValue] })
        .then(operation => {
          this.platform.log.debug(`operation for lock ${this.lock.description}`, operation);

          if (operation.status === 'completed') {
            return callback(null, value);
          } else {
            this.checkRemoteOperationStatus(callback, operation.id, targetValue);
          }
        })
        .catch(err => {
          this.platform.log.error(err);
          callback(err);
        });
    } else {
      callback(new Error(`Please pair a hub with lock ${this.lock.description}`));
    }
  }

  getBatteryLevel(callback: CharacteristicGetCallback) {
    this.platform.log.debug(`getBatteryLevel for lock ${this.lock.description} with value ${this.lock.batteryLevel()}.`);
    callback(null, this.lock.batteryLevel());
  }

  getBatteryStatus(callback: CharacteristicGetCallback) {
    this.platform.log.debug(`getBatteryStatus for lock ${this.lock.description} with value ${this.computeLockBatteryStatus()}.`);
    callback(null, this.computeLockBatteryStatus());
  }

  getBatteryChargingState(callback: CharacteristicGetCallback) {
    this.platform.log.debug(`getBatteryChargingState for lock ${this.lock.description}`);
    callback(null, this.platform.Characteristic.ChargingState.NOT_CHARGEABLE);
  }

  private checkRemoteOperationStatus(callback: CharacteristicSetCallback, opId: string, value: number) {
    setTimeout(() => {
      this.glueClient.getLockOperation(this.lock.id, opId)
        .then((operation) => {
          this.platform.log.debug('Operation result', operation);

          if (operation.status === 'completed') {
            callback(null, value);
          } else {
            callback(null);
          }
        }).catch((err) => {
          callback(err);
        });
    }, 5000);
  }

  private computeLockBatteryStatus() {
    return this.lock.isBatteryLow() ?
      this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW :
      this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
  }

  private computeLockCurrentState() {
    return this.lock.lastLockEvent && this.lockCurrentState[this.lock.lastLockEvent.lastLockEvent] ?
      this.lockCurrentState[this.lock.lastLockEvent.lastLockEvent] :
      undefined;
  }

  private refreshLockData() {
    setInterval(() => {
      this.glueClient
        .getLock(this.lock.id)
        .then(lock => {
          this.platform.log.debug(`Update lock ${lock.description} characteristics.`, lock);
          this.lock = lock;

          this.lockMechanism.updateCharacteristic(this.platform.Characteristic.Name, this.lock.description);
          this.batteryService.updateCharacteristic(this.platform.Characteristic.BatteryLevel, this.lock.batteryLevel());
          this.batteryService.updateCharacteristic(this.platform.Characteristic.StatusLowBattery, this.computeLockBatteryStatus());

          const lockCurrentState = this.computeLockCurrentState();

          if (lockCurrentState !== undefined) {
            this.lockMechanism.updateCharacteristic(this.platform.Characteristic.LockCurrentState, lockCurrentState);
          }
        });
    }, 10000);
  }
}