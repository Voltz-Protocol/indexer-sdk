import { getBigQuery } from '../../../global';
import { mapToBigQueryPositionRow } from '../../mappers';
import { BigQueryPositionRow } from '../../types';
import { getTableFullID } from '../../utils';

export type TrackedBigQueryPositionRow = {
  position: BigQueryPositionRow;
  added: boolean;
  modified: boolean;
};

export const pullAllPositions = async (): Promise<TrackedBigQueryPositionRow[]> => {
  const bigQuery = getBigQuery();

  const sqlQuery = `
    SELECT * FROM \`${getTableFullID('positions')}\` 
  `;

  const options = {
    query: sqlQuery,
  };

  const [rows] = await bigQuery.query(options);

  if (!rows || rows.length === 0) {
    return [];
  }

  const lpPositionRows = rows.map(
    (row): TrackedBigQueryPositionRow => ({
      position: mapToBigQueryPositionRow(row),
      added: false,
      modified: false,
    }),
  );

  return lpPositionRows;
};
