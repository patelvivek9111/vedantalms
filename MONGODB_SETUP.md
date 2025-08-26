# 🗄️ MongoDB Atlas Setup (Free Tier)

## Step 1: Create MongoDB Atlas Account
1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Click "Try Free" or "Start Free"
3. Fill in your details and create account

## Step 2: Create Free Cluster
1. Choose "FREE" tier (M0)
2. Select cloud provider (AWS, Google Cloud, or Azure)
3. Choose region closest to you
4. Click "Create Cluster"

## Step 3: Set Up Database Access
1. Go to "Database Access" in left sidebar
2. Click "Add New Database User"
3. Choose "Password" authentication
4. Create username and password (save these!)
5. Select "Read and write to any database"
6. Click "Add User"

## Step 4: Set Up Network Access
1. Go to "Network Access" in left sidebar
2. Click "Add IP Address"
3. Click "Allow Access from Anywhere" (for now)
4. Click "Confirm"

## Step 5: Get Connection String
1. Go back to "Database" in left sidebar
2. Click "Connect"
3. Choose "Connect your application"
4. Copy the connection string

## Step 6: Update Your Environment
Replace `<password>` with your actual password:
```
mongodb+srv://yourusername:yourpassword@cluster0.xxxxx.mongodb.net/lms?retryWrites=true&w=majority
```

## Step 7: Add to Render
1. Go to your Render dashboard
2. Select your backend service
3. Go to "Environment" tab
4. Add new variable:
   - Key: `MONGODB_URI`
   - Value: Your connection string from step 5

## 🎯 Free Tier Limits
- **Storage**: 512MB
- **RAM**: Shared
- **Network**: 500 connections
- **Perfect for**: Development and small production apps

## ⚠️ Important Notes
- Free tier is perfect for getting started
- Upgrade when you hit limits
- Monitor usage in Atlas dashboard
- Backup your data regularly
