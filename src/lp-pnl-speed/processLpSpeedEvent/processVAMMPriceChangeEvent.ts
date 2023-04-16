import { BigQuery } from '@google-cloud/bigquery';

import {
  generateLpPositionUpdatesQuery,
  pullExistingLpPositionRows,
} from '../../big-query-support';
import { generateLpPositionRowsFromPassiveSwaps } from '../../lp-pnl/processPassiveSwapEvents/generateLpPositionRowsFromPassiveSwaps';
import { VAMMPriceChangeEventInfo } from '../../common/event-parsers';
import { gPassiveSwapEvents } from './gPassiveSwapEvents';


export const processVAMMPriceChangeEvent = async (
  bigQuery: BigQuery,
  priceChangeEventInfo: VAMMPriceChangeEventInfo,
): Promise<void> => {
  
  const existingLpPositionRows = await pullExistingLpPositionRows(
    bigQuery,
    priceChangeEventInfo.amm.id,
    priceChangeEventInfo.eventTimestamp,
  );

  const { passiveSwapEvents, affectedLps } = await gPassiveSwapEvents({
    existingLpPositionRows,
    amm: priceChangeEventInfo.amm,
    priceChangeEventInfo,
  });

  if (affectedLps.length === 0) {
    // since the latest checkpoint, no lps were affected by passive swaps
    return;
  }

  const lpPositionRows = await generateLpPositionRowsFromPassiveSwaps({
    passiveSwapEvents,
    affectedLps,
    chainId: priceChangeEventInfo.chainId,
    amm: priceChangeEventInfo.amm,
    eventTimestamp: priceChangeEventInfo.eventTimestamp,
    eventBlockNumber: priceChangeEventInfo.eventBlockNumber,
  });

  const sqlTransactionQuery = generateLpPositionUpdatesQuery(lpPositionRows);

  const options = {
    query: sqlTransactionQuery,
    timeoutMs: 100000,
    useLegacySql: false,
  };

  await bigQuery.query(options);
};
