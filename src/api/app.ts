import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

import { getChainTradingVolume } from '../big-query-support/active-swaps-table/pull-data/getTradingVolume';
import { getFixedRates } from '../big-query-support/historical-rates/pull-data/getFixedRates';
import { getVariableRates } from '../big-query-support/historical-rates/pull-data/getVariableRates';
import { getChainTotalLiquidity } from '../big-query-support/mints-and-burns-table/pull-data/getTotalLiquidity';
import { pullAllChainPools } from '../big-query-support/pools-table/pull-data/pullAllChainPools';
import { pullExistingPoolRow } from '../big-query-support/pools-table/pull-data/pullExistingPoolRow';
import { SDKVoyage } from '../big-query-support/types';
import { getVoyageBadges } from '../big-query-support/voyage/pull-data/getVoyageBadges';
import { getWalletVoyages } from '../big-query-support/voyage/pull-data/getVoyageBadgesV1';
import { getVoyages } from '../big-query-support/voyage/pull-data/getVoyages';
import { getRedisClient, getTrustedProxies } from '../global';
import { getPortfolioPositions } from './portfolio-positions/getPortfolioPositions';
import { getPositionPnL } from './position-pnl/getPositionPnL';
import { getPositionTxHistory } from './position-tx-history/getPositionTxHistory';

export const app = express();

app.use(cors());

app.set('trust proxy', getTrustedProxies());

// Create and use the rate limiter
const limiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 1000, // Limit each IP to 1000 requests per `window` (here, per 5 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers

  // Redis store configuration
  store: new RedisStore({
    // @ts-expect-error - Known issue: the `call` function is not present in @types/ioredis
    sendCommand: (...args: string[]) => getRedisClient().call(...args),
  }),
});

app.use(limiter);

app.get('/', (_, res) => {
  res.send('Welcome to Voltz API');
});

app.get('/ip', (req, res) => {
  res.send(req.ip);
});

app.get('/pool/:chainId/:vammAddress', (req, res) => {
  const process = async () => {
    const chainId = Number(req.params.chainId);
    const vammAddress = req.params.vammAddress.toLowerCase();

    const pool = await pullExistingPoolRow(vammAddress, chainId);

    if (!pool) {
      throw new Error(`Pool ${vammAddress} does not exist on chain ${chainId}.`);
    }

    return pool;
  };

  process().then(
    (output) => {
      res.json(output);
    },
    (error) => {
      console.log(`API query failed with message ${(error as Error).message}`);
    },
  );
});

app.get('/chain-information/:chainIds', (req, res) => {
  const process = async () => {
    const chainIds = req.params.chainIds.split('&').map((s) => Number(s));

    const response = await Promise.allSettled([
      getChainTradingVolume(chainIds),
      getChainTotalLiquidity(chainIds),
    ]);

    if (response[0].status === 'rejected' || response[1].status === 'rejected') {
      throw new Error(`Couldn't fetch chain information.`);
    }

    return {
      volume30Day: response[0].value,
      totalLiquidity: response[1].value,
    };
  };

  process().then(
    (output) => {
      res.json(output);
    },
    (error) => {
      console.log(`API query failed with message ${(error as Error).message}`);
    },
  );
});

app.get('/all-pools/:chainIds', (req, res) => {
  const process = async () => {
    const chainIds = req.params.chainIds.split('&').map((s) => Number(s));

    const pools = await pullAllChainPools(chainIds);

    return pools;
  };

  process().then(
    (output) => {
      res.json(output);
    },
    (error) => {
      console.log(`API query failed with message ${(error as Error).message}`);
    },
  );
});

app.get('/portfolio-positions/:chainIds/:ownerAddress', (req, res) => {
  const chainIds = req.params.chainIds.split('&').map((s) => Number(s));
  const ownerAddress = req.params.ownerAddress;

  getPortfolioPositions(chainIds, ownerAddress).then(
    (output) => {
      res.json(output);
    },
    (error) => {
      console.log(`API query failed with message ${(error as Error).message}`);
    },
  );
});

app.get(
  '/position-tx-history/:chainId/:vammAddress/:ownerAddress/:tickLower/:tickUpper',
  (req, res) => {
    const chainId = Number(req.params.chainId);
    const vammAddress = req.params.vammAddress;
    const ownerAddress = req.params.ownerAddress;
    const tickLower = Number(req.params.tickLower);
    const tickUpper = Number(req.params.tickUpper);

    getPositionTxHistory(chainId, vammAddress, ownerAddress, tickLower, tickUpper).then(
      (output) => {
        res.json(output);
      },
      (error) => {
        console.log(`API query failed with message ${(error as Error).message}`);
      },
    );
  },
);

// todo: deprecate when SDK stops consuming it
app.get('/position-pnl/:chainId/:vammAddress/:ownerAddress/:tickLower/:tickUpper', (req, res) => {
  const chainId = Number(req.params.chainId);
  const vammAddress = req.params.vammAddress;
  const ownerAddress = req.params.ownerAddress;
  const tickLower = Number(req.params.tickLower);
  const tickUpper = Number(req.params.tickUpper);

  getPositionPnL(chainId, vammAddress, ownerAddress, tickLower, tickUpper).then(
    (output) => {
      res.json(output);
    },
    (error) => {
      console.log(`API query failed with message ${(error as Error).message}`);
    },
  );
});

app.get('/fixed-rates/:chainId/:vammAddress/:startTimestamp/:endTimestamp', (req, res) => {
  console.log(`Requesting information about historical fixed rates`);

  const process = async () => {
    const chainId = Number(req.params.chainId);
    const vammAddress = req.params.vammAddress;
    const startTimestamp = Number(req.params.startTimestamp);
    const endTimestamp = Number(req.params.endTimestamp);

    const historicalRates = await getFixedRates(chainId, vammAddress, startTimestamp, endTimestamp);

    return historicalRates;
  };

  process().then(
    (output) => {
      res.json(output);
    },
    (error) => {
      console.log(`API query failed with message ${(error as Error).message}`);
    },
  );
});

app.get('/variable-rates/:chainId/:rateOracleAddress/:startTimestamp/:endTimestamp', (req, res) => {
  console.log(`Requesting information about historical variable rates`);

  const process = async () => {
    const chainId = Number(req.params.chainId);
    const rateOracleAddress = req.params.rateOracleAddress;
    const startTimestamp = Number(req.params.startTimestamp);
    const endTimestamp = Number(req.params.endTimestamp);

    const historicalRates = await getVariableRates(
      chainId,
      rateOracleAddress,
      startTimestamp,
      endTimestamp,
    );

    return historicalRates;
  };

  process().then(
    (output) => {
      res.json(output);
    },
    (error) => {
      console.log(`API query failed with message ${(error as Error).message}`);
    },
  );
});

app.get('/voyage/:chainId/:ownerAddress', (req, res) => {
  console.log(`Requesting information about Voyage Badges`);

  const process = async () => {
    const ownerAddress = req.params.ownerAddress.toLowerCase();
    const result = await getVoyageBadges(ownerAddress);

    return result;
  };

  process().then(
    (output) => {
      res.json(output);
    },
    (error) => {
      console.log(`API query failed with message ${(error as Error).message}`);
    },
  );
});

app.get('/voyage-V1/:chainId/:walletAddress', (req, res) => {
  console.log(`Requesting information about Voyage Badges`);

  const process = async () => {
    const voyages = await getVoyages();

    const chainId = Number(req.params.chainId);
    const walletAddress = req.params.walletAddress.toLowerCase();
    const walletVoyages = await getWalletVoyages(chainId, walletAddress);

    const result: SDKVoyage[] = [];
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const inTransitPeriod = 3 * 60 * 60; // 3 hours

    for (const voyage of voyages) {
      let status: 'achieved' | 'notAchieved' | 'notStarted' | 'inProgress';
      let timestampInMS: number | null = null;
      if (currentTimestamp < voyage.startTimestamp) {
        status = 'notStarted';
      } else if (currentTimestamp < voyage.endTimestamp + inTransitPeriod) {
        status = 'inProgress';
      } else if (!walletVoyages.includes(voyage.id)) {
        status = 'notAchieved';
      } else {
        status = 'achieved';
        timestampInMS = voyage.endTimestamp * 1000;
      }

      result.push({
        id: voyage.id,
        status,
        timestamp: timestampInMS,
      });
    }

    return result;
  };

  process().then(
    (output) => {
      res.json(output);
    },
    (error) => {
      console.log(`API query failed with message ${(error as Error).message}`);
    },
  );
});
