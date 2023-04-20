import { AMM } from '@voltz-protocol/v1-sdk';

import { SECONDS_IN_YEAR } from '../../common/constants';
import { SwapEventInfo } from '../../common/event-parsers/types';
import { getCashflowInfo } from '../../common/services/getCashflowInfo';
import { getTimestampInSeconds } from '../../common/utils';
import { BigQueryPositionRow } from '../pull-data/types';

export const generatePositionRow = (
  amm: AMM,
  eventInfo: SwapEventInfo,
  eventTimestamp: number,
  existingPosition: BigQueryPositionRow | null,
  liquidityIndexAtRootEvent: number,
): BigQueryPositionRow => {
  const rowLastUpdatedTimestamp = getTimestampInSeconds();

  const unbalancedFixedTokenDelta = eventInfo.fixedTokenDeltaUnbalanced;

  const incomingCashflowLiFactor = eventInfo.variableTokenDelta / liquidityIndexAtRootEvent;
  const incomingCashflowTimeFactor = unbalancedFixedTokenDelta * 0.01;
  const incomingCashflowFreeTerm =
    -eventInfo.variableTokenDelta -
    (unbalancedFixedTokenDelta * 0.01 * eventTimestamp) / SECONDS_IN_YEAR;

  const {
    notional: netNotionalLocked,
    cashflowLiFactor,
    cashflowTimeFactor,
    cashflowFreeTerm,
  } = getCashflowInfo(
    {
      notional: existingPosition?.netNotionalLocked || 0,
      cashflowLiFactor: existingPosition?.cashflowLiFactor || 0,
      cashflowTimeFactor: existingPosition?.cashflowTimeFactor || 0,
      cashflowFreeTerm: existingPosition?.cashflowFreeTerm || 0,
    },
    {
      notional: eventInfo.variableTokenDelta,
      cashflowLiFactor: incomingCashflowLiFactor,
      cashflowTimeFactor: incomingCashflowTimeFactor,
      cashflowFreeTerm: incomingCashflowFreeTerm,
    },
    Math.floor(amm.termEndTimestampInMS / 1000),
  );

  const netFixedRateLocked =
    netNotionalLocked === 0 ? 0 : Math.abs(cashflowTimeFactor / netNotionalLocked);

  // todo: remove this, debugging purposes
  {
    const uPnL =
      liquidityIndexAtRootEvent * cashflowLiFactor +
      (eventTimestamp * cashflowTimeFactor) / SECONDS_IN_YEAR +
      cashflowFreeTerm;

    console.log(`current uPnL of position: ${uPnL}`);
  }

  // todo: add empty entries
  return {
    chainId: eventInfo.chainId,
    marginEngineAddress:
      existingPosition?.marginEngineAddress || amm.marginEngineAddress.toLowerCase(),
    vammAddress: existingPosition?.vammAddress || eventInfo.vammAddress,
    ownerAddress: existingPosition?.ownerAddress || eventInfo.ownerAddress,
    tickLower: existingPosition?.tickLower || eventInfo.tickLower,
    tickUpper: existingPosition?.tickUpper || eventInfo.tickUpper,
    realizedPnLFromSwaps: 0, // todo: deprecate
    realizedPnLFromFeesPaid:
      (existingPosition?.realizedPnLFromFeesPaid || 0) - eventInfo.feePaidToLps,
    netNotionalLocked,
    netFixedRateLocked,
    lastUpdatedBlockNumber: eventInfo.blockNumber,
    notionalLiquidityProvided: existingPosition?.notionalLiquidityProvided || 0, // todo: track
    realizedPnLFromFeesCollected: existingPosition?.realizedPnLFromFeesCollected || 0, // todo: track
    netMarginDeposited: existingPosition?.netMarginDeposited || 0, // todo: track
    rateOracleIndex: existingPosition?.rateOracleIndex || amm.rateOracle.protocolId,
    rowLastUpdatedTimestamp: rowLastUpdatedTimestamp,
    fixedTokenBalance: existingPosition?.fixedTokenBalance || 0, // todo: track
    variableTokenBalance: existingPosition?.variableTokenBalance || 0, // todo: track
    positionInitializationBlockNumber:
      existingPosition?.positionInitializationBlockNumber || eventInfo.blockNumber,
    rateOracle: existingPosition?.rateOracle || amm.rateOracle.protocol,
    underlyingToken: existingPosition?.underlyingToken || amm.underlyingToken.name,
    cashflowLiFactor,
    cashflowTimeFactor,
    cashflowFreeTerm,
    liquidity: existingPosition?.liquidity || 0,
  };
};