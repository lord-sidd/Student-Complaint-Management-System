const assert = require('assert');

const BASE_URL = 'http://localhost:5000/api';

async function testWorkflow() {
  console.log('🚀 Running Student-to-Authority E2E Verification Workflow...\n');

  // Step 1: Student Login
  console.log('1️⃣ Logging in as Student (Swaraj Godambe)...');
  const studentLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'swaraj@zeal.edu.in', password: 'swaraj@123', role: 'student' })
  });
  assert.strictEqual(studentLoginRes.status, 200);
  const studentAuth = await studentLoginRes.json();
  const studentToken = studentAuth.token;
  const studentUser = studentAuth.user;
  console.log(`   ✅ Student logged in: ${studentUser.name} (${studentUser.email})`);

  // Step 2: Student Submits a Complaint for IT Department
  console.log('\n2️⃣ Student Submits New Grievance Ticket in IT Department...');
  const createRes = await fetch(`${BASE_URL}/complaints`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${studentToken}`
    },
    body: JSON.stringify({
      title: 'Lab 4 Projector Connectivity Dropout',
      department: 'IT',
      category: 'Infrastructure',
      priority: 'High',
      studentName: studentUser.name,
      studentEmail: studentUser.email,
      studentRollNo: studentUser.rollNo || 'IT2143',
      userId: studentUser.id || studentUser._id,
      description: 'HDMI cable and wireless casting in Lab 4 cuts out every 5 minutes during seminar presentations.'
    })
  });
  assert.strictEqual(createRes.status, 201);
  const createJson = await createRes.json();
  const ticketId = createJson.data.ticketId || createJson.data.id;
  assert.ok(ticketId);
  console.log(`   ✅ Complaint submitted successfully! Ticket ID: ${ticketId}`);

  // Step 3: Authority Login (Prof. Kulkarni - IT HOD)
  console.log('\n3️⃣ Logging in as Higher Department Authority (Prof. Kulkarni - HOD IT)...');
  const authLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'prof.kulkarni@zeal.edu.in', password: 'authority123', role: 'authority' })
  });
  assert.strictEqual(authLoginRes.status, 200);
  const authLoginJson = await authLoginRes.json();
  const authorityToken = authLoginJson.token;
  const authorityUser = authLoginJson.user;
  console.log(`   ✅ Authority logged in: ${authorityUser.name} [Dept: ${authorityUser.department}]`);

  // Step 4: Authority Views Department Complaints Dashboard
  console.log('\n4️⃣ Higher Authority Inspects Department Queue for the New Ticket...');
  const deptQueueRes = await fetch(`${BASE_URL}/complaints?department=${authorityUser.department}`, {
    headers: { 'Authorization': `Bearer ${authorityToken}` }
  });
  assert.strictEqual(deptQueueRes.status, 200);
  const deptQueue = await deptQueueRes.json();
  const foundInDept = deptQueue.data.find(c => (c.ticketId || c.id) === ticketId);
  assert.ok(foundInDept, `Ticket ${ticketId} not visible in Authority queue!`);
  console.log(`   ✅ Verified! Ticket ${ticketId} is prominently visible in ${authorityUser.department} Authority Dashboard.`);
  console.log(`      Title: "${foundInDept.title}" | Student: "${foundInDept.studentName}" | Status: ${foundInDept.status}`);

  // Step 5: Authority Assigns Ticket to Investigating Officer
  console.log('\n5️⃣ Authority Assigns Ticket to Investigating Officer...');
  const assignRes = await fetch(`${BASE_URL}/complaints/${ticketId}/assign`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authorityToken}`
    },
    body: JSON.stringify({
      officerName: 'Er. Shinde',
      officerEmail: 'shinde@zeal.edu.in',
      officerRole: 'Lab Systems Engineer'
    })
  });
  assert.strictEqual(assignRes.status, 200);
  const assignJson = await assignRes.json();
  assert.strictEqual(assignJson.data.assignedTo.name, 'Er. Shinde');
  console.log(`   ✅ Ticket assigned to ${assignJson.data.assignedTo.name} (${assignJson.data.assignedTo.role}). Status: ${assignJson.data.status}`);

  // Step 6: Authority Solves & Resolves the Complaint with Official Remarks
  console.log('\n6️⃣ Authority Resolves Grievance with Official Remark & Solution...');
  const remarkText = 'Replaced faulty high-speed HDMI 2.1 cable and configured 5GHz dual-band wireless casting. Tested with presentation laptops successfully.';
  const resolveRes = await fetch(`${BASE_URL}/complaints/${ticketId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authorityToken}`
    },
    body: JSON.stringify({
      status: 'Resolved',
      department: 'IT',
      officerName: authorityUser.name,
      remarkText
    })
  });
  assert.strictEqual(resolveRes.status, 200);
  const resolveJson = await resolveRes.json();
  assert.strictEqual(resolveJson.data.status, 'Resolved');
  assert.strictEqual(resolveJson.data.userId, studentUser.id || studentUser._id, 'Student userId preserved!');
  assert.strictEqual(resolveJson.data.studentEmail, studentUser.email.toLowerCase(), 'Student email preserved!');
  console.log(`   ✅ Grievance status successfully changed to RESOLVED by ${authorityUser.name}!`);

  // Step 7: Student Checks Ticket - Sees Problem Solved & Official Remarks
  console.log('\n7️⃣ Student Checks Ticket - Confirms Resolution & Official Remark...');
  const studentCheckRes = await fetch(`${BASE_URL}/complaints/${ticketId}`, {
    headers: { 'Authorization': `Bearer ${studentToken}` }
  });
  assert.strictEqual(studentCheckRes.status, 200);
  const studentTicket = (await studentCheckRes.json()).data;
  assert.strictEqual(studentTicket.status, 'Resolved');
  assert.ok(studentTicket.remarks && studentTicket.remarks.length > 0);
  const lastRemark = studentTicket.remarks[studentTicket.remarks.length - 1];
  assert.strictEqual(lastRemark.text, remarkText);
  console.log(`   ✅ Student confirmed ticket status is RESOLVED with official remark: "${lastRemark.text}"`);

  // Step 8: Student Submits 5-Star Resolution Feedback
  console.log('\n8️⃣ Student Submits Resolution Feedback Rating (5 Stars)...');
  const feedbackRes = await fetch(`${BASE_URL}/complaints/${ticketId}/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${studentToken}`
    },
    body: JSON.stringify({
      rating: 5,
      comment: 'Super fast fix! Seminar presentations ran smoothly without any screen flickers. Thank you!',
      studentName: studentUser.name
    })
  });
  assert.strictEqual(feedbackRes.status, 200);
  const feedbackJson = await feedbackRes.json();
  assert.strictEqual(feedbackJson.data.rating, 5);
  console.log(`   ✅ Feedback accepted: ${feedbackJson.data.rating} / 5 stars`);

  // Step 9: Authority / Admin Views Feedback on Resolved Ticket
  console.log('\n9️⃣ Authority / Admin Verifies Feedback on the Ticket...');
  const finalCheckRes = await fetch(`${BASE_URL}/complaints/${ticketId}`, {
    headers: { 'Authorization': `Bearer ${authorityToken}` }
  });
  assert.strictEqual(finalCheckRes.status, 200);
  const finalTicket = (await finalCheckRes.json()).data;
  assert.ok(finalTicket.feedback && finalTicket.feedback.rating === 5);
  console.log(`   ✅ Feedback successfully visible on ticket: ${finalTicket.feedback.rating} stars - "${finalTicket.feedback.comment}"`);

  console.log('\n🎉 ALL STUDENT-AUTHORITY LIFECYCLE REQUIREMENTS VERIFIED AND WORKING 100%!\n');
}

testWorkflow().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
