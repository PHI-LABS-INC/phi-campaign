import { ethers } from "ethers";

const ensAddr = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";
const ensAbi = ["function owner(bytes32) view returns (address)"];
const mainnetProvider = new ethers.providers.AlchemyProvider("homestead", process.env.MAINNET_ALCHEMY_API_KEY);
const ensContract = new ethers.Contract(ensAddr, ensAbi, mainnetProvider);

const safeNamehash = (name: string) => {
  try {
    return ethers.utils.namehash(name);
  } catch {
    return null;
  }
};

const retry = async (f: () => Promise<any>, retries: number): Promise<any> => {
  try {
    return await f();
  } catch (err) {
    return retries > 0 ? retry(f, retries - 1) : Promise.reject(err);
  }
};

export const getEnsOwner = async (name: string): Promise<string | null> => {
  const namehash = safeNamehash(name);
  if (!namehash) return null;

  try {
    const addr = await retry(() => ensContract.owner(namehash), 3);
    return addr !== ethers.constants.AddressZero ? addr.toLowerCase() : null;
  } catch (err) {
    throw new Error(name, { cause: err });
  }
};

export const getENSFromlandURL = (url: string): string | null => {
  try {
    const u = new URL(url);
    if (u.origin !== "https://land.philand.xyz") throw new Error("invalid origin");
    if (!u.pathname.endsWith(".eth")) throw new Error("invalid pathname");
    return decodeURI(u.pathname.slice(1));
  } catch {
    return null;
  }
};
