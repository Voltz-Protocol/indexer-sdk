import { AMM } from '@voltz-protocol/v1-sdk';
import { BigQueryPositionRow } from '../../big-query-support';
import { SwapEventInfo } from '../../common/event-parsers/parseSwapEvent';
import { VAMMPriceChangeEventInfo } from '../../common/event-parsers';
import { calculatePassiveTokenDeltas, PassiveTokenDeltas } from '../../common/lp-math/calculatePassiveTokenDeltas';

type GPassiveSwapEventsArgs = {
  existingLpPositionRows: BigQueryPositionRow[];
  amm: AMM;
  priceChangeEventInfo: VAMMPriceChangeEventInfo;
};

export const gPassiveSwapEvents = async ({
  existingLpPositionRows,
  amm,
  priceChangeEventInfo,
}: GPassiveSwapEventsArgs): Promise<{
  passiveSwapEvents: SwapEventInfo[];
  affectedLps: BigQueryPositionRow[];
}> => {
  // Retrieve amm info
  const startTimestamp = Math.floor(amm.termStartTimestampInMS / 1000);
  const maturityTimestamp = Math.floor(amm.termEndTimestampInMS / 1000);

  const tokenDecimals = amm.underlyingToken.decimals;

  const passiveSwapEvents: SwapEventInfo[] = [];
  const affectedLps: BigQueryPositionRow[] = [];

  for (const positionRow of existingLpPositionRows) {


    if (positionRow.lastUpdatedTimestamp < priceChangeEventInfo.eventTimestamp) {

      // position is initialized before event timestamp
      const ownerAddress = positionRow.ownerAddress;
      const tickLower = positionRow.tickLower;
      const tickUpper = positionRow.tickUpper;
      const tickPrevious = positionRow.tickPrevious;
      
      const {variableTokenDelta, fixedTokenDeltaUnbalanced} : PassiveTokenDeltas = calculatePassiveTokenDeltas(
        positionRow.liquidity, 
        tickUpper, 
        tickLower,
        priceChangeEventInfo.tick,
        tickPrevious
      );

      // todo: check if we can have two passive swaps with the same event timestamp, realistically yeah
      const passiveSwapEventId = `${priceChangeEventInfo.chainId}_${priceChangeEventInfo.vammAddress}_${ownerAddress}_${priceChangeEventInfo.eventTimestamp}`.toLowerCase();

      const passiveSwapEvent: SwapEventInfo = {
        eventId: passiveSwapEventId,
        eventBlockNumber: priceChangeEventInfo.eventBlockNumber,
        chainId: priceChangeEventInfo.chainId,
        vammAddress: priceChangeEventInfo.vammAddress,
        ownerAddress,
        tickLower,
        tickUpper,
        variableTokenDelta,
        fixedTokenDeltaUnbalanced,
        feePaidToLps: 0, // does not apply to passive swaps
        rateOracle: priceChangeEventInfo.rateOracle,
        underlyingToken: priceChangeEventInfo.underlyingToken,
        marginEngineAddress: priceChangeEventInfo.marginEngineAddress,
        amm: priceChangeEventInfo.amm,
        type: 'swap',
        eventTimestamp: priceChangeEventInfo.eventTimestamp
      };

      passiveSwapEvents.push(passiveSwapEvent);

        affectedLps.push({
          ...positionRow,
          tickPrevious: priceChangeEventInfo.tick
        });
      
    } else {
        throw Error("Position is in the future");
    }
  }

  return { passiveSwapEvents, affectedLps };
};
