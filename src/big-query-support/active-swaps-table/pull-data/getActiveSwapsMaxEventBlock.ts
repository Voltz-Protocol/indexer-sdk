/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { getBigQuery } from '../../../global';
import { getTableFullID } from '../../utils';

/**
 Get maximum event block number per vamm
 */
export const getActiveSwapsMaxEventBlock = async (
  vammAddress: string,
  chainId: number,
): Promise<number | null> => {
  const bigQuery = getBigQuery();

  const volumeQuery = `
    SELECT MAX(eventBlockNumber) as amount
      FROM \`${getTableFullID('active_swaps')}\`
      WHERE (vammAddress=\"${vammAddress}\") AND (chainId=${chainId});
  `;

  const options = {
    query: volumeQuery,
  };

  const [rows] = await bigQuery.query(options);

  if (!rows || rows.length === 0 || !rows[0].amount) {
    return null;
  }

  return rows[0].amount as number;
};
