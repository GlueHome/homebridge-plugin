import axios, { AxiosError, AxiosInstance } from 'axios';
import { Lock, LockOperation, CreateLockOperation } from './';
import { PLATFORM_NAME, VERSION, OS_VERSION } from '../settings';

const API_URL = 'https://user-api.gluehome.com';
const USER_AGENT = `${PLATFORM_NAME}/${VERSION} (${OS_VERSION})`;

export async function issueApiKey(username: string, password: string): Promise<string> {
  try {
    const response = await axios.post(`${API_URL}/v1/api-keys`, {
      name: 'homebridge',
      scopes: ['locks.write', 'locks.read', 'events.read'],
    },
    { 
      headers: {
        'Contenty-Type': 'application/json',
        'User-Agent': USER_AGENT,
      },
      auth: {
        username: username,
        password: password,
      },
    });

    return response.data.apiKey;
  } catch(err) {
    throw Error(err);
  }
}

export interface ApiError {
    code: number;
    detail: string;
    correlationId: string;
}

export class GlueApi {
    private readonly apiKey: string;
    private httpClient: AxiosInstance;

    constructor(apiKey: string) {
      this.apiKey = apiKey;

      this.httpClient = axios.create({
        baseURL: API_URL,
        timeout: 60000,
      });

      this.httpClient.interceptors.request.use(config => {
        config.headers.authorization = `Api-Key ${apiKey}`;
        config.headers['User-Agent'] = USER_AGENT;
        return config;
      }, (error: AxiosError) => {
        return Promise.reject(error.toJSON());
      });

      this.httpClient.interceptors.response.use(
        res => res,
        err => {
          if (err.response === undefined) {
            return Promise.reject(err);
          }
          if (err.response.status === 401) {
            return Promise.reject('Wrong authentication data provided. Please check the plugin configuration.');
          }

          const {title, code, correlationId, detail} = err.response.data;
          const msg = `${title} (code: ${code} correlationId: ${correlationId} details: ${detail})`;
          return Promise.reject(msg);
        },
      );
    }

    public getLocks(): Promise<Lock[]> {
      return this.httpClient.get<Lock[]>('/v1/locks')
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
