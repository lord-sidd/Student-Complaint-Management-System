const assert = require('assert');

function runDeduplicationUnitTests() {
  console.log('🧪 Testing Complaint Deduplication Logic...\n');

  function getComplaintId(c) {
    if (!c) return '';
    return String(c.ticketId || c.id || '').trim();
  }

  function deduplicateComplaints(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const result = [];
    for (const c of list) {
      if (!c) continue;
      const cid = String(c.ticketId || c.id || '').trim();
      const mongoId = c._id ? String(c._id).trim() : '';
      const key = cid || mongoId;
      if (!key) {
        result.push(c);
        continue;
      }
      if (!seen.has(key)) {
        seen.add(key);
        if (cid) seen.add(cid);
        if (mongoId) seen.add(mongoId);
        result.push(c);
      }
    }
    return result;
  }

  let complaintsData = [];

  function upsertComplaint(complaint, prepend = true) {
    if (!complaint) return;
    const targetId = String(complaint.ticketId || complaint.id || '').trim();
    const mongoId = complaint._id ? String(complaint._id).trim() : '';

    const idx = complaintsData.findIndex(c => {
      const cId = String(c.ticketId || c.id || '').trim();
      if (targetId && cId && targetId === cId) return true;
      if (mongoId && c._id && String(c._id).trim() === mongoId) return true;
      return false;
    });

    if (idx !== -1) {
      complaintsData[idx] = { ...complaintsData[idx], ...complaint };
    } else {
      if (prepend) {
        complaintsData.unshift(complaint);
      } else {
        complaintsData.push(complaint);
      }
    }
    complaintsData = deduplicateComplaints(complaintsData);
  }

  // Simulation 1: Socket arrives first, then HTTP fetch resolves
  console.log('1️⃣ Simulating Socket.IO event arriving BEFORE HTTP response...');
  complaintsData = [];
  const ticketFromSocket = { id: 'CMP-2026-9999', ticketId: 'CMP-2026-9999', title: 'Socket Ticket', department: 'IT' };
  const ticketFromHttp = { id: 'CMP-2026-9999', ticketId: 'CMP-2026-9999', title: 'Socket Ticket (HTTP enriched)', department: 'IT' };

  upsertComplaint(ticketFromSocket, true);
  assert.strictEqual(complaintsData.length, 1);

  upsertComplaint(ticketFromHttp, true);
  assert.strictEqual(complaintsData.length, 1, `Expected 1 complaint, found ${complaintsData.length}`);
  assert.strictEqual(complaintsData[0].title, 'Socket Ticket (HTTP enriched)');
  console.log('   ✅ Handled cleanly: Ticket was NOT duplicated (Count = 1).');

  // Simulation 2: HTTP fetch resolves first, then Socket.IO arrives
  console.log('\n2️⃣ Simulating HTTP response resolving BEFORE Socket.IO event...');
  complaintsData = [];
  upsertComplaint(ticketFromHttp, true);
  assert.strictEqual(complaintsData.length, 1);

  upsertComplaint(ticketFromSocket, true);
  assert.strictEqual(complaintsData.length, 1, `Expected 1 complaint, found ${complaintsData.length}`);
  console.log('   ✅ Handled cleanly: Ticket was NOT duplicated (Count = 1).');

  // Simulation 3: Deduplicating an existing dirty array with multiple duplicates
  console.log('\n3️⃣ Simulating deduplication of dirty legacy arrays with repeated tickets...');
  const dirtyList = [
    { id: 'CMP-1', ticketId: 'CMP-1', title: 'A' },
    { id: 'CMP-1', ticketId: 'CMP-1', title: 'A copy 1' },
    { id: 'CMP-2', ticketId: 'CMP-2', title: 'B' },
    { id: 'CMP-1', ticketId: 'CMP-1', title: 'A copy 2' },
    { id: 'CMP-3', ticketId: 'CMP-3', title: 'C' },
    { id: 'CMP-2', ticketId: 'CMP-2', title: 'B copy 1' }
  ];
  const cleanList = deduplicateComplaints(dirtyList);
  assert.strictEqual(cleanList.length, 3, `Expected 3 unique items, got ${cleanList.length}`);
  assert.deepStrictEqual(cleanList.map(c => c.id), ['CMP-1', 'CMP-2', 'CMP-3']);
  console.log('   ✅ Dirty list pruned from 6 items down to 3 unique items.');

  console.log('\n🎉 ALL DEDUPLICATION TESTS PASSED WITH 100% SUCCESS!\n');
}

runDeduplicationUnitTests();

