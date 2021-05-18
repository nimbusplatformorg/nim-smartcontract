function mockWeightedStakeDate(
  balance,
  amount,
  prevWeightStakeDate,
  timestamp
) {
  return prevWeightStakeDate
    .mul(balance)
    .div(amount.add(balance))
    .add(timestamp.mul(amount).div(amount.add(balance)));
}

function mockAmoutsOut(reserves, amountIn) {
  return amountIn
    .muln(997)
    .mul(reserves[1])
    .div(reserves[0].muln(1000).add(amountIn.muln(997)));
}

function mockCurrentLPPrice(
  totalSupply,
  reservesA,
  reservesB,
  reservesLP,
  decimals
) {
  let tokenAToRewardPrice = mockAmoutsOut(reservesA, new BN(10 ** 6));
  let tokenBToRewardPrice = mockAmoutsOut(reservesB, new BN(10 ** 6));
  // if (decimals.tokenADecimalCompensate > 0) {
  //   tokenAToRewardPrice = tokenAToRewardPrice.mul(
  //     new BN(10).pow(decimals.tokenADecimalCompensate)
  //   );
  // }
  // if (decimals.tokenBDecimalCompensate > 0) {
  //   tokenBToRewardPrice = tokenBToRewardPrice.mul(
  //     new BN(10).pow(decimals.tokenBDecimalCompensate)
  //   );
  // }
  const r = reservesLP[0].mul(reservesLP[1]).toRed(red);
  const p = tokenAToRewardPrice.mul(tokenBToRewardPrice).toRed(red);
  return new BN(2)
    .mul(r.redSqrt().fromRed())
    .mul(p.redSqrt().fromRed())
    .div(totalSupply);
}

async function mockSwap(contract, token, feeAmount, recipient) {
  await token.transfer(contract.address, feeAmount);
  return await contract.recordFee(token.address, recipient, feeAmount);
}

module.exports = {
  mockAmoutsOut,
  mockCurrentLPPrice,
  mockWeightedStakeDate,
  mockSwap,
};
