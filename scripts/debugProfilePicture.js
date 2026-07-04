require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const User = require('../models/user.model');
const FileAsset = require('../models/fileAsset.model');
const { resolveProfilePictureUrl } = require('../utils/profilePictureUrl');

const pic = 'profilePicture-1762444967948-138213737.jpg';

async function main() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);

  const users = await User.find({ profilePicture: { $regex: pic } })
    .select('email firstName lastName profilePicture')
    .lean();
  console.log('Users:', JSON.stringify(users, null, 2));

  const assets = await FileAsset.find({
    $or: [
      { 'migrationMeta.legacyUrl': { $regex: pic } },
      { storageKey: pic },
      { originalName: pic },
      { 'migrationMeta.legacyUrl': `/uploads/${pic}` },
    ],
    category: 'profile',
  })
    .select('provider storageKey metadata.providerUrl migrationMeta originalName')
    .lean();
  console.log('FileAssets:', JSON.stringify(assets, null, 2));

  const local = path.join('uploads', pic);
  console.log('Local file exists:', fs.existsSync(local), local);

  if (users[0]) {
    const resolved = await resolveProfilePictureUrl(users[0].profilePicture, {
      userId: users[0]._id,
    });
    console.log('Resolved URL:', JSON.stringify(resolved));
    const after = await User.findById(users[0]._id).select('profilePicture').lean();
    console.log('DB after resolve:', after?.profilePicture);
  }

  const allWithPics = await User.find({ profilePicture: { $exists: true, $ne: '' } })
    .select('email profilePicture')
    .lean();
  console.log('All users with profile pictures:', JSON.stringify(allWithPics, null, 2));

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
