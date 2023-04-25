import { AMM } from '@voltz-protocol/v1-sdk';
import { Event } from 'ethers';

import { FactoryEventType, VammEventType } from '../types';

interface BaseVammEventInfo extends Event {
  eventId: string;
  type: VammEventType;

  chainId: number;
  vammAddress: string; // todo: deprecate because we have amm
  amm: AMM;

  rateOracle: string; // todo: deprecate because we have amm
  underlyingToken: string; // todo: deprecate because we have amm
  marginEngineAddress: string; // todo: deprecate because we have amm
}

export interface MintOrBurnEventInfo extends BaseVammEventInfo {
  ownerAddress: string;
  tickLower: number;
  tickUpper: number;

  notionalDelta: number;
  liquidityDelta: number;
}

export interface SwapEventInfo extends BaseVammEventInfo {
  ownerAddress: string;
  tickLower: number;
  tickUpper: number;

  variableTokenDelta: number;
  fixedTokenDeltaUnbalanced: number;
  feePaidToLps: number;
}

export interface VAMMPriceChangeEventInfo extends BaseVammEventInfo {
  isInitial: boolean;
  tick: number;
}

interface BaseFactoryEventInfo extends Event {
  eventId: string;
  type: FactoryEventType;

  chainId: number;
  factory: string;
}

export interface IrsInstanceEventInfo extends BaseFactoryEventInfo {
  vamm: string;
  marginEngine: string;

  termStartTimestamp: number;
  termEndTimestamp: number;

  rateOracleID: string;
  rateOracleIndex: number;

  underlyingToken: string;
  tokenDecimals: number;
}
