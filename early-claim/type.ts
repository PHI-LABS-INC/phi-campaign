import { BigNumber } from 'ethers';

export interface Score {
  address: string;
  score: number;
}
export interface CountedData {
  [profileId: string]: number;
}
export interface Data {
  [address: string]: BigNumber;
}
export interface CollectRecord {
  collector: string;
  profileId: BigNumber;
  pubid: BigNumber;
}

export interface UniqueRecord {
  collector: string;
  profileId: BigNumber;
}
