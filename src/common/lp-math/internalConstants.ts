import JSBI from 'jsbi'


export const Q96 = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(96));
export const Q192 = JSBI.exponentiate(Q96, JSBI.BigInt(2));
export const ZERO = JSBI.BigInt(0);
export const ONE = JSBI.BigInt(1);
export const NEGATIVE_ONE = JSBI.BigInt(-1);
export const MaxUint256 = JSBI.BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'); 