import JSBI from 'jsbi';

import { FullMath } from './fullMath';
import { NEGATIVE_ONE, ONE, Q96, ZERO } from './internalConstants';
import { TickMath } from './tickMath';

export type PassiveTokenDeltas = {
  variableTokenDelta: number; // big int (no decimals)
  fixedTokenDeltaUnbalanced: number; // big int (no decimals)
  variableTokenDeltaString: string; // big int (no decimals)
  fixedTokenDeltaUnbalancedString: string;  // big int (no decimals)
};

const getAmount0Delta = (
  sqrtRatioAX96: JSBI,
  sqrtRatioBX96: JSBI,
  liquidity: JSBI,
  roundUp: boolean,
): JSBI => {
  if (JSBI.greaterThan(sqrtRatioAX96, sqrtRatioBX96)) {
    [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
  }

  const numerator1 = JSBI.leftShift(liquidity, JSBI.BigInt(96));
  const numerator2 = JSBI.subtract(sqrtRatioBX96, sqrtRatioAX96);

  return roundUp
    ? FullMath.mulDivRoundingUp(
        FullMath.mulDivRoundingUp(numerator1, numerator2, sqrtRatioBX96),
        ONE,
        sqrtRatioAX96,
      )
    : JSBI.divide(JSBI.divide(JSBI.multiply(numerator1, numerator2), sqrtRatioBX96), sqrtRatioAX96);
};

const getAmount1Delta = (
  sqrtRatioAX96: JSBI,
  sqrtRatioBX96: JSBI,
  liquidity: JSBI,
  roundUp: boolean,
): JSBI => {
  if (JSBI.greaterThan(sqrtRatioAX96, sqrtRatioBX96)) {
    [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
  }

  return roundUp
    ? FullMath.mulDivRoundingUp(liquidity, JSBI.subtract(sqrtRatioBX96, sqrtRatioAX96), Q96)
    : JSBI.divide(JSBI.multiply(liquidity, JSBI.subtract(sqrtRatioBX96, sqrtRatioAX96)), Q96);
};

/*
    current price > previous price =>
    current fixed rate < previous fixed rate =>
    latest swap by the taker was a fixed taker swap
    since the lp is taking the opposite side, they are
    passively a variable taker, otherwise fixed taker
*/

export const decimalNumberToJSBI = (decimalNumber: number): {
  numberJSBI: JSBI;
  precision: number; 
} => { 

  const integerAndDecimalParts: string[] = decimalNumber.toString().split('.');
  const precision: number = integerAndDecimalParts[1].length;
  const numberNoDecimals: number = Number(integerAndDecimalParts.join('')); 
  const numberJSBI: JSBI = JSBI.BigInt(numberNoDecimals);

  return {numberJSBI, precision}
}

export const iaVariableTakerSwap = (tickCurrent: number, tickPrevious: number) => {
  if (tickCurrent > tickPrevious) {
    return true;
  }
  return false;
};

// todo: this function can be simplified
export const calculatePassiveTokenDeltas = (
  liquidity: number,
  tickUpper: number,
  tickLower: number,
  tickCurrent: number,
  tickPrevious: number,
): PassiveTokenDeltas => {
  let variableTokenDelta: JSBI = ZERO;
  let fixedTokenDeltaUnbalanced: JSBI = ZERO;
  const { numberJSBI: liquidityJSBI }  = decimalNumberToJSBI(liquidity);
  let sqrtRatioA96: JSBI;
  let sqrtRatioB96: JSBI;

  const isVT: boolean = iaVariableTakerSwap(tickCurrent, tickPrevious);
  console.log(`Calculating passive token deltas`); 
  console.log(`tickPrevious: ${tickPrevious}, tickCurrent: ${tickCurrent}`); 
  console.log(`tickLower: ${tickLower}, tickUpper: ${tickUpper}`); 

  if (tickPrevious < tickLower) {
    if (tickCurrent < tickLower) {
      // lp is not affected by this trade
      return {
        variableTokenDelta: 0,
        fixedTokenDeltaUnbalanced: 0,
        variableTokenDeltaString: '0',
        fixedTokenDeltaUnbalancedString: '0',
      };
    } else if (tickCurrent >= tickLower && tickCurrent < tickUpper) {
      sqrtRatioA96 = TickMath.getSqrtRatioAtTick(tickLower);
      sqrtRatioB96 = TickMath.getSqrtRatioAtTick(tickCurrent);
    } else {
      // i.e. > tickUpper
      sqrtRatioA96 = TickMath.getSqrtRatioAtTick(tickLower);
      sqrtRatioB96 = TickMath.getSqrtRatioAtTick(tickUpper);
    }
  } else if (tickPrevious < tickUpper) {
    if (tickCurrent < tickLower) {
      sqrtRatioA96 = TickMath.getSqrtRatioAtTick(tickLower);
      sqrtRatioB96 = TickMath.getSqrtRatioAtTick(tickPrevious);
    } else if (tickCurrent >= tickLower && tickCurrent < tickUpper) {
      sqrtRatioA96 = TickMath.getSqrtRatioAtTick(tickPrevious);
      sqrtRatioB96 = TickMath.getSqrtRatioAtTick(tickCurrent);
    } else {
      sqrtRatioA96 = TickMath.getSqrtRatioAtTick(tickPrevious);
      sqrtRatioB96 = TickMath.getSqrtRatioAtTick(tickUpper);
    }
  } else {
    // tickPrevious > tickUpper
    if (tickCurrent < tickLower) {
      sqrtRatioA96 = TickMath.getSqrtRatioAtTick(tickLower);
      sqrtRatioB96 = TickMath.getSqrtRatioAtTick(tickUpper);
    } else if (tickCurrent >= tickLower && tickCurrent < tickUpper) {
      sqrtRatioA96 = TickMath.getSqrtRatioAtTick(tickCurrent);
      sqrtRatioB96 = TickMath.getSqrtRatioAtTick(tickUpper);
    } else {
      // lp is not affected by this trade
      return {
        variableTokenDelta: 0,
        fixedTokenDeltaUnbalanced: 0,
        variableTokenDeltaString: '0',
        fixedTokenDeltaUnbalancedString: '0',
      };
    }
  }

  // todo: check if round up needs to be true or false when running sims and tests
  variableTokenDelta = getAmount1Delta(
    sqrtRatioA96,
    sqrtRatioB96,
    isVT ? liquidityJSBI : JSBI.multiply(NEGATIVE_ONE, liquidityJSBI),
    true,
  );

  // todo: check if round up needs to be true or false when running sims and tests
  fixedTokenDeltaUnbalanced = getAmount0Delta(
    sqrtRatioA96,
    sqrtRatioB96,
    isVT ? JSBI.multiply(NEGATIVE_ONE, liquidityJSBI) : liquidityJSBI,
    true,
  );

  // todo: check if precision is maintained after conversion to number
  return {
    variableTokenDelta: JSBI.toNumber(variableTokenDelta),
    fixedTokenDeltaUnbalanced: JSBI.toNumber(fixedTokenDeltaUnbalanced),
    variableTokenDeltaString: variableTokenDelta.toString(),
    fixedTokenDeltaUnbalancedString: fixedTokenDeltaUnbalanced.toString(),
  };
};
