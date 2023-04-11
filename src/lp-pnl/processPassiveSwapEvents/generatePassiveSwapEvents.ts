

import { SwapEventInfo } from '../../common/swaps/parseSwapEvent';
import { BigQueryPositionRow } from '../../big-query-support';
import { getOnChainFixedAndVariableTokenBalances } from './getOnChainFixedAndVariableTokenBalances';
import { generatePassiveSwapEvent } from './generatePassiveSwapEvent';

export type GeneratePassiveSwapEventsArgs = {

    existingLpPositionRows: BigQueryPositionRow[],
    currentTimestamp: number,
    startTimestamp: number,
    maturityTimestamp: number,
    variableFactor: number,
    marginEngineAddress: string,
    tokenDecimals: number,
    blockNumber: number,
    chainId: number,
    rootSwapEvent: SwapEventInfo

}

export type GeneratePassiveSwapEventsReturn = {
    passiveSwapEvents: SwapEventInfo[], 
    affectedLps: BigQueryPositionRow[]
}

export const generatePassiveSwapEvents = async ({
    existingLpPositionRows,
    currentTimestamp,
    startTimestamp,
    maturityTimestamp,
    variableFactor,
    marginEngineAddress,
    tokenDecimals,
    blockNumber,
    chainId,
    rootSwapEvent
}: GeneratePassiveSwapEventsArgs): Promise<GeneratePassiveSwapEventsReturn> => {

    let passiveSwapEvents: SwapEventInfo[] = [];
    let affectedLps: BigQueryPositionRow[] = [];

    for (let i=0; i < existingLpPositionRows.length; i++) { 

        const positionRow: BigQueryPositionRow  = existingLpPositionRows[i];
        const lastUpdatedTimestampLP: number = positionRow.lastUpdatedTimestamp;
        const isInFuture: boolean = lastUpdatedTimestampLP > currentTimestamp;

        if (!isInFuture) { 

            const cachedVariableTokenBalance: number = positionRow.variableTokenBalance;
            const cachedFixedTokenBalance: number = positionRow.fixedTokenBalance;
            const ownerAddress: string = positionRow.ownerAddress;
            const tickLower: number = positionRow.tickLower; 
            const tickUpper: number = positionRow.tickUpper;

            // todo: get back once implementation is ready
            const {onChainVariableTokenBalance, onChainFixedTokenBalance} = await getOnChainFixedAndVariableTokenBalances();

            const cachedAndOnChainVariableTokenBalanceMatch = cachedVariableTokenBalance === onChainVariableTokenBalance;    
            const cachedAndOnChainFixedTokenBalanceMatch = cachedFixedTokenBalance === onChainFixedTokenBalance;

            if (cachedAndOnChainVariableTokenBalanceMatch && cachedAndOnChainFixedTokenBalanceMatch) {
                console.log(`Variable and Fixed Token Balances match, no need for passive swap`); 
            } else {
                const passiveSwap: SwapEventInfo = generatePassiveSwapEvent(
                    {
                        cachedVariableTokenBalance,
                        cachedFixedTokenBalance,
                        onChainVariableTokenBalance,
                        onChainFixedTokenBalance, 
                        chainId,
                        ownerAddress,
                        tickLower,
                        tickUpper,
                        currentTimestamp,
                        startTimestamp,
                        maturityTimestamp,
                        variableFactor,
                        rootSwapEvent
                    }
                );
                passiveSwapEvents.push(passiveSwap);
                affectedLps.push(positionRow); 
            }

        } else {
            console.log(`this lp position was initialized in the future relative to event`);
        }


    }
    
    
    return {passiveSwapEvents, affectedLps};

}