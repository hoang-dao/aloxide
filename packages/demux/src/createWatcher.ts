import { BaseActionWatcher } from 'demux';

import { AloxideActionHandler } from './AloxideActionHandler';
import { AloxideDataManager } from './AloxideDataManager';
import { BaseHandlerVersion } from './BaseHandlerVersion';
import { createDbUpdater } from './createDbUpdater';

import type { ActionReader, ActionHandler, HandlerVersion, ActionWatcherOptions } from 'demux';
import type { AloxideActionHandlerOptions } from './AloxideActionHandler';
import type { Logger } from './Logger';
import type { AloxideConfig } from '@aloxide/abstraction';

export interface CreateWatcherConfig {
  /**
   * blockchain name
   */
  bcName: string;
  accountName: string;
  actionReader: ActionReader;
  dataAdapter: AloxideDataManager;
  aloxideConfig: AloxideConfig;
  logger: Logger;
  versionName?: string;
  handlerVersions?: HandlerVersion[];
  actionHandler?: ActionHandler;
  actionHandlerOptions?: AloxideActionHandlerOptions;
  actionWatcherOptions?: ActionWatcherOptions;
}

export async function createWatcher(config: CreateWatcherConfig): Promise<BaseActionWatcher> {
  const {
    bcName,
    accountName,
    versionName = 'v1',
    actionReader,
    actionWatcherOptions,
    actionHandlerOptions,
    dataAdapter,
    aloxideConfig,
    logger,
  } = config;

  let { handlerVersions, actionHandler } = config;

  if (!actionHandler) {
    if (!handlerVersions) {
      handlerVersions = [
        new BaseHandlerVersion(
          versionName,
          createDbUpdater(accountName, dataAdapter, aloxideConfig.entities, logger),
          [],
        ),
      ];
    }

    actionHandler = new AloxideActionHandler(
      bcName,
      dataAdapter,
      handlerVersions,
      actionHandlerOptions,
    );

    dataAdapter.verify(
      aloxideConfig.entities
        .map(({ name }) => name)
        .concat((actionHandler as AloxideActionHandler).getIndexStateModelName()),
    );
  }

  return new BaseActionWatcher(actionReader, actionHandler, actionWatcherOptions);
}
