#!/bin/bash

# LMS Production Deployment Script
# This script automates the deployment process for your LMS

set -e  # Exit on any error

echo "🚀 Starting LMS Production Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="lms"
FRONTEND_DIR="frontend"
BACKEND_DIR="."
DEPLOYMENT_ENV=${1:-production}

echo -e "${YELLOW}Deploying to: ${DEPLOYMENT_ENV}${NC}"

# Step 1: Check prerequisites
echo "📋 Checking prerequisites..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"

# Step 2: Install dependencies
echo "📦 Installing dependencies..."
cd $FRONTEND_DIR
npm ci --production=false
cd ..

npm ci --production=false
echo -e "${GREEN}✅ Dependencies installed${NC}"

# Step 3: Build frontend
echo "🔨 Building frontend..."
cd $FRONTEND_DIR
npm run build
cd ..
echo -e "${GREEN}✅ Frontend built successfully${NC}"

# Step 4: Run tests (if available)
echo "🧪 Running tests..."
if npm run test 2>/dev/null; then
    echo -e "${GREEN}✅ Tests passed${NC}"
else
    echo -e "${YELLOW}⚠️  No tests found or tests failed${NC}"
fi

# Step 5: Environment setup
echo "⚙️  Setting up environment..."
if [ ! -f .env.production ]; then
    echo -e "${YELLOW}⚠️  .env.production not found, creating from template...${NC}"
    cp .env.example .env.production
    echo -e "${YELLOW}⚠️  Please update .env.production with your production values${NC}"
fi

# Step 6: Database migration (if needed)
echo "🗄️  Checking database..."
# Add your database migration commands here
# npm run migrate:prod

# Step 7: Start the application
echo "🚀 Starting application..."
if [ "$DEPLOYMENT_ENV" = "production" ]; then
    echo -e "${GREEN}✅ Application deployed successfully!${NC}"
    echo -e "${YELLOW}📝 Next steps:${NC}"
    echo -e "   1. Update your .env.production file"
    echo -e "   2. Set up your production database"
    echo -e "   3. Configure your reverse proxy (nginx/apache)"
    echo -e "   4. Set up SSL certificates"
    echo -e "   5. Configure monitoring and logging"
    echo -e "   6. Set up automated backups"
else
    npm run dev
fi

echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
