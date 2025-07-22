const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Building frontend...');

try {
  // Change to frontend directory
  process.chdir(path.join(__dirname, 'frontend'));
  
  // Install dependencies
  console.log('Installing frontend dependencies...');
  execSync('npm install', { stdio: 'inherit' });
  
  // Build the frontend
  console.log('Building frontend...');
  execSync('npm run build', { stdio: 'inherit' });
  
  // Copy built files to a public directory in the root
  const distPath = path.join(__dirname, 'frontend', 'dist');
  const publicPath = path.join(__dirname, 'public');
  
  if (fs.existsSync(publicPath)) {
    fs.rmSync(publicPath, { recursive: true, force: true });
  }
  
  // Copy dist contents to public
  fs.cpSync(distPath, publicPath, { recursive: true });
  
  console.log('Frontend built successfully!');
  console.log('Built files are in the "public" directory');
  
} catch (error) {
  console.error('Error building frontend:', error.message);
  process.exit(1);
} 