require('dotenv').config();
const mongoose = require('mongoose');
const FileAsset = require('../models/fileAsset.model');

const id = process.argv[2];
const query = id
  ? { _id: id }
  : {
      $or: [
        { 'metadata.providerUrl': /file_b1fswl/ },
        { originalName: /image \(1\)/i },
      ],
    };

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => FileAsset.findOne(query).lean())
  .then((a) => {
    console.log(JSON.stringify(a, null, 2));
    return mongoose.disconnect();
  })
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
