import { AMM } from '@voltz-protocol/v1-sdk';
import { ethers } from 'ethers';
import { Redis } from 'ioredis';

import { isTestingAccount } from '../constants';
import { getFromBlock } from '../services/cache';
import { EventType, ExtendedEvent } from '../types';
import { generateVAMMContract } from './generateVAMMContract';

export type VammEvents = {
  events: ExtendedEvent[];
  fromBlock: number;
  fromTick: number;
};

// todo: test
export const applyProcessingWindow = (
  events: ExtendedEvent[],
  blockWindow: number,
): ExtendedEvent[] => {
  if (events.length === 0) {
    return [];
  }

  const filteredEvents: ExtendedEvent[] = [];
  const latestBlock = 0;

  events.forEach((currentEvent) => {
    const blocksSinceLatestEvent = currentEvent.blockNumber - latestBlock;

    if (blocksSinceLatestEvent >= blockWindow) {
      filteredEvents.push(currentEvent);
    }
  });

  return filteredEvents;
};

const getEventFilter = (
  vammContract: ethers.Contract,
  eventType: EventType | 'vamm_initialization',
): ethers.EventFilter => {
  switch (eventType) {
    case 'mint': {
      return vammContract.filters.Mint();
    }
    case 'swap': {
      return vammContract.filters.Swap();
    }
    case 'burn': {
      return vammContract.filters.Burn();
    }
    case 'price_change': {
      return vammContract.filters.VAMMPriceChange();
    }
    case 'vamm_initialization': {
      return vammContract.filters.VAMMInitialization();
    }
  }
};

const getFromTick = async (vammContract: ethers.Contract): Promise<number> => {
  // todo: what if fromBlock is > vamm initialization, needs to be handled in the get previous events function
  // one of the inputs to this function should be the fromBlock which is derived in the

  const eventFilter: ethers.EventFilter = getEventFilter(vammContract, 'vamm_initialization');

  const events: ethers.Event[] = await vammContract.queryFilter(eventFilter);

  if (events.length < 1) {
    throw Error('VAMM is not initialized');
  }

  if (events.length > 1) {
    throw Error('Impossible to have more than 1 vamm initialization events');
  }

  return events[0].args?.tick as number;
};

// todo: test and break down
export const getPreviousEvents = async (
  syncProcessName: 'active_swaps' | 'mints_lp' | 'passive_swaps_lp' | 'mint_burn' | 'lp_speed',
  amm: AMM,
  eventTypes: EventType[],
  redisClient: Redis,
): Promise<VammEvents> => {
  const toBlock = await amm.provider.getBlockNumber();
  const chainId = (await amm.provider.getNetwork()).chainId;

  const fromBlock = await getFromBlock({
    syncProcessName,
    chainId,
    vammAddress: amm.id,
    redisClient,
  });

  const vammContract = generateVAMMContract(amm.id, amm.provider);

  // note fromTick is only relevant for lp speed events however this function
  // is more general purpose
  const fromTick = await getFromTick(vammContract);

  const allEvents = [];

  for (const eventType of eventTypes) {
    const eventFilter = getEventFilter(vammContract, eventType);
    let events = await vammContract.queryFilter(eventFilter, fromBlock, toBlock);

    if (eventType === 'mint' || eventType === 'burn') {
      events = events.filter((e) => isTestingAccount(e.args?.owner as string));
    }

    if (eventType === 'swap') {
      events = events.filter((e) => isTestingAccount(e.args?.recipient as string));
    }

    const extendedEvents = events.map((event) => {
      const extendedEvent: ExtendedEvent = {
        ...event,
        type: eventType,
        amm: amm,
        chainId: chainId,
      };
      return extendedEvent;
    });

    allEvents.push(...extendedEvents);
  }

  const sortedEvents = allEvents.sort((a, b) => {
    if (a.blockNumber === b.blockNumber) {
      return a.transactionIndex - b.transactionIndex;
    }

    return a.blockNumber - b.blockNumber;
  });

  return {
    events: sortedEvents,
    fromBlock: fromBlock,
    fromTick: fromTick,
  };
};
