import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { AutoNotificationTriggers } from '../src/modules/notification';

// Load environment variables
dotenv.config();

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || '';
if (!MONGO_URI) {
  console.error('❌ MONGO_URI is missing in .env');
  process.exit(1);
}

/**
 * Test script to verify all notification triggers work correctly
 * Run with: npx ts-node scripts/test-notification-triggers.ts
 */

const SHOP_ID = '6915f51e6ddd4cecd38e7393'; 
const OWNER_PROFILE_ID = 'owner'; 

// auth context (owner)
const authContext = {
  shopId: SHOP_ID,
  role: 'owner' as const,
  profileId: OWNER_PROFILE_ID,
};

async function testAllTriggers() {
  console.log('🧪 Testing Notification Triggers...\n');
  console.log('📡 Make sure Redis subscription is active to see messages!\n');

  try {
    // Test 1: Low Stock Notification
    console.log('1️⃣ Testing onLowStock...');
    await AutoNotificationTriggers.onLowStock(
      1001, // inventoryId 
      SHOP_ID,
      'Premium Widget',
      5, // quantity
      'pcs',
      10, // threshold
      authContext
    );
    console.log('   ✅ Low stock notification created\n');
    await delay(1000);

    // Test 2: Out of Stock Notification (broadcast)
    console.log('2️⃣ Testing onOutOfStock...');
    await AutoNotificationTriggers.onOutOfStock(
      1002, // inventoryId (will be converted to ObjectId by service)
      SHOP_ID,
      'Basic Widget',
      authContext
    );
    console.log('   ✅ Out of stock notification created (broadcast to all)\n');
    await delay(1000);

    // Test 3: Sale Completed Notification
    console.log('3️⃣ Testing onSaleCompleted...');
    await AutoNotificationTriggers.onSaleCompleted(
      'sale-001',
      SHOP_ID,
      'staff-123', // staffId
      3, // itemCount
      1500, // total
      'NGN', // currency
      'John Doe', // staffName
      authContext
    );
    console.log('   ✅ Sale completed notification created\n');
    await delay(1000);

    // Test 4: Inventory Updated Notification
    console.log('4️⃣ Testing onInventoryUpdated...');
    await AutoNotificationTriggers.onInventoryUpdated(
      1003, // inventoryId (will be converted to ObjectId by service)
      SHOP_ID,
      'Deluxe Widget',
      20, // oldQuantity
      35, // newQuantity
      'pcs',
      'system-test', // updatedBy
      authContext
    );
    console.log('   ✅ Inventory updated notification created\n');
    await delay(1000);

    // Test 5: Staff Created Notification
    console.log('5️⃣ Testing onStaffCreated...');
    await AutoNotificationTriggers.onStaffCreated(
      SHOP_ID,
      'Jane Smith',
      'Owner', // performedBy
      authContext
    );
    console.log('   ✅ Staff created notification created\n');
    await delay(1000);

    // Test 6: Staff Deleted Notification
    console.log('6️⃣ Testing onStaffDeleted...');
    await AutoNotificationTriggers.onStaffDeleted(
      SHOP_ID,
      'Jane Smith',
      'Owner', // performedBy
      authContext
    );
    console.log('   ✅ Staff deleted notification created\n');
    await delay(1000);

    // Test 7: System Alert Notification (broadcast)
    console.log('7️⃣ Testing onSystemAlert...');
    await AutoNotificationTriggers.onSystemAlert(
      SHOP_ID,
      'warning',
      'System maintenance scheduled',
      'Scheduled maintenance on Nov 15, 2025 from 2-4 AM',
      authContext
    );
    console.log('   ✅ System alert notification created (broadcast to all)\n');
    await delay(1000);

    // Test 8: System Alert - Error
    console.log('8️⃣ Testing onSystemAlert (error type)...');
    await AutoNotificationTriggers.onSystemAlert(
      SHOP_ID,
      'error',
      'Database connection issue detected',
      'Connection timeout after 30 seconds',
      authContext
    );
    console.log('   ✅ System error alert created\n');
    await delay(1000);

    // Test 9: System Alert - Info
    console.log('9️⃣ Testing onSystemAlert (info type)...');
    await AutoNotificationTriggers.onSystemAlert(
      SHOP_ID,
      'info',
      'New feature available',
      'Real-time notifications are now enabled',
      authContext
    );
    console.log('   ✅ System info alert created\n');

    console.log('\n✅ All notification triggers tested successfully!');
    console.log('📡 Check your Redis subscription to see all messages.');
    console.log('📊 Check MongoDB notifications collection to verify persistence.');

  } catch (error) {
    console.error('❌ Error testing triggers:', error);
    process.exit(1);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Connect to MongoDB and run tests
async function main() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connected successfully\n');

    // Run the tests
    await testAllTriggers();

    console.log('\n✨ Test script completed');
  } catch (error) {
    console.error('💥 Test script failed:', error);
    process.exit(1);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
    process.exit(0);
  }
}

main();

