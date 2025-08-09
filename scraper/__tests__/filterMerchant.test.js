const { getAdjacentMerchants } = require('../filterMerchant');

describe('getAdjacentMerchants', () => {
  const merchants = [
    { 'Merchant Name': 'a' },
    { 'Merchant Name': 'b' },
    { 'Merchant Name': 'c' },
  ];

  it('returns empty when not found', () => {
    expect(getAdjacentMerchants(merchants, 'x')).toEqual([]);
  });

  it('returns target and neighbors when in middle', () => {
    expect(getAdjacentMerchants(merchants, 'b')).toEqual([
      { 'Merchant Name': 'a' },
      { 'Merchant Name': 'b' },
      { 'Merchant Name': 'c' },
    ]);
  });

  it('handles first element', () => {
    expect(getAdjacentMerchants(merchants, 'a')).toEqual([
      { 'Merchant Name': 'a' },
      { 'Merchant Name': 'b' },
    ]);
  });

  it('handles last element', () => {
    expect(getAdjacentMerchants(merchants, 'c')).toEqual([
      { 'Merchant Name': 'b' },
      { 'Merchant Name': 'c' },
    ]);
  });
});
