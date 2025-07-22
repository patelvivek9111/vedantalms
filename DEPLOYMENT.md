# LMS Deployment Guide

This guide will help you deploy your Learning Management System to various platforms.

## Prerequisites

1. **MongoDB Database**: You'll need a MongoDB database. Options include:
   - [MongoDB Atlas](https://www.mongodb.com/atlas) (Free tier available)
   - [Railway MongoDB](https://railway.app/database/mongodb)
   - [Render MongoDB](https://render.com/docs/databases)

2. **Environment Variables**: You'll need to set these environment variables:
   - `MONGODB_URI`: Your MongoDB connection string
   - `JWT_SECRET`: A secure random string for JWT tokens
   - `JWT_EXPIRE`: Token expiration time (default: 30d)
   - `NODE_ENV`: Set to "production"

## Option 1: Deploy to Railway (Recommended)

### Step 1: Prepare Your Repository
1. Push your code to GitHub
2. Make sure you have the `railway.json` file in your root directory

### Step 2: Deploy
1. Go to [Railway.app](https://railway.app)
2. Sign up with your GitHub account
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Add environment variables in the Railway dashboard:
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `JWT_EXPIRE`
   - `NODE_ENV=production`

### Step 3: Deploy Frontend
1. In Railway, create a new service for your frontend
2. Set the build command: `cd frontend && npm install && npm run build`
3. Set the start command: `cd frontend && npm run preview`

## Option 2: Deploy to Render

### Step 1: Prepare Your Repository
1. Push your code to GitHub
2. Make sure you have the `render.yaml` file in your root directory

### Step 2: Deploy
1. Go to [Render.com](https://render.com)
2. Sign up and connect your GitHub account
3. Click "New" → "Web Service"
4. Connect your repository
5. Configure the service:
   - **Name**: lms-backend
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
6. Add environment variables in the Render dashboard

## Option 3: Deploy to Heroku

### Step 1: Install Heroku CLI
```bash
# Windows
# Download from https://devcenter.heroku.com/articles/heroku-cli

# Or use npm
npm install -g heroku
```

### Step 2: Deploy
```bash
# Login to Heroku
heroku login

# Create a new Heroku app
heroku create your-lms-app-name

# Add MongoDB addon (MongoDB Atlas)
heroku addons:create mongolab:sandbox

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your-secret-key-here
heroku config:set JWT_EXPIRE=30d

# Deploy
git push heroku main
```

## Option 4: Deploy to Vercel (Frontend Only)

For the frontend, you can also deploy to Vercel:

1. Go to [Vercel.com](https://vercel.com)
2. Import your repository
3. Set the root directory to `frontend`
4. Set build command: `npm run build`
5. Set output directory: `dist`

## Environment Variables Setup

### MongoDB Atlas Setup
1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a new cluster
3. Get your connection string
4. Replace `<password>` with your database password
5. Add the connection string as `MONGODB_URI` environment variable

### JWT Secret
Generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Post-Deployment Checklist

1. **Test the API**: Visit `https://your-app.railway.app/api/auth` to ensure the backend is running
2. **Test the Frontend**: Visit your frontend URL and test login/registration
3. **Database**: Verify that data is being saved to your MongoDB database
4. **File Uploads**: Test file upload functionality
5. **Environment Variables**: Ensure all environment variables are set correctly

## Troubleshooting

### Common Issues:
1. **MongoDB Connection**: Ensure your MongoDB URI is correct and accessible
2. **CORS Issues**: The backend is configured to allow CORS, but you may need to update the frontend API base URL
3. **File Uploads**: Ensure the uploads directory is properly configured
4. **Environment Variables**: Double-check all environment variables are set

### Logs
- Railway: View logs in the Railway dashboard
- Render: View logs in the Render dashboard
- Heroku: `heroku logs --tail`

## Security Considerations

1. **JWT Secret**: Use a strong, random secret
2. **MongoDB**: Use a strong password for your database
3. **Environment Variables**: Never commit sensitive data to your repository
4. **HTTPS**: Most platforms provide HTTPS by default

## Cost Considerations

- **Railway**: Free tier available, then $5/month
- **Render**: Free tier available, then $7/month
- **Heroku**: Free tier discontinued, starts at $7/month
- **MongoDB Atlas**: Free tier available (512MB)

## Next Steps

1. Set up a custom domain (optional)
2. Configure SSL certificates (usually automatic)
3. Set up monitoring and logging
4. Configure backups for your database
5. Set up CI/CD for automatic deployments 