import { BigNumber, ethers } from 'ethers';

export const retry = async <T>(
  f: () => Promise<T>,
  retries: number
): Promise<T> => {
  try {
    return await f();
  } catch (err) {
    return retries > 0 ? retry(f, retries - 1) : Promise.reject(err);
  }
};

export const getDefaultProfile = async (addr: string): Promise<BigNumber> => {
  const lensProfileAddress = '0xdb46d1dc155634fbc732f92e853b10b288ad5a1d';
  const ContractABI = [
    'function defaultProfile(address wallet) external view returns (uint256)'
  ];
  let profileId;
  const provider = new ethers.providers.AlchemyProvider(
    'matic',
    process.env.POLYGON_ALCHEMY_API_KEY
  );
  const contract = new ethers.Contract(
    lensProfileAddress,
    ContractABI,
    provider
  );
  try {
    return (profileId = await contract.defaultProfile(addr));
  } catch (e) {
    console.log('defaultProfile call failed', e);
    throw e;
  }
};

export const getCollectNFTAddress = async (
  profileId: BigNumber,
  pubId: BigNumber
): Promise<string> => {
  const lensProfileAddress = '0xdb46d1dc155634fbc732f92e853b10b288ad5a1d';
  const ContractABI = [
    'function getCollectNFT(uint256 profileId, uint256 pubId) external view returns (address)'
  ];
  let contractAddress;
  const provider = new ethers.providers.AlchemyProvider(
    'matic',
    process.env.POLYGON_ALCHEMY_API_KEY
  );
  const contract = new ethers.Contract(
    lensProfileAddress,
    ContractABI,
    provider
  );

  try {
    return (contractAddress = await contract.getCollectNFT(profileId, pubId));
  } catch (e) {
    console.log('getCollectNFTcall failed', e);
    throw e;
  }
};

export const checkNFTBalance = async (
  collectorAddress: string,
  contractAddress: string
) => {
  const ContractABI = ['function balanceOf(address) view returns (uint)'];
  const provider = new ethers.providers.AlchemyProvider(
    'matic',
    process.env.POLYGON_ALCHEMY_API_KEY
  );
  let counter = 0;
  const contract = new ethers.Contract(contractAddress, ContractABI, provider);
  try {
    return (counter = await retry(
      () => contract.balanceOf(collectorAddress),
      3
    ));
  } catch (e) {
    console.log('balanceOf failed', e);
    throw e;
  }
};
