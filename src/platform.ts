import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { GlueLockAccessory } from './lock';
import { GlueApi } from './api';

interface GlueHomePlatformConfig extends PlatformConfig {
  apiKey: string;
}

export class GlueHomePlatformPlugin implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  public readonly accessories: PlatformAccessory[] = [];
  private readonly apiClient: GlueApi;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    const glueConfig = config as GlueHomePlatformConfig;

    this.apiClient = new GlueApi(glueConfig.apiKey);
    
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      this.discoverDevices();
    });
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    this.accessories.push(accessory);
  }

  discoverDevices() {
    this.apiClient.getLocks()
      .then(locks => {
        for (const lock of locks) {
          const existingAccessory = this.accessories.find(accessory => accessory.UUID === lock.id);

          if (existingAccessory) {
            if (lock) {
              this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

              new GlueLockAccessory(this, existingAccessory, this.apiClient, lock);

              this.api.updatePlatformAccessories([existingAccessory]);
            } else if (!lock) {
              this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
              this.log.info('Removing existing accessory from cache:', existingAccessory.displayName);
            }
          } else {
            this.log.info('Adding new accessory:', lock.serialNumber);

            const accessory = new this.api.platformAccessory(lock.description, lock.id);

            new GlueLockAccessory(this, accessory, this.apiClient, lock);

            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          }
        }
      }).catch(error => {
        this.log.error(error);
      });
  }
}
