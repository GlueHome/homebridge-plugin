export class Lock {
    constructor(
        public id: string,
        public serialNumber: string,
        public description: string,
        public productType: string,
        public productVersion: string,
        public firmwareVersion: string,
        public hardwareVersion: string,
        public availableFirmwareVersion: string,
        public batteryStatus: number,
        public hubId?: string,
        public lastLockEvent?: LockEvent) {
    }

    public getGlueLockVersion(): string {
        return this.serialNumber.substring(2, 2);
    }

    public batteryLevel(): number {
        return this.batteryStatus * 100 / 255;
    }

    public isBatteryLow(): boolean {
        return this.batteryLevel() < 20;
    }

    public static fromJson(json): Lock {
        return new Lock(
            json.id,
            json.serialNumber,
            json.description,
            json.productType,
            json.productVersion,
            json.firmwareVersion,
            json.hardwareVersion,
            json.availableFirmwareVersion,
            json.batteryStatus,
            json.hubId,
            json.lastLockEvent,
        );
    }
}

export enum LockOperationType {
    Lock = "lock",
    Unlock = "unlock"
};

export interface CreateLockOperation {
    type: LockOperationType
}

export class LockOperation {
    constructor(
        public id: string,
        public userId: string,
        public status: "pending" | "completed" | "timeout" | "failed",
        public reason?: string,
        public validFrom?: Date,
        public validUntil?: Date,
    ) { }

    public isFinished(): boolean {
        return this.status != 'pending';
    }

    public static fromJson(json): LockOperation {
        return new LockOperation(
            json.id,
            json.userId,
            json.status,
            json.reason,
            json.validFrom,
            json.validUntil,
        )
    }
}

export type EventType =
    "localLock" |
    "localUnlock" |
    "remoteLock" |
    "remoteUnlock" |
    "pressAndGo" |
    "manualUnlock" |
    "manualLock"

export type DoorState =
    "unknown" |
    "hidden" |
    "pending" |
    "locked" |
    "unlocked" |
    "open" |
    "closed" |
    "hubOffline" |
    "hubUpgrading" |
    "pendingBoltCalibration" |
    "pendingDoorCalibration" |
    "pendingLockUpgrade" |
    "pendingHubUpgrade"

interface LockEvent {
    lastLockEvent: EventType
    lastLockEventDate: Date
}