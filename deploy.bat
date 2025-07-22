@echo off
echo 🚀 Starting LMS Deployment...

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js first.
    pause
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not installed. Please install npm first.
    pause
    exit /b 1
)

echo 📦 Installing dependencies...
npm install

echo 🔨 Building frontend...
npm run build

echo ✅ Build completed successfully!
echo.
echo 🎉 Your LMS is ready for deployment!
echo.
echo 📋 Next steps:
echo 1. Push your code to GitHub
echo 2. Choose a deployment platform:
echo    - Railway (recommended): https://railway.app
echo    - Render: https://render.com
echo    - Heroku: https://heroku.com
echo.
echo 3. Set up your MongoDB database:
echo    - MongoDB Atlas: https://www.mongodb.com/atlas
echo.
echo 4. Configure environment variables:
echo    - MONGODB_URI
echo    - JWT_SECRET
echo    - JWT_EXPIRE
echo    - NODE_ENV=production
echo.
echo 📖 See DEPLOYMENT.md for detailed instructions
pause 