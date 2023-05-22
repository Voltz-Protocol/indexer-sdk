/* eslint-disable @typescript-eslint/no-unsafe-member-access */ 
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { getBigQuery } from '../../../global';
import { BigQueryVoyageRow } from '../../types';

export const getVoyageBadges = async (
  chainId: number,
  ownerAddress: string,
): Promise<BigQueryVoyageRow[] | null> => {
  const bigQuery = getBigQuery();

  // queries

  const badgesQuery = `
        SELECT timestamp, chainId, ownerAddress

        FROM \`risk-monitoring-361911.voyage.badges\`
        
        WHERE (chainId=${chainId}) and (ownerAddress=\"${ownerAddress}\")
    `;

  // rows

  const [rows] = await bigQuery.query({
    query: badgesQuery,
  });

  if (rows === undefined || rows === null) {
    throw new Error('Failed query');
  }

  if (rows.length === 0) {
    return [
      {
        id: 'v2Voyage',
        timestamp: null,
      },
    ];
  }

  /* eslint-disable  @typescript-eslint/no-unsafe-member-access */

  return [
    {
      id: 'v2Voyage',
      timestamp: rows[0].timestamp,
    },
  ];
};
