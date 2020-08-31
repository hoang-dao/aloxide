import { AbstractActionReader, NotInitializedError } from 'demux';
import fetch from 'node-fetch';

import {
  RetrieveBlockError,
  RetrieveHeadBlockError,
  RetrieveIrreversibleBlockError,
} from './errors';
import { retry } from './utils';

import type { IconActionReaderOptions } from './IconActionReaderOptions';
import { IconBlock } from './IconBlock';

export class IconActionReader extends AbstractActionReader {
  protected endpoint: string;
  protected nid: number;
  protected jsonrpc: string;

  constructor(options: IconActionReaderOptions = {}) {
    super(options);
    const endpoint = options.endpoint
      ? options.endpoint
      : 'https://bicon.net.solidwallet.io/api/v3';
    this.endpoint = endpoint.replace(/\/+$/g, ''); // Removes trailing slashes
    this.nid = options.nid || 3;
    this.jsonrpc = options.jsonrpc || '2.0';
  }

  public post(data: { [key: string]: any }): Promise<any> {
    return fetch({
      url: `${this.endpoint}`,
      method: 'POST',
      body: JSON.stringify(data),
    }).then(res => res.json());
  }

  public getLastBlock(): Promise<any> {
    return this.post({
      jsonrpc: this.jsonrpc,
      method: 'icx_getLastBlock',
      id: this.nid,
    });
  }

  /**
   * Returns a promise for the head block number.
   */
  public async getHeadBlockNumber(
    numRetries: number = 120,
    waitTimeMs: number = 250,
  ): Promise<number> {
    try {
      const blockNum = await retry(
        async () => {
          const blockInfo = await this.getLastBlock();
          return blockInfo.result.height;
        },
        numRetries,
        waitTimeMs,
      );
      return blockNum;
    } catch (err) {
      throw new RetrieveHeadBlockError();
    }
  }

  public async getLastIrreversibleBlockNumber(
    numRetries: number = 120,
    waitTimeMs: number = 250,
  ): Promise<number> {
    try {
      const irreversibleBlockNum = await retry(
        async () => {
          const blockInfo = await this.getLastBlock();
          return blockInfo.result.height;
        },
        numRetries,
        waitTimeMs,
      );

      return irreversibleBlockNum;
    } catch (err) {
      this.log.error(err);
      throw new RetrieveIrreversibleBlockError();
    }
  }

  /**
   * Returns a promise for a `NodeosBlock`.
   */
  public async getBlock(
    blockNumber: number,
    numRetries: number = 120,
    waitTimeMs: number = 250,
  ): Promise<IconBlock> {
    try {
      const block = await retry(
        async () => {
          const rawBlock = await this.post({
            jsonrpc: this.jsonrpc,
            method: 'icx_getBlockByHeight',
            id: this.nid,
            params: {
              height: blockNumber.toString(16),
            },
          });
          return new IconBlock(rawBlock, this.log);
        },
        numRetries,
        waitTimeMs,
      );

      return block;
    } catch (err) {
      this.log.error(err);
      throw new RetrieveBlockError();
    }
  }

  protected async setup(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.getLastBlock();
    } catch (err) {
      throw new NotInitializedError('Cannot reach supplied nodeos endpoint.', err);
    }
  }
}
