# 🌐 Production Deployment Guide

## 🎯 Recommended Setup (Free/Low Cost)

### Database: MongoDB Atlas (Free)
- **Storage**: 512MB free forever
- **Perfect for**: Development and small production apps
- **Setup**: Follow `MONGODB_SETUP.md` in this project

### File Storage: Cloudinary (Free)
- **Storage**: 25GB free forever
- **Bandwidth**: 25GB/month free
- **Features**: Image optimization, CDN, transformations

### Hosting: Railway (Easiest)
- **Cost**: $5/month after free credits
- **Features**: Auto-deploy from GitHub, managed databases
- **Perfect for**: Full-stack apps

## 🚀 Step-by-Step Production Setup

### 1. Set Up MongoDB Atlas
```bash
# 1. Create account at mongodb.com/atlas
# 2. Create free cluster (M0)
# 3. Get connection string
# 4. Update your .env:
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/lms?retryWrites=true&w=majority
```

### 2. Set Up Cloudinary (File Storage)
```bash
# 1. Create account at cloudinary.com
# 2. Get API credentials from dashboard
# 3. Install Cloudinary SDK:
npm install cloudinary

# 4. Update your .env:
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### 3. Update File Upload Code
Replace local file upload with Cloudinary:

```javascript
// middleware/upload.js
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Replace multer with Cloudinary upload
const uploadToCloudinary = async (file) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { resource_type: 'auto' },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    ).end(file.buffer);
  });
};
```

### 4. Update Frontend Image URLs
```javascript
// services/api.ts
export const getImageUrl = (filename: string): string => {
  if (!filename) return '';
  if (filename.startsWith('http')) return filename;
  // For Cloudinary URLs
  return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${filename}`;
};
```

### 5. Deploy to Railway
```bash
# 1. Push code to GitHub
# 2. Connect Railway to your GitHub repo
# 3. Add environment variables in Railway dashboard:
#    - MONGODB_URI
#    - CLOUDINARY_CLOUD_NAME
#    - CLOUDINARY_API_KEY
#    - CLOUDINARY_API_SECRET
#    - JWT_SECRET (generate strong secret)
#    - NODE_ENV=production
# 4. Deploy!
```

## 💰 Cost Breakdown (Monthly)

### Free Tier Option
- **MongoDB Atlas**: $0 (512MB free)
- **Cloudinary**: $0 (25GB free)
- **Railway**: $0 (with free credits)
- **Total**: $0/month

### Small Production Option
- **MongoDB Atlas**: $0 (still free)
- **Cloudinary**: $0 (still free)
- **Railway**: $5/month
- **Total**: $5/month

## 🔧 Alternative Configurations

### Option 1: Vercel + Railway
- **Frontend**: Deploy to Vercel (free)
- **Backend**: Deploy to Railway ($5/month)
- **Database**: MongoDB Atlas (free)
- **Files**: Cloudinary (free)

### Option 2: Render (All-in-One)
- **Everything**: Deploy to Render
- **Database**: Render PostgreSQL (free tier)
- **Files**: Render Volumes ($0.25/GB)
- **Cost**: $7/month

### Option 3: AWS (Advanced)
- **Frontend**: Vercel (free)
- **Backend**: AWS EC2 ($5-10/month)
- **Database**: AWS RDS ($15-20/month)
- **Files**: AWS S3 ($1-2/month)

## 🛡️ Security Checklist

### Environment Variables
```bash
# Generate strong JWT secret
JWT_SECRET=your-very-long-random-string-here

# Use production MongoDB URI
MONGODB_URI=mongodb+srv://...

# Add Cloudinary credentials
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Set production mode
NODE_ENV=production
```

### Security Headers
```javascript
// Add to server.js
app.use(helmet()); // Security headers
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 })); // Rate limiting
```

## 📊 Monitoring & Maintenance

### Free Monitoring Tools
- **MongoDB Atlas**: Built-in monitoring
- **Railway**: Built-in logs and metrics
- **Cloudinary**: Usage dashboard

### Backup Strategy
- **MongoDB Atlas**: Automatic backups (free tier)
- **Code**: GitHub (automatic)
- **Files**: Cloudinary (automatic)

## 🚀 Quick Start Commands

```bash
# 1. Install Cloudinary
npm install cloudinary

# 2. Update package.json scripts
npm run build:frontend

# 3. Test locally with production config
NODE_ENV=production npm start

# 4. Deploy to Railway
# (Connect GitHub repo in Railway dashboard)
```

## 📈 Scaling Up

When you outgrow free tiers:
1. **MongoDB Atlas**: Upgrade to M2 ($9/month)
2. **Cloudinary**: Upgrade to Plus ($99/month)
3. **Railway**: Already scales automatically
4. **Consider**: CDN, load balancing, microservices

---

**🎯 Recommended Path**: Start with MongoDB Atlas + Cloudinary + Railway for $5/month total!
