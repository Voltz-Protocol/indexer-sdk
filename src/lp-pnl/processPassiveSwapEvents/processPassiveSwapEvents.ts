import { BigQuery } from '@google-cloud/bigquery';
import { AMM } from '@voltz-protocol/v1-sdk';
import { ethers } from 'ethers';
import { pullExistingLpPositionRows } from '../../big-query-support';
import { parseSwapEvent } from '../../common/swaps/parseSwapEvent';
import { generateLpPositionUpdatesQuery } from '../../big-query-support/generateLpPositionUpdatesQuery';
import { generateLpPositionRowsFromPassiveSwaps } from './generateLpPositionRowsFromPassiveSwaps';
import { generatePassiveSwapEvents } from './generatePassiveSwapEvents';

export type ProcessPassiveSwapEventsArgs = {

  bigQuery: BigQuery,
  amm: AMM,
  event: ethers.Event,
  // todo: not sure if possible to derive chain id from the ethers.Event object
  chainId: number,
  provider: ethers.providers.Provider

}


export const processPassiveSwapEvents = async (
 {
  bigQuery,
  amm,
  event,
  chainId,
  provider
 } : ProcessPassiveSwapEventsArgs
): Promise<void> => {
  const rootSwapEvent = parseSwapEvent(amm, event);

  const currentTimestamp = (await event.getBlock()).timestamp;

  // currently not able to filter by e.g. vamm address of the swap because we're skipping a lot of swaps
  // for performance reasons, however we should still filter out lps that have their first mint in the
  // future relative to the eventTimestamp since we're processing all the mint events before jumping on passive swaps
  const existingLpPositionRows = await pullExistingLpPositionRows(bigQuery, currentTimestamp); // needs a type, check what's used for traders
  const marginEngineAddress: string = amm.marginEngineAddress.toLowerCase();
  const ammStartTimestampInMS: number = amm.termStartTimestampInMS;
  const currentTimestampInMS: number = currentTimestamp * 1000;
  const variableFactor: number = (await amm.variableFactor(
    ammStartTimestampInMS,
    currentTimestampInMS
  )).scaled;

  const tokenDecimals: number = amm.underlyingToken.decimals;
  const startTimestamp = ammStartTimestampInMS / 1000;
  const maturityTimestamp = amm.termEndTimestampInMS / 1000;
  const blockNumber = event.blockNumber;

  const {passiveSwapEvents, affectedLps} = await generatePassiveSwapEvents(
    {
      existingLpPositionRows,
      currentTimestamp,
      startTimestamp,
      maturityTimestamp,
      variableFactor,
      marginEngineAddress,
      tokenDecimals,
      blockNumber,
      chainId,
      rootSwapEvent,
      provider
    }
  );

  const lpPositionRows = await generateLpPositionRowsFromPassiveSwaps(
    {passiveSwapEvents, affectedLps, bigQuery, chainId, amm, currentTimestamp}
  );

  if (lpPositionRows.length === 0) { 
    // since the latest checkpoint, no lps were affected by passive swaps
    return;
  }

  const sqlTransactionQuery: string = generateLpPositionUpdatesQuery(lpPositionRows);

  const options = {
    query: sqlTransactionQuery,
    timeoutMs: 100000,
    useLegacySql: false,
  };

  await bigQuery.query(options);

  console.log(
    `Updated ${lpPositionRows.length} from passive swaps`,
  );

};
