# 🚀 Quick Deployment Steps

## Step 1: Deploy to Railway (FREE)

1. **Go to [Railway.app](https://railway.app)**
2. **Sign up with your GitHub account**
3. **Click "New Project" → "Deploy from GitHub repo"**
4. **Select your repository: `patelvivek9111/vedantalms`**
5. **Wait for deployment to start (5-10 minutes)**

## Step 2: Set Environment Variables

In Railway dashboard, go to "Variables" tab and add:

```
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=9d968c1c3f4dd05cd81c37e2021c5d006b9c777d60b071c8689416a4cc3672104db7f0a3b360f6d55976b0d0d367681d44bb663
JWT_EXPIRE=30d
NODE_ENV=production
```

## Step 3: Get MongoDB Database

1. **Go to [MongoDB Atlas](https://www.mongodb.com/atlas)**
2. **Create free account**
3. **Create new cluster**
4. **Get connection string**
5. **Add as MONGODB_URI in Railway**

## Step 4: Your App is Live!

Your LMS will be available at: `https://your-app-name.railway.app`

## 🎯 What You Get (FREE):

✅ **Custom subdomain** (e.g., `https://vedantalms.railway.app`)
✅ **HTTPS certificate** (automatic)
✅ **Database hosting** (MongoDB Atlas free tier)
✅ **File uploads** (working)
✅ **User authentication** (working)
✅ **All LMS features** (working)

## 💰 Cost Breakdown:

- **Railway**: FREE tier available
- **MongoDB Atlas**: FREE tier (512MB)
- **Custom domain**: Optional ($10-15/year)

## 🔗 Your URLs Will Be:

- **Main app**: `https://vedantalms.railway.app`
- **API**: `https://vedantalms.railway.app/api`
- **File uploads**: `https://vedantalms.railway.app/uploads`

## 📱 Share Your App:

Once deployed, you can share:
- **Students**: `https://vedantalms.railway.app`
- **Teachers**: `https://vedantalms.railway.app`
- **Admin**: `https://vedantalms.railway.app`

## 🎉 No Domain Purchase Needed!

Your app will work perfectly with the free subdomain provided by Railway. 