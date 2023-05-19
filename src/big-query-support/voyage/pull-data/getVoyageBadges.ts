import { getBigQuery } from '../../../global';
import { BigQueryVoyageRow } from '../../types';

export const getVoyageBadges = async (chainId: number): Promise<BigQueryVoyageRow[] | null> => {
  const bigQuery = getBigQuery();

  // queries

  const badgesQuery = `
        SELECT timestamp, chainId, ownerAddress

        FROM \`risk-monitoring-361911.voyage.badges\`
        
        WHERE (chainId=${chainId})
    `;

  // rows

  const [rows] = await bigQuery.query({
    query: badgesQuery,
  });

  if (rows === undefined || rows === null || rows.length > 1) {
    throw new Error('Too many badges');
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
      timestamp: rows[0].timestamp * 1000,
    },
  ];
};
