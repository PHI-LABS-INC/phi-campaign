import { ethers, Event } from "ethers";
import { writeFile } from "node:fs/promises";
import phiMapAbi from "./phiMapAbi";
import { getENSFromLandURL, retry } from "./helper";
import participants from "./participants.json" assert { type: "json" };

const phiMapAddr = "0xe8b6395d223C9D3D85e162f2cb2023bC9088a908";
const provider = new ethers.providers.AlchemyProvider("matic", process.env.POLYGON_ALCHEMY_API_KEY);
const contract = new ethers.Contract(phiMapAddr, phiMapAbi, provider);

const main = async () => {
  // 1. fetch all WriteLink events during the Kakusei event
  const [start, end] = [37216128, 37739389];
  const sizeLimit = 1000;
  const eventRequests: Promise<Event[]>[] = [];
  for (let i = start; i < end; i += sizeLimit) {
    eventRequests.push(retry(() => contract.queryFilter(contract.filters.WriteLink(), i, i + sizeLimit > end ? end : i + sizeLimit), 3));
  }
  const events = (await Promise.all(eventRequests)).flat();

  // 2. aggregate the events by ENS without duplicate
  const aggregateByENS: { [to: string]: { [from: string]: boolean } } = {};
  events.forEach((event) => {
    if (event?.args) {
      const ens = getENSFromLandURL(event.args.url);
      if (ens) {
        aggregateByENS[ens] = { ...aggregateByENS[ens], [event.args.name]: true };
      }
    }
  });

  // 3. sum and group them by address
  const aggregateByAddress: { [address: string]: number } = participants.reduce((prev, addr) => ({ ...prev, [addr]: 0 }), {});
  await Promise.all(
    Object.keys(aggregateByENS).map(async (ens) => {
      const addr = (await retry<string>(() => contract.ownerOfPhiland(ens.slice(0, -4)), 3)).toLowerCase();
      if (addr && aggregateByAddress[addr] !== undefined) {
        aggregateByAddress[addr] += Object.keys(aggregateByENS[ens]).length;
      }
    })
  ).catch((err) => {
    throw err;
  });

  // 4. output the results
  const ranking = Object.keys(aggregateByAddress)
    .map((address) => ({ address, score: aggregateByAddress[address] }))
    .sort((a, b) => b.score - a.score);
  const csv = "address,score\n" + ranking.map((ranking) => `${ranking.address},${ranking.score}`).join("\n");
  writeFile("./ranking.csv", csv);
};

main();
