import RideModel from './tripa-app/src/models/Ride.js';
import { testConnection, pool } from './tripa-app/src/config/db.js';
import UserModel from './tripa-app/src/models/User.js';

async function runTests() {
  console.log('Starting verification tests for bidirectional search toggle...');
  try {
    await testConnection();
  } catch (err) {
    console.error('Failed to connect to the DB:', err);
    process.exit(1);
  }

  let testUserId = null;
  let createdTestUser = false;

  // Resolve a valid user ID to avoid foreign key constraint issues
  try {
    const [users] = await pool.execute('SELECT id FROM users LIMIT 1');
    if (users && users.length > 0) {
      testUserId = users[0].id;
      console.log(`Using existing user ID for test: ${testUserId}`);
    } else {
      console.log('No users found in database. Creating a temporary test user...');
      const user = await UserModel.create({
        name: 'Test Tester',
        mobile: '9999999900',
        password: 'password123',
        role: 'driver'
      });
      testUserId = user.id;
      createdTestUser = true;
      console.log(`Created temporary test user ID: ${testUserId}`);
    }
  } catch (err) {
    console.error('Error finding/creating test user:', err);
    process.exit(1);
  }

  // 1. Create a ride Dehradun -> Joshimath with allowReverse = true
  console.log('\n--- Test 1: Create Ride with allowReverse = true ---');
  let ride1 = null;
  try {
    ride1 = await RideModel.create({
      userId: testUserId,
      driverName: 'Test Driver A',
      phoneNumber: '9999999991',
      vehicleName: 'Test Swift Dzire',
      fromLocation: 'Dehradun',
      toLocation: 'Joshimath',
      travelDate: '2026-06-20',
      travelTime: '09:00:00',
      bookingFrequency: 'specific_date',
      price: '500',
      priceMode: 'fixed',
      rideType: 'sharing',
      allowReverse: true
    });
    console.log(`Created Ride 1 ID: ${ride1.id}, allowReverse: ${ride1.allowReverse}`);
  } catch (err) {
    console.error('Error creating Ride 1:', err);
  }

  // 2. Create a ride Dehradun -> Joshimath with allowReverse = false
  console.log('\n--- Test 2: Create Ride with allowReverse = false ---');
  let ride2 = null;
  try {
    ride2 = await RideModel.create({
      userId: testUserId,
      driverName: 'Test Driver B',
      phoneNumber: '9999999992',
      vehicleName: 'Test Ertiga',
      fromLocation: 'Dehradun',
      toLocation: 'Joshimath',
      travelDate: '2026-06-20',
      travelTime: '10:00:00',
      bookingFrequency: 'specific_date',
      price: '600',
      priceMode: 'fixed',
      rideType: 'sharing',
      allowReverse: false
    });
    console.log(`Created Ride 2 ID: ${ride2.id}, allowReverse: ${ride2.allowReverse}`);
  } catch (err) {
    console.error('Error creating Ride 2:', err);
  }

  // 3. Search: From Dehradun -> Joshimath (Direct Search)
  // Both rides should match because both have Dehradun -> Joshimath as the direct route
  console.log('\n--- Test 3: Search Dehradun -> Joshimath (Direct) ---');
  try {
    const searchRes = await RideModel.search({
      fromLocation: 'Dehradun',
      toLocation: 'Joshimath',
      travelDate: '2026-06-20'
    });
    const foundIds = searchRes.rides.map(r => r.id);
    console.log('Found ride IDs in search:', foundIds);
    const hasRide1 = foundIds.includes(ride1.id);
    const hasRide2 = foundIds.includes(ride2.id);
    console.log(`Ride 1 found: ${hasRide1} (Expected: true)`);
    console.log(`Ride 2 found: ${hasRide2} (Expected: true)`);
    if (hasRide1 && hasRide2) {
      console.log('✅ Test 3 PASSED');
    } else {
      console.error('❌ Test 3 FAILED');
    }
  } catch (err) {
    console.error('Search error in Test 3:', err);
  }

  // 4. Search: From Joshimath -> Dehradun (Reverse Search)
  // Only Ride 1 (allowReverse = true) should match.
  // Ride 2 (allowReverse = false) should NOT match.
  console.log('\n--- Test 4: Search Joshimath -> Dehradun (Reverse) ---');
  try {
    const searchRes = await RideModel.search({
      fromLocation: 'Joshimath',
      toLocation: 'Dehradun',
      travelDate: '2026-06-20'
    });
    const foundIds = searchRes.rides.map(r => r.id);
    console.log('Found ride IDs in search:', foundIds);
    const hasRide1 = foundIds.includes(ride1.id);
    const hasRide2 = foundIds.includes(ride2.id);
    console.log(`Ride 1 found (reverse): ${hasRide1} (Expected: true)`);
    console.log(`Ride 2 found (reverse): ${hasRide2} (Expected: false)`);
    if (hasRide1 && !hasRide2) {
      console.log('✅ Test 4 PASSED');
    } else {
      console.error('❌ Test 4 FAILED');
    }
  } catch (err) {
    console.error('Search error in Test 4:', err);
  }

  // Clean up
  console.log('\nCleaning up test data...');
  try {
    if (ride1) {
      await RideModel.delete(ride1.id, testUserId);
      console.log(`Deleted Ride 1 ID: ${ride1.id}`);
    }
    if (ride2) {
      await RideModel.delete(ride2.id, testUserId);
      console.log(`Deleted Ride 2 ID: ${ride2.id}`);
    }
    if (createdTestUser) {
      await pool.execute('DELETE FROM users WHERE id = ?', [testUserId]);
      console.log(`Deleted temporary test user ID: ${testUserId}`);
    }
    console.log('Cleanup completed successfully.');
  } catch (err) {
    console.error('Cleanup error:', err);
  }

  // End connection pool
  await pool.end();
}

runTests();
