import { BigQuery } from '@google-cloud/bigquery';
import { AMM } from '@voltz-protocol/v1-sdk';
import { Redis } from 'ioredis';

import { getPreviousEvents } from '../common/contract-services/getPreviousEvents';
import { setFromBlock } from '../common/services/cache';
import { processLpSpeedEvent } from './processLpSpeedEvent/processLpSpeedEvent';

export const sync = async (bigQuery: BigQuery, amms: AMM[], redisClient: Redis): Promise<void> => {
  const promises = amms.map(async (amm) => {
    console.log(`Fetching events for AMM ${amm.id}`);

    const { fromTick, fromBlock, events } = await getPreviousEvents(
      'lp_speed',
      amm,
      ['mint', 'burn', 'price_change'],
      redisClient,
    );

    let currentTick = fromTick;
    let latestCachedBlock = fromBlock;

    console.log(`Processing ${events.length} events from block ${fromBlock}...`);

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      console.log(`Processing event: ${event.type} (${i+1}/${events.length})`);

      let trackingTime = Date.now().valueOf();

      const newTick = await processLpSpeedEvent(bigQuery, event, currentTick);
      currentTick = newTick;

      console.log(`Event processing took ${Date.now().valueOf() - trackingTime} ms`);
      trackingTime = Date.now().valueOf();

      const isSet = await setFromBlock({
        syncProcessName: 'lp_speed',
        chainId: event.chainId,
        vammAddress: event.address,
        lastBlock: event.blockNumber,
        redisClient: redisClient,
      });

      latestCachedBlock = isSet ? event.blockNumber : latestCachedBlock;

      console.log(`Setting in redis cache took ${Date.now().valueOf() - trackingTime} ms`);
      trackingTime = Date.now().valueOf();

      console.log();
    }
  });

  const output = await Promise.allSettled(promises);
  output.forEach((v) => {
    if (v.status === 'rejected') {
      throw v.reason;
    }
  });
};

// todo: what if fromBlock is > vamm initialization, needs to be handled in the get previous events function
// todo: double check the fact that events are properly ordered sicne last time
// checked and the initialization of the vammm didn't come up first
// note this must be the initialization tick
