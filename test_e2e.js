const assert = require('assert');

const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('🧪 Starting SCMS End-to-End Enterprise API Verification...\n');
  let token = null;
  let newTicketId = null;

  // 1. Test Auth Login (Student)
  console.log('1️⃣ Testing Student Authentication Login...');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'swaraj@zeal.edu.in', password: 'swaraj@123', role: 'student' })
  });
  assert.strictEqual(loginRes.status, 200, `Login failed: status ${loginRes.status}`);
  const loginJson = await loginRes.json();
  assert.ok(loginJson.token, 'Token not returned in login');
  assert.strictEqual(loginJson.user.email, 'swaraj@zeal.edu.in');
  token = loginJson.token;
  console.log(`   ✅ Student logged in successfully. User: ${loginJson.user.name}, Role: ${loginJson.user.role}`);

  // 2. Test AI Smart Suggestion
  console.log('\n2️⃣ Testing AI Smart Categorization Engine...');
  const aiRes = await fetch(`${BASE_URL}/complaints/ai-suggest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Lab 3 PC RAM fault & Blue Screen Crash',
      description: 'During practical session the computer displays memory error and crashes.'
    })
  });
  assert.strictEqual(aiRes.status, 200);
  const aiJson = await aiRes.json();
  assert.strictEqual(aiJson.suggestion.department, 'IT');
  assert.strictEqual(aiJson.suggestion.category, 'Academics');
  console.log(`   ✅ AI suggestion accurate: Dept=${aiJson.suggestion.departmentName}, Confidence=${aiJson.suggestion.confidence}%`);

  // 3. Test Create Complaint
  console.log('\n3️⃣ Testing Complaint Submission with SLA Deadline...');
  const createRes = await fetch(`${BASE_URL}/complaints`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      title: 'Campus Wi-Fi Signal Loss in Mechanical Workshop',
      department: 'IT',
      category: 'Infrastructure',
      priority: 'High',
      studentName: 'Swaraj Godambe (IT2143)',
      studentEmail: 'swaraj@zeal.edu.in',
      studentRollNo: 'IT2143',
      description: 'The router antenna in Workshop Hall 2 has disconnected. Students cannot access digital cad/cam manuals.'
    })
  });
  assert.strictEqual(createRes.status, 201);
  const createJson = await createRes.json();
  newTicketId = createJson.data.id || createJson.data.ticketId;
  assert.ok(newTicketId.startsWith('CMP-'), `Invalid ticket ID: ${newTicketId}`);
  assert.ok(createJson.data.slaDeadline, 'Missing SLA deadline');
  console.log(`   ✅ Complaint created with ID: ${newTicketId}, SLA Deadline: ${createJson.data.slaDeadline}`);

  // 4. Test Single Complaint Fetch
  console.log('\n4️⃣ Testing Single Complaint Lookup by Ticket ID...');
  const getRes = await fetch(`${BASE_URL}/complaints/${newTicketId}`);
  assert.strictEqual(getRes.status, 200);
  const getJson = await getRes.json();
  assert.strictEqual(getJson.data.status, 'Pending');
  console.log(`   ✅ Lookup verified. Title: "${getJson.data.title}", Status: ${getJson.data.status}`);

  // 5. Test Assign Ticket to Officer
  console.log('\n5️⃣ Testing Officer Assignment Workflow...');
  const assignRes = await fetch(`${BASE_URL}/complaints/${newTicketId}/assign`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      officerName: 'Mr. Jadhav',
      officerEmail: 'jadhav@zeal.edu.in',
      officerRole: 'Senior Network Administrator'
    })
  });
  assert.strictEqual(assignRes.status, 200);
  const assignJson = await assignRes.json();
  assert.strictEqual(assignJson.data.status, 'In Progress');
  assert.strictEqual(assignJson.data.assignedTo.name, 'Mr. Jadhav');
  console.log(`   ✅ Ticket assigned to ${assignJson.data.assignedTo.name} (${assignJson.data.assignedTo.role}). Status changed to ${assignJson.data.status}`);

  // 6. Test Update Status to Resolved with Remarks
  console.log('\n6️⃣ Testing Authority Status Update & Official Remarks...');
  const updateRes = await fetch(`${BASE_URL}/complaints/${newTicketId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'Resolved',
      department: 'IT',
      officerName: 'Prof. Kulkarni (HOD IT)',
      remarkText: 'Replaced access point transceiver antenna. Tested connectivity at 50 Mbps.'
    })
  });
  assert.strictEqual(updateRes.status, 200);
  const updateJson = await updateRes.json();
  assert.strictEqual(updateJson.data.status, 'Resolved');
  console.log(`   ✅ Ticket resolved with official remark. Status: ${updateJson.data.status}`);

  // 7. Test Student Resolution Feedback & Rating
  console.log('\n7️⃣ Testing Student Resolution 5-Star Feedback Submission...');
  const feedbackRes = await fetch(`${BASE_URL}/complaints/${newTicketId}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rating: 5,
      comment: 'Excellent and quick resolution by the network team. Wi-Fi works great now!',
      studentName: 'Swaraj Godambe'
    })
  });
  assert.strictEqual(feedbackRes.status, 200);
  const feedbackJson = await feedbackRes.json();
  assert.strictEqual(feedbackJson.data.rating, 5);
  console.log(`   ✅ Feedback recorded: ${feedbackJson.data.rating}/5 stars. "${feedbackJson.data.comment}"`);

  // 8. Test Admin User Management
  console.log('\n8️⃣ Testing Admin Authentication & User Governance...');
  const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin@zeal.edu.in', password: 'admin123', role: 'admin' })
  });
  assert.strictEqual(adminLoginRes.status, 200, `Admin login failed: ${adminLoginRes.status}`);
  const adminLoginJson = await adminLoginRes.json();
  const adminToken = adminLoginJson.token;
  assert.ok(adminToken, 'Admin token missing');

  const adminUsersRes = await fetch(`${BASE_URL}/admin/users`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert.strictEqual(adminUsersRes.status, 200);
  const adminUsersJson = await adminUsersRes.json();
  assert.ok(adminUsersJson.data.length >= 3);
  console.log(`   ✅ Admin authenticated and fetched ${adminUsersJson.data.length} registered users across departments.`);

  // 9. Test Department Health & SLA Compliance
  console.log('\n9️⃣ Testing Department Health & SLA Metrics Engine...');
  const deptsRes = await fetch(`${BASE_URL}/admin/departments`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert.strictEqual(deptsRes.status, 200);
  const deptsJson = await deptsRes.json();
  assert.ok(deptsJson.data.length >= 6);
  const itDept = deptsJson.data.find(d => d.code === 'IT');
  assert.ok(itDept, 'IT Department missing');
  console.log(`   ✅ Department Health: ${itDept.name} has ${itDept.metrics.total} tickets, ${itDept.metrics.resolved} resolved, compliance score: ${itDept.metrics.complianceRate}%.`);

  // 10. Test CSV Report Generation
  console.log('\n🔟 Testing CSV Report Export Endpoint...');
  const csvRes = await fetch(`${BASE_URL}/complaints/export/csv`);
  assert.strictEqual(csvRes.status, 200);
  const csvText = await csvRes.text();
  assert.ok(csvText.includes('Ticket ID,Title,Department,Category,Priority,Status'));
  assert.ok(csvText.includes(newTicketId));
  console.log(`   ✅ CSV Export validated (${csvText.length} bytes). Contains header and ticket ${newTicketId}.`);

  // 11. Test File Attachment Upload (Multer)
  console.log('\n1️⃣1️⃣ Testing File Upload via Multer...');
  const testForm = new FormData();
  testForm.append('file', new Blob(['Grievance proof log file data'], { type: 'text/plain' }), 'network_log.txt');
  const uploadRes = await fetch(`${BASE_URL}/complaints/upload`, {
    method: 'POST',
    body: testForm
  });
  assert.strictEqual(uploadRes.status, 201, `Upload failed: status ${uploadRes.status}`);
  const uploadJson = await uploadRes.json();
  assert.strictEqual(uploadJson.success, true);
  assert.ok(uploadJson.filename, 'Uploaded filename missing');
  console.log(`   ✅ File uploaded successfully: ${uploadJson.filename} (Size: ${uploadJson.size} bytes)`);

  console.log('\n🎉 ALL 11 ENTERPRISE E2E TESTS PASSED WITH 100% SUCCESS!\n');
}

runTests().catch(err => {
  console.error('\n❌ Test failure:', err);
  process.exit(1);
});
