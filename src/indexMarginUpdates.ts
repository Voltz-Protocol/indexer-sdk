import { createMarginUpdatesTable } from './big-query-support/margin-updates-table/createActiveSwapsTable';
import { sleep } from './common/utils';
import { authenticateImplicitWithAdc, chainIds, indexInactiveTimeInMS } from './global';
import { syncMarginUpdates } from './margin-updates/syncMarginUpdate';

export const main = async () => {
  await authenticateImplicitWithAdc();
  await createMarginUpdatesTable();

  while (true) {
    try {
      await syncMarginUpdates(chainIds);
    } catch (error) {
      console.log(
        `[Margin Updates]: Loop has failed with message: ${
          (error as Error).message
        }.  It will retry...`,
      );
    }

    await sleep(indexInactiveTimeInMS);
  }
};

main()
  .then(() => {
    console.log('[Margin Updates]: Execution completed.');
  })
  .catch((error) => {
    console.log(`[Margin Updates]: Error encountered. ${(error as unknown as Error).message}`);
  });
