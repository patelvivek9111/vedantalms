const axios = require('axios');

// Test delete submission
async function testDeleteSubmission() {
  try {
    // First, let's get a list of submissions
    const response = await axios.get('http://localhost:5000/api/submissions/assignment/687704cee06568c3960121d1', {
      headers: {
        'Authorization': 'Bearer YOUR_TOKEN_HERE' // You'll need to replace this with a valid token
      }
    });
    
    console.log('Submissions:', response.data);
    
    if (response.data.length > 0) {
      const submissionToDelete = response.data[0];
      console.log('Attempting to delete submission:', submissionToDelete._id);
      
      const deleteResponse = await axios.delete(`http://localhost:5000/api/submissions/${submissionToDelete._id}`, {
        headers: {
          'Authorization': 'Bearer YOUR_TOKEN_HERE' // You'll need to replace this with a valid token
        }
      });
      
      console.log('Delete response:', deleteResponse.data);
    }
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testDeleteSubmission(); 