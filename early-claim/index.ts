import { ethers, Event } from 'ethers';
import { writeFile } from 'node:fs/promises';
import fs from 'fs';
import { retry } from './lens';

require('dotenv').config();
const provider = new ethers.providers.AlchemyProvider(
  'matic',
  process.env.POLYGON_ALCHEMY_API_KEY
);

const main = async () => {
  const phiClaimAddr = '0x754e78bC0f7B487D304552810A5254497084970C';
  const LogClaimObjectAbi = [
    'event LogClaimObject(address indexed sender, uint256 tokenid)'
  ];
  const contract = new ethers.Contract(
    phiClaimAddr,
    LogClaimObjectAbi,
    provider
  );

  const currentBlock = await provider.getBlockNumber();
  const [start, end] = [35000000, currentBlock];
  console.log(
    `start getting LogGetQuestObject event blocknumber from ${start} to ${end}`
  );
  const sizeLimit = 1000;
  const eventRequests: Promise<Event[]>[] = [];
  for (let i = start; i < end; i += sizeLimit) {
    eventRequests.push(
      retry(
        () =>
          contract.queryFilter(
            contract.filters.LogClaimObject(),
            i,
            i + sizeLimit > end ? end : i + sizeLimit
          ),
        3
      )
    );
  }
  const events = (await Promise.all(eventRequests)).flat();
  console.log(`We got the number of events:${events.length}`);
  // const filteredEvent = events.filter((item) => {
  //   // console.log(item.args);
  //   return item.args?.sender && item.args?.tokenId;
  // });
  console.log(events[0]);
  // console.log(`filteredEvent Count: ${filteredEvent.length}`);
  const desiredData = events.map((item) => ({
    blockNumber: item.blockNumber,
    sender: item.args?.sender.toLowerCase(),
    tokenid: item.args?.tokenid.toNumber()
  }));

  const csv =
    'blocknumber,address,tokenid\n' +
    desiredData
      .map((data) => `${data.blockNumber},${data.sender},${data.tokenid}`)
      .join('\n');
  writeFile('./data.csv', csv);

  const result = new Map<number, string[]>();

  for (const data of desiredData) {
    if (!result.has(data.tokenid)) {
      result.set(data.tokenid, []);
    }
    const addresses = result.get(data.tokenid);
    if (addresses && addresses.length < 5) {
      addresses.push(data.sender);
    }
  }

  const output = [];
  for (const [tokenid, addresses] of result) {
    for (const address of addresses) {
      output.push(`${tokenid},${address}`);
    }
  }

  fs.writeFileSync('result.csv', output.join('\n'));
};

main();
