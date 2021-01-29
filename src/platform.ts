import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { GlueLockAccessory } from './lock';
import { GlueApi } from './api';
import { issueApiKey } from './api/client';

interface GlueHomePlatformConfig extends PlatformConfig {
  apiKey: string;
  username: string;
  password: string;
}

export class GlueHomePlatformPlugin implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  public readonly accessories: PlatformAccessory[] = [];
  private apiClient?: GlueApi;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');

      this.getApiKey(config as GlueHomePlatformConfig)
        .then(key => {
          this.apiClient = new GlueApi(key);
          this.discoverDevices();
        }).catch(err => {
          log.error('Error authenticating:', err);
        });
    });
  }

  getApiKey(glueConfig: GlueHomePlatformConfig): Promise<string> {
    return (glueConfig.apiKey)
      ? Promise.resolve(glueConfig.apiKey)
      : issueApiKey(glueConfig.username, glueConfig.password);
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    this.accessories.push(accessory);
  }

  discoverDevices() {
    if (this.apiClient === undefined) {
      return;
    }
    this.apiClient.getLocks()
      .then(locks => {
        for (const lock of locks) {
          const existingAccessory = this.accessories.find(accessory => accessory.UUID === lock.id);

          if (existingAccessory) {
            if (lock) {
              this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

              new GlueLockAccessory(this, existingAccessory, this.apiClient as GlueApi, lock);

              this.api.updatePlatformAccessories([existingAccessory]);
            } else if (!lock) {
              this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
              this.log.info('Removing existing accessory from cache:', existingAccessory.displayName);
            }
          } else {
            this.log.info('Adding new accessory:', lock.serialNumber);

            const accessory = new this.api.platformAccessory(lock.description, lock.id);

            new GlueLockAccessory(this, accessory, this.apiClient as GlueApi, lock);

            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          }
        }
      }).catch(error => {
        this.log.error(error);
      });
  }
}
