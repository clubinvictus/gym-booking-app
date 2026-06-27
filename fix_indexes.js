const fs = require('fs');

const data = JSON.parse(fs.readFileSync('firestore.indexes.json', 'utf8'));

const newIndexes = [
  {
    collectionGroup: "sessions",
    queryScope: "COLLECTION",
    fields: [
      { fieldPath: "clientIds", arrayConfig: "CONTAINS" },
      { fieldPath: "siteId", order: "ASCENDING" },
      { fieldPath: "endTime", order: "ASCENDING" }
    ]
  },
  {
    collectionGroup: "sessions",
    queryScope: "COLLECTION",
    fields: [
      { fieldPath: "clientIds", arrayConfig: "CONTAINS" },
      { fieldPath: "siteId", order: "ASCENDING" },
      { fieldPath: "date", order: "ASCENDING" }
    ]
  },
  {
    collectionGroup: "sessions",
    queryScope: "COLLECTION",
    fields: [
      { fieldPath: "clientId", order: "ASCENDING" },
      { fieldPath: "siteId", order: "ASCENDING" },
      { fieldPath: "endTime", order: "ASCENDING" }
    ]
  },
  {
    collectionGroup: "sessions",
    queryScope: "COLLECTION",
    fields: [
      { fieldPath: "clientId", order: "ASCENDING" },
      { fieldPath: "siteId", order: "ASCENDING" },
      { fieldPath: "date", order: "ASCENDING" }
    ]
  }
];

// Avoid duplicates
const existingStrings = data.indexes.map(i => JSON.stringify(i));
for (const idx of newIndexes) {
  if (!existingStrings.includes(JSON.stringify(idx))) {
    data.indexes.push(idx);
  }
}

fs.writeFileSync('firestore.indexes.json', JSON.stringify(data, null, 2) + '\n');
console.log("Indexes updated in firestore.indexes.json");
