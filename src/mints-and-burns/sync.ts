import { BigQuery } from '@google-cloud/bigquery';
import { AMM } from '@voltz-protocol/v1-sdk';

import { getPreviousEvents } from '../common';
import { processMintOrBurnEvent } from './processMintAndBurnEvent';

export const sync = async (
  chainId: number,
  bigQuery: BigQuery,
  amms: AMM[],
  fromBlock: number,
  toBlock: number,
): Promise<void> => {
  
  const previousMintEvents = await getPreviousEvents(amms, ['mint'], fromBlock, toBlock);

  const promises = Object.values(previousMintEvents).map(async ({ events }) => {
    for (const event of events) {
      // todo: check if we can infer event name when parsing the event
      await processMintOrBurnEvent(chainId, bigQuery, event, true);
    }
  });

  const output = await Promise.allSettled(promises);
  output.forEach((v) => {
    if (v.status === 'rejected') {
      throw v.reason;
    }
  });
};
