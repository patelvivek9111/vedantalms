const axios = require('axios');

async function testAPI() {
  try {
    console.log('Testing backend API...');
    
    // Test the submissions route
    const response = await axios.get('http://localhost:5000/api/submissions/student/687704cee06568c3960121d1', {
      headers: {
        'Authorization': 'Bearer test-token'
      }
    });
    
    console.log('Response:', response.data);
  } catch (error) {
    console.error('Error:', error.response?.status, error.response?.data);
  }
}

testAPI(); 