const fs = require("fs");
const readline = require("readline");

// Function to process each line of the JSON file
async function processFile(
  inputFilePath,
  outputFilePath,
  usersUniqueIdsPath,
  channelsUniqueIdsPath
) {
  const readStream = fs.createReadStream(inputFilePath);
  const rl = readline.createInterface({
    input: readStream,
    crlfDelay: Infinity,
  });

  if (!fs.existsSync(outputFilePath)) {
    fs.writeFileSync(outputFilePath, "[]");
  }

  // check if usersUniqueIdsPath and channelsUniqueIdsPath exist
  if (!fs.existsSync(usersUniqueIdsPath)) {
    fs.writeFileSync(usersUniqueIdsPath, "{}");
  }
  if (!fs.existsSync(channelsUniqueIdsPath)) {
    fs.writeFileSync(channelsUniqueIdsPath, "{}");
  }

  // Map to store unique user IDs
  const addedUserIds = new Map(
    objectToMap(JSON.parse(fs.readFileSync(usersUniqueIdsPath, "utf8")))
  );
  // Map to store unique channel IDs
  const addedChannelIds = new Map(
    objectToMap(JSON.parse(fs.readFileSync(channelsUniqueIdsPath, "utf8")))
  );

  let outputData = JSON.parse(fs.readFileSync(outputFilePath, "utf8"));

  let lineCount = 0;
  let messageCount = 0;

  let singleMessageEntity = "";

  for await (const line of rl) {
    lineCount++;
    if (line.trim() === "[" || line.trim() === "]") continue; // Skip array brackets and commas

    if (line.trim().startsWith("{")) {
      singleMessageEntity = line.trim();
      continue;
    }
    if (line.trim().startsWith("}")) {
      singleMessageEntity += "}";
      try {
        const obj = JSON.parse(singleMessageEntity);
        // user add
        if (!addedUserIds.has(obj["Sender ID"])) {
          const userObject = {
            type: "user",
            item: {
              id: obj["Sender ID"],
              name: obj.Sender,
              created_at: parseDateString(obj["Sent at"]),
              role: "moderator",
              invisible: false,
            },
          };
          outputData.push(userObject);
          addedUserIds.set(obj["Sender ID"], true);
        }
        // group/channel add
        if (!addedChannelIds.has(obj["Receiver ID"])) {
          const channelObject = {
            type: "channel",
            item: {
              id: obj["Receiver ID"],
              type: "messaging",
              created_by: obj["Sender ID"],
            },
          };
          outputData.push(channelObject);
          addedChannelIds.set(obj["Receiver ID"], []);
        }
        // member add
        if (
          !addedChannelIds.get(obj["Receiver ID"]).includes(obj["Sender ID"])
        ) {
          const memberObject = {
            type: "member",
            item: {
              channel_type: "messaging",
              channel_id: obj["Receiver ID"],
              user_id: obj["Sender ID"],
              created_at: parseDateString(obj["Sent at"]),
            },
          };
          outputData.push(memberObject);
          addedChannelIds.get(obj["Receiver ID"]).push(obj["Sender ID"]);
        }
        // message add
        const messageObject = {
          type: "message",
          item: {
            id: generateUUIDv4(),
            channel_type: "messaging",
            channel_id: obj["Receiver ID"],
            type: "regular",
            user: obj["Sender ID"],
            text: obj.Chat,
            created_at: parseDateString(obj["Sent at"]),
          },
        };
        outputData.push(messageObject);
        messageCount++;
        if (messageCount % 1000 === 0)
          console.log(`Processed ${messageCount} messages.`);
      } catch (e) {
        console.error(`Failed to parse JSON on line ${lineCount}:`, e);
      }
      singleMessageEntity = "";
      continue;
    }

    singleMessageEntity += line.trim();
  }

  outputData.forEach((obj) => {
    if (obj.type === "channel") {
      obj.item.member_ids = addedChannelIds.get(obj.item.id);
      delete obj.item.id;
    }
    if (obj.type === "message") {
      obj.item.channel_member_ids = addedChannelIds.get(obj.item.channel_id);
      delete obj.item.channel_id;
    }
    if (obj.type === "member") {
      obj.item.channel_member_ids = addedChannelIds.get(obj.item.channel_id);
      delete obj.item.channel_id;
    }
  });

  outputData = outputData.filter((obj) => {
    if (obj.type === "channel") {
      if (obj.item.member_ids.length <= 1) {
        return false;
      }
    }
    if (obj.type === "message") {
      if (obj.item.channel_member_ids.length <= 1) {
        return false;
      }
    }
    if (obj.type === "member") {
      if (obj.item.channel_member_ids.length <= 1) {
        return false;
      }
    }
    return true;
  });
  // sort based on types 1. user 2. channel 3. member 4. message
  // outputData.sort((a, b) => {
  //   if (a.type === b.type) {
  //     return 0;
  //   }
  //   if (a.type === "user") {
  //     return -1;
  //   }
  //   if (b.type === "user") {
  //     return 1;
  //   }
  //   if (a.type === "channel") {
  //     return -1;
  //   }
  //   if (b.type === "channel") {
  //     return 1;
  //   }
  //   if (a.type === "member") {
  //     return -1;
  //   }
  //   if (b.type === "member") {
  //     return 1;
  //   }
  //   if (a.type === "message") {
  //     return -1;
  //   }
  //   if (b.type === "message") {
  //     return 1;
  //   }
  // });

  // Write the result to the output file
  fs.writeFileSync(outputFilePath, JSON.stringify(outputData, null, 2));
  console.log(
    `Processed ${outputData.length} documents. Data written to ${outputFilePath}`
  );
  // Write the user ids to the file
  fs.writeFileSync(
    usersUniqueIdsPath,
    JSON.stringify(mapToObject(addedUserIds), null, 2)
  );
  console.log(
    `Processed ${addedUserIds.size} users. Data written to ${usersUniqueIdsPath}`
  );
  // Write the channel ids to the file
  fs.writeFileSync(
    channelsUniqueIdsPath,
    JSON.stringify(mapToObject(addedChannelIds), null, 2)
  );
  console.log(
    `Processed ${addedChannelIds.size} channels. Data written to ${channelsUniqueIdsPath}`
  );
  console.log(`Total messages processed: ${messageCount}`);
}

// Paths to the input and output files
const inputFilePath = "export.json";
const outputFilePath = "output.json";

const usersUniqueIdsPath = "usersUniqueIds.json";
const channelsUniqueIdsPath = "channelsUniqueIds.json";

processFile(
  inputFilePath,
  outputFilePath,
  usersUniqueIdsPath,
  channelsUniqueIdsPath
)
  .then(() => console.log("Processing complete."))
  .catch((err) => console.error("Error processing file:", err));

function mapToObject(map) {
  const obj = {};
  map.forEach((value, key) => {
    obj[key] = value;
  });
  return obj;
}

function objectToMap(obj) {
  return new Map(Object.entries(obj));
}

function parseDateString(dateString) {
  // Remove the ordinal suffix from the day part
  const cleanedDateString = dateString.replace(/(\d{1,2})(st|nd|rd|th)/, "$1");

  // Create a Date object from the cleaned date string
  const date = new Date(cleanedDateString);

  // Check if the conversion was successful
  if (isNaN(date)) {
    return new Date();
  }

  return date;
}

function generateUUIDv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}