export class Lock {
  constructor(
        public id: string,
        public serialNumber: string,
        public description: string,
        public firmwareVersion: string,
        public batteryStatus: number,
        public connectionStatus: LockConnecitionStatus,
        public lastLockEvent?: LockEvent) {
  }

  public getLockModel(): string {
    return this.serialNumber.substring(0, 4);
  }

  public isBatteryLow(): boolean {
    return this.batteryStatus < 50;
  }

  public static fromJson(json): Lock {
    return new Lock(
      json.id,
      json.serialNumber,
      json.description,
      json.firmwareVersion,
      json.batteryStatus,
      json.connectionStatus,
      json.lastLockEvent,
    );
  }
}

export enum LockOperationType {
    Lock = 'lock',
    Unlock = 'unlock'
}

export enum LockOperationStatus {
    Pending = 'pending',
    Completed = 'completed',
    Timeout = 'timeout',
    Failed = 'failed',
}

export enum LockConnecitionStatus {
    Offline = 'offline',
    Disconnected = 'disconnected',
    Connected = 'connected',
    Busy = 'busy',
}

export interface CreateLockOperation {
    type: LockOperationType;
}

export class LockOperation {
  constructor(
        public id: string,
        public status: LockOperationStatus,
        public reason?: string,
  ) { }

  public isFinished(): boolean {
    return this.status !== 'pending';
  }

  public static fromJson(json): LockOperation {
    return new LockOperation(
      json.id,
      json.status,
      json.reason,
    );
  }
}

export type EventType =
    'unknown' |
    'localLock' |
    'localUnlock' |
    'remoteLock' |
    'remoteUnlock' |
    'pressAndGo' |
    'manualUnlock' |
    'manualLock';

interface LockEvent {
    eventType: EventType;
    lastLockEventDate: Date;
}