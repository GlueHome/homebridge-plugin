export class Hub {
    constructor(
        public id: string,
        public serialNumber: string,
        public firmwareVersion: string,
        public hardwareVersion: string,
        public ownerId: string,
        public status: HubStatus,
        public lockIds: string[],
        public availableFirmwareVersion?: string,
        public lastCommunication?: string,
        public busyUntil?: string,
    ) {}

    public static fromJson(json): Hub {
        return new Hub(
            json.id,
            json.serialNumber,
            json.firmwareVersion,
            json.hardwareVersion,
            json.ownerId,
            json.status,
            json.lockIds ?? [],
            json.availableFirmwareVersion,
            json.lastCommunication,
            json.busyUntil
        )
    }
}

type HubStatus = "created" | "active" | "upgrading" | "communicationLost" | "deleted"