type StablecoinAsset = 'USDC' | 'USDT';

export function getStablecoinDepositAddress(asset: StablecoinAsset): string {
  const key = asset === 'USDC'
    ? 'STABLECOIN_DEPOSIT_ADDRESS_BASE_USDC'
    : 'STABLECOIN_DEPOSIT_ADDRESS_BASE_USDT';
  const address = process.env[key];
  if (!address) {
    throw new Error(`Missing ${key} environment variable.`);
  }
  return address;
}

export function getStablecoinChain(): 'base' {
  return 'base';
}

