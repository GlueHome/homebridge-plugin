import {
  Service, PlatformAccessory, CharacteristicValue,
  CharacteristicSetCallback, CharacteristicGetCallback,
} from 'homebridge';
import { GlueHomePlatformPlugin } from './platform';
import { GlueApi } from './api/client';
import {
  Lock, EventType, LockOperationType, LockOperation, LockConnecitionStatus,
  LockOperationStatus,
} from './api';
import { retry } from './utils';

export class GlueLockAccessory {
  private lockMechanism: Service;
  private batteryService: Service;

  private lockCurrentState: Record<EventType, number> = {
    'unknown': this.platform.Characteristic.LockCurrentState.UNKNOWN,
    'pressAndGo': this.platform.Characteristic.LockCurrentState.SECURED,
    'localLock': this.platform.Characteristic.LockCurrentState.SECURED,
    'manualLock': this.platform.Characteristic.LockCurrentState.SECURED,
    'remoteLock': this.platform.Characteristic.LockCurrentState.SECURED,
    'localUnlock': this.platform.Characteristic.LockCurrentState.UNSECURED,
    'manualUnlock': this.platform.Characteristic.LockCurrentState.UNSECURED,
    'remoteUnlock': this.platform.Characteristic.LockCurrentState.UNSECURED,
  };

  private lockTargetStateMapper: Record<number, LockOperationType> = {
    0: LockOperationType.Unlock,
    1: LockOperationType.Lock,
  };

  private targetToCurrentStateMapper: Record<number, EventType> = {
    0: 'remoteUnlock',
    1: 'remoteLock',
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
      .setCharacteristic(this.platform.Characteristic.Model, lock.getLockModel())
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

  getLockCurrentState(callback: CharacteristicGetCallback) {
    const currentLockState = this.computeLockCurrentState();
    this.platform.log.debug(`getLockCurrentState for lock ${this.lock.description} with value ${currentLockState}`);

    callback(null, currentLockState);
  }

  getLockTargetState(callback: CharacteristicGetCallback) {
    const currentLockState = this.computeLockCurrentState();
    this.platform.log.debug(`getLockTargetState for lock ${this.lock.description} with value ${currentLockState}`);

    callback(null, currentLockState);
  }

  setLockTargetState(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.platform.log.debug(`setLockTargetState setLockTargetState to ${value} for lock ${this.lock.description}`);
    const targetValue = value as number;
    const remoteOperationType = this.lockTargetStateMapper[targetValue];

    if (this.lock.connectionStatus === LockConnecitionStatus.Connected) {
      this.glueClient
        .createLockOperation(this.lock.id, { type: remoteOperationType })
        .then(createdOperation => {
          this.platform.log.debug(`operation for lock ${this.lock.description}`, createdOperation);

          return createdOperation.isFinished() ?
            createdOperation :
            retry<LockOperation>({
              times: 5,
              interval: 2000,
              task: () => this.checkRemoteOperationStatus(createdOperation.id),
            });
        })
        .then(operation => {
          this.platform.log.info('Operation finished', operation);

          if (operation.status === LockOperationStatus.Completed) {
            this.lock.lastLockEvent = {
              eventType: this.targetToCurrentStateMapper[targetValue],
              lastLockEventDate: new Date(),
            };

            this.lockMechanism.setCharacteristic(this.platform.Characteristic.LockCurrentState, this.computeLockCurrentState());

            callback(null, targetValue);
          } else {
            callback(new Error(`Remote operation ${operation.status}.`));
          }
        })
        .catch(err => {
          this.platform.log.error(err);
          callback(err);
        });
    } else {
      callback(new Error(`Lock ${this.lock.description} is not connected.`));
    }
  }

  getBatteryLevel(callback: CharacteristicGetCallback) {
    this.platform.log.debug(`getBatteryLevel for lock ${this.lock.description} with value ${this.lock.batteryStatus}.`);
    callback(null, this.lock.batteryStatus);
  }

  getBatteryStatus(callback: CharacteristicGetCallback) {
    const status = this.computeLockBatteryStatus();
    this.platform.log.debug(`getBatteryStatus for lock ${this.lock.description} with value ${status}.`);
    callback(null, status);
  }

  getBatteryChargingState(callback: CharacteristicGetCallback) {
    this.platform.log.debug(`getBatteryChargingState for lock ${this.lock.description}`);
    callback(null, this.platform.Characteristic.ChargingState.NOT_CHARGEABLE);
  }

  private async checkRemoteOperationStatus(opId: string): Promise<LockOperation> {
    const operation = await this.glueClient.getLockOperation(this.lock.id, opId);

    this.platform.log.debug('checkRemoteOperationStatus', operation);

    if (operation.status === LockOperationStatus.Pending) {
      throw new Error(`Operation ${opId} pending.`);
    }

    return operation;
  }

  private computeLockBatteryStatus() {
    return this.lock.isBatteryLow() ?
      this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW :
      this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
  }

  private computeLockCurrentState() {
    return this.lock.lastLockEvent ?
      this.lockCurrentState[this.lock.lastLockEvent.eventType] :
      this.platform.Characteristic.LockCurrentState.UNKNOWN;
  }

  private refreshLockData() {
    setInterval(() => {
      this.glueClient
        .getLock(this.lock.id)
        .then(updatedLock => {
          this.platform.log.debug(`Update lock ${updatedLock.description} characteristics.`, updatedLock);
          this.lock = updatedLock;

          this.lockMechanism.updateCharacteristic(this.platform.Characteristic.Name, this.lock.description);
          this.batteryService.updateCharacteristic(this.platform.Characteristic.BatteryLevel, this.lock.batteryStatus);
          this.batteryService.updateCharacteristic(this.platform.Characteristic.StatusLowBattery, this.computeLockBatteryStatus());
          this.lockMechanism.updateCharacteristic(this.platform.Characteristic.LockCurrentState, this.computeLockCurrentState());
        });
    }, 10000);
  }
}