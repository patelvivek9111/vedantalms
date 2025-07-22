#!/bin/bash

echo "🚀 Starting LMS Deployment..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "📦 Installing dependencies..."
npm install

echo "🔨 Building frontend..."
npm run build

echo "✅ Build completed successfully!"
echo ""
echo "🎉 Your LMS is ready for deployment!"
echo ""
echo "📋 Next steps:"
echo "1. Push your code to GitHub"
echo "2. Choose a deployment platform:"
echo "   - Railway (recommended): https://railway.app"
echo "   - Render: https://render.com"
echo "   - Heroku: https://heroku.com"
echo ""
echo "3. Set up your MongoDB database:"
echo "   - MongoDB Atlas: https://www.mongodb.com/atlas"
echo ""
echo "4. Configure environment variables:"
echo "   - MONGODB_URI"
echo "   - JWT_SECRET"
echo "   - JWT_EXPIRE"
echo "   - NODE_ENV=production"
echo ""
echo "📖 See DEPLOYMENT.md for detailed instructions" 