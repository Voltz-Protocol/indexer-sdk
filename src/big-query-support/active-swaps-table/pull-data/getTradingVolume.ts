import { BigQueryInt } from '@google-cloud/bigquery';

import { dollarAggregate } from '../../../api/common/dollarAggregate';
import { GECKO_KEY } from '../../../common/constants';
import { getBigQuery } from '../../../global';
import { bqNumericToNumber, getTableFullID } from '../../utils';

/**
 Get trading volume over last 30 days on given chain
 */
export const getChainTradingVolume = async (chainIds: number[]): Promise<number> => {
  const bigQuery = getBigQuery();

  const volumeQuery = `
    SELECT underlyingToken, sum(abs(variableTokenDelta)) as amount
      FROM \`${getTableFullID('active_swaps')}\`
          
      WHERE (eventTimestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)) AND 
            (chainId IN (${chainIds.join(',')}))
          
      GROUP BY underlyingToken
  `;

  const options = {
    query: volumeQuery,
  };

  const [rows] = await bigQuery.query(options);

  if (!rows || rows.length === 0) {
    return 0;
  }

  const parsedRows = rows.map((row: { underlyingToken: string; amount: BigQueryInt }) => ({
    underlyingToken: row.underlyingToken,
    amount: bqNumericToNumber(row.amount),
  }));

  const volume30DayInDollars = await dollarAggregate(parsedRows, GECKO_KEY);

  return volume30DayInDollars;
};
