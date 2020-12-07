import axios, { AxiosInstance } from "axios"
import { Lock, LockOperation, CreateLockOperation } from "./"

export class GlueApi {
    private readonly apiKey: string;
    private httpClient: AxiosInstance;

    constructor(apiKey: string) {
        this.apiKey = apiKey;

        this.httpClient = axios.create({
            baseURL: "https://api-dev.gluehome.net",
            timeout: 60000
        });

        this.httpClient.interceptors.request.use(config => {
            config.headers.authorization = `Api-Key ${apiKey}`
            return config;
        }, (error) => {
            return Promise.reject(error);
        });

    }

    public getLocks(): Promise<Lock[]> {
        return this.httpClient.get<Lock[]>("/v1/locks")
            .then(res => res.data?.map(Lock.fromJson) ?? []);
    }

    public getLock(id: string): Promise<Lock> {
        return this.httpClient.get<Lock>(`/v1/locks/${id}`)
            .then(res => Lock.fromJson(res.data));
    }

    public getLockOperation(id: string, operationId: string): Promise<LockOperation> {
        return this.httpClient.get<LockOperation>(`/v1/locks/${id}/operations/${operationId}`)
            .then(res => LockOperation.fromJson(res.data));
    }

    public createLockOperation(id: string, operation: CreateLockOperation): Promise<LockOperation> {
        return this.httpClient.post<LockOperation>(`/v1/locks/${id}/operations`, operation)
            .then(res => LockOperation.fromJson(res.data));
    }
}