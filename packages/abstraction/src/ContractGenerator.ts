import { createLogger, Logger } from '@aloxide/logger';

import { readAloxideConfig } from './readAloxideConfig';
import { validateSchema } from './SchemaValidator';

import type { ContractGeneratorConfig } from './ContractGeneratorConfig';
import type { AloxideConfig } from './AloxideConfig';
import { ContractAdapter } from '@aloxide/bridge';

import { isObject } from './lib/Utils';

export class ContractGenerator {
  aloxideConfig: AloxideConfig;
  logger: Logger;
  contractName: string;
  public config: ContractGeneratorConfig;
  private adapters: ContractAdapter[] = [];

  constructor(config: ContractGeneratorConfig) {
    const { adapters, ...rest } = config;

    if (!config) {
      throw new Error('missing configuration');
    }

    this.config = rest;

    if (config.logger) {
      this.logger = config.logger;
    } else {
      this.logger = createLogger();
    }
    this.logger.debug('-- config.aloxideConfigPath', config.aloxideConfigPath);
    this.logger.debug('-- config.resultPath', config.resultPath);

    this.aloxideConfig = readAloxideConfig(config.aloxideConfigPath);
    this.adapters = [];

    this.addAdapters(adapters);
  }

  /**
   * Configure/override adapter configs to use some from the generator.
   * This is a mutable function.
   */
  configureAdapter(adapter: ContractAdapter) {
    // Get `logger` config from generator
    adapter.logger = this.logger || adapter.logger;

    // Get `contractName` config from generator
    adapter.contractName = this.contractName || 'hello';

    // Get `entities` config from generator
    adapter.entityConfigs = this.aloxideConfig.entities || [];

    return adapter;
  }

  /**
   * Add adapters to Contract Generator so that we can communicate with the blockchain we want
   * @param adapters
   */
  addAdapters(adapters: ContractAdapter | ContractAdapter[]) {
    if (isObject(adapters)) {
      // Add single adapter
      this.adapters.push(this.configureAdapter(adapters as ContractAdapter));

    } else if (Array.isArray(adapters)) {
      // Add multiple adapters
      this.adapters.push(
          ...adapters.reduce((accumulator, adapter) => {
          if (adapter) {
            this.configureAdapter(adapter);

            accumulator.push(adapter);
          }

          return accumulator;
        }, [])
      );

    } else {
      throw new Error('Invalid Contract Adapter');
    }
  }

  validateEntity() {

    const checkName = val => {
      return /^[1-5a-zA-Z]+/.test(val)
    }

    const checkType = val => {
      const supportedType = ["uint64_t", "number", "string", "array", "bool"];
      return supportedType.indexOf(val) !== -1
    }

    const requiredSchema = {
      entities: [{
        name: { type: String, required: true, length: { min: 1, max: 12 }, use: { checkName } },
        fields: [{
          name: { type: String, required: true, length: { min: 1, max: 12 }, use: { checkName } },
          type: { type: String, required: true, use: { checkType } },
        }],
        key: { type: String, required: true, length: { min: 1, max: 12 }, use: { checkName } }
      }
      ]
    }
    let schemaErrors = validateSchema(this.aloxideConfig, requiredSchema, this.logger)

    return schemaErrors.length < 1;
  }

  generate() {
    if (!this.validateEntity()) {
      throw new Error('input entities mismatch');
    }
    if (!this.config.resultPath) {
      throw new Error('missing resultPath');
    }

    if (Array.isArray(this.adapters)) {
      this.adapters.forEach(adapter => {
        adapter.generate(this.config.resultPath);
      });
    }
  }
}
