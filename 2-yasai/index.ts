import { ethers, Event } from 'ethers';
import { writeFile } from 'node:fs/promises';
import {
  checkNFTBalance,
  getCollectNFTAddress,
  getDefaultProfile
} from './lens';
import participants from './participants.json';
import { CountedData, Data, Score, UniqueRecord } from './type';

require('dotenv').config();
const provider = new ethers.providers.AlchemyProvider(
  'matic',
  process.env.POLYGON_ALCHEMY_API_KEY
);

const main = async () => {
  const defaultProfile: Data = participants.reduce(
    (prev, addr) => ({ ...prev, [addr]: '' }),
    {}
  );
  // 1. Retrieve the defaultProfile of a participant in yasai.
  await Promise.all(
    Object.keys(defaultProfile).map(async (address) => {
      const defaultProfileId = await getDefaultProfile(address);
      if (defaultProfileId) {
        defaultProfile[address] = defaultProfileId;
      }
    })
  ).catch((err) => {
    throw err;
  });

  // 2. Exclude addresses with no set defaultProfile from the calculation.
  const filteredParticipants: Data = Object.entries(defaultProfile).reduce(
    (acc: Data, [key, value]) => {
      if (!value.eq(0)) {
        acc[key] = value;
      }
      return acc;
    },
    {}
  );
  console.log('finish Participants-filtering by defaultProfile setting');
  console.log({ filteredParticipants });
  // 3. Fetch CollectNFTTransferred events during the Yasai event
  const lensLPPAddr = '0xDb46d1Dc155634FbC732f92E853b10B288AD5a1d';
  const CollectNFTTransferredAbi = [
    'event CollectNFTTransferred(uint256 indexed profileId, uint256 indexed pubId, uint256 indexed collectNFTId, address from, address to, uint256 timestamp)'
  ];
  const contract = new ethers.Contract(
    lensLPPAddr,
    CollectNFTTransferredAbi,
    provider
  );

  const currentBlock = await provider.getBlockNumber();
  const [start, end] = [37898365, currentBlock]; //Modify the start block after yasai has begun.
  console.log(
    `start getting collectNFT event blocknumber from ${start} to ${end}`
  );
  const sizeLimit = 1000;
  const eventRequests: Promise<Event[]>[] = [];
  for (let i = start; i < end; i += sizeLimit) {
    eventRequests.push(
      contract.queryFilter(
        contract.filters.CollectNFTTransferred(),
        i,
        i + sizeLimit > end ? end : i + sizeLimit
      )
    );
  }
  const events = (await Promise.all(eventRequests)).flat();
  console.log(`We got the number of events:${events.length}`);

  // 4.1 Filter the event by requiring
  // collected person is campaign participans.
  const filteredEvent = events.filter((item) => {
    return (
      item.args?.to &&
      item.args?.profileId &&
      item.args?.pubId &&
      // Object.keys(filteredParticipants).includes(item.args?.to.toLowerCase()) &&
      Object.values(filteredParticipants).some((val) =>
        val.eq(item.args?.profileId)
      )
    );
  });
  console.log(`filteredEvent Count: ${filteredEvent.length}`);

  // 4.2 Filter the event by requiring
  // collector person has lens profile for avoid direct collectNFT.
  const profileBalnceCheck = await Promise.all(
    filteredEvent.map(async (item) => {
      const checkProfileBalance = await checkNFTBalance(
        item.args?.to,
        '0xdb46d1dc155634fbc732f92e853b10b288ad5a1d'
      );
      return checkProfileBalance >= 1;
    })
  );
  const filtered2Event = filteredEvent.filter((_, i) => profileBalnceCheck[i]);
  console.log(`filtered2Event Count: ${filtered2Event.length}`);

  //5. Aggregate event where the three fields, to, profileId, and pubId are duplicated.
  const uniqueEventData = Array.from(
    new Set(
      filtered2Event.map((item) => {
        return {
          collector: item.args?.to,
          profileId: item.args?.profileId,
          pubid: item.args?.pubId
        };
      })
    )
  );
  console.log(`uniqueEventData Count: ${uniqueEventData.length}`);

  // 6. Verify if the address of the user (collector) who was the recipient has the collectNFT (profileId, pubId).
  const balanceCheck = await Promise.all(
    uniqueEventData.map(async (data) => {
      const nftBalance = await checkNFTBalance(
        data.collector,
        await getCollectNFTAddress(data.profileId, data.pubid)
      );
      return nftBalance >= 1;
    })
  );
  const filteredNFTData = uniqueEventData.filter((_, i) => balanceCheck[i]);
  console.log(`filteredNFTData Count: ${filteredNFTData.length}`);

  // 7. Exclude self-collections.
  const collectedUsers: Data = uniqueEventData.reduce(
    (prev, item) => ({ ...prev, [item.collector]: '' }),
    {}
  );

  await Promise.all(
    Object.keys(collectedUsers).map(async (address) => {
      const defaultProfileId = await getDefaultProfile(address);
      if (defaultProfileId) {
        collectedUsers[address] = defaultProfileId;
      }
    })
  ).catch((err) => {
    throw err;
  });

  const filteredData = filteredNFTData.filter((data) => {
    return (
      data.profileId.toHexString() !== // collected person (A)
      collectedUsers[data.collector].toHexString() // collector =: person (B) who collect (A)
    );
  });
  console.log(`filteredData Count: ${filteredData.length}`);

  //8. Prepare to measure the number of collections from unique addresses
  const desiredData: UniqueRecord[] = filteredData.map((item) => ({
    collector: item.collector,
    profileId: item.profileId
  }));
  const uniqueData = [
    ...new Set(
      desiredData.map((item) =>
        JSON.stringify({
          collector: item.collector,
          profileId: item.profileId.toHexString()
        })
      )
    )
  ].map((item) => JSON.parse(item));
  console.log(`uniqueData Count: ${uniqueData.length}`);

  // 9. Aggregated by profileId ex. { '0x010180': 2 }
  const countedData: CountedData = uniqueData.reduce(
    (result: CountedData, item: { profileId: string }) => {
      if (!result[item.profileId]) {
        result[item.profileId] = 0;
      }
      result[item.profileId] += 1;
      return result;
    },
    {}
  );
  console.log(countedData);
  // 10. Aggregated by address ex. { address: '0x5037e7747fAa78fc0ECF8DFC526DcD19f73076ce', score: 2 }
  const lensScore: Score[] = Object.entries(filteredParticipants).map(
    ([address, value]) => {
      return { address, score: countedData[value.toHexString()] || 0 };
    }
  );
  // 11. calc totalCollect
  const totalCollect = lensScore.reduce((acc, item) => acc + item.score, 0);
  console.log(totalCollect);
  // 12. create sorted lensscore
  lensScore.sort((a, b) => b.score - a.score);
  const csv =
    'address,score\n' +
    lensScore
      .map((ranking) => `${ranking.address},${ranking.score}`)
      .join('\n');
  writeFile('./ranking.csv', csv);
};

main();
