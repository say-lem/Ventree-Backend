import dotenv from 'dotenv';

import mongoose from 'mongoose';
import Redis from 'ioredis';
import { NotificationModel } from '../src/modules/notification/models/notification.model';

// Load environment variables
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || '';
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');

if (!MONGO_URI) {
  console.error('❌ MONGO_URI is missing in .env');
  process.exit(1);
}

async function verifyNotifications() {
  console.log('🔍 Verifying Notifications in Database and Redis...\n');

  try {
    //
    // 1️⃣ CONNECT TO MONGODB
    //
    console.log('📦 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connected\n');

    //
    // 2️⃣ CONNECT TO REDIS
    //
    console.log('📡 Connecting to Redis...');
    const redis = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0'),
    });

    redis.on('error', (err) => console.error('REDIS ERROR:', err));

    await redis.ping();
    console.log('✅ Redis connected\n');

    //
    // 3️⃣ GET ALL NOTIFICATIONS FROM DB
    //
    const allNotifications = await NotificationModel.find({}).lean();

    console.log('📊 Checking existing notifications in database...');
    console.log('─'.repeat(70));

    if (allNotifications.length === 0) {
      console.log('   No notifications found.\n');
    } else {
      const byShop = new Map<string, any[]>();
      allNotifications.forEach((notif: any) => {
        const shopId = notif.shopId?.toString() || 'NO SHOP';
        if (!byShop.has(shopId)) byShop.set(shopId, []);
        byShop.get(shopId)!.push(notif);
      });

      byShop.forEach((notifications, shopId) => {
        const read = notifications.filter((n) => n.isRead);
        const unread = notifications.filter((n) => !n.isRead);

        console.log(`\n🏪 SHOP: ${shopId}`);
        console.log(`   Total:  ${notifications.length}`);
        console.log(`   Read:   ${read.length}`);
        console.log(`   Unread: ${unread.length}`);

        console.log('\n   - Recent sample:');
        notifications.slice(0, 5).forEach((n) => {
          console.log(
            `     [${n.type}] ${n.message.substring(0, 50)}... (${n.isRead ? 'READ' : 'UNREAD'})`
          );
        });

        if (notifications.length > 5) {
          console.log(`     ...and ${notifications.length - 5} more`);
        }
      });
    }

    console.log('\n' + '─'.repeat(70));
    console.log('🎯 Now listening for new Redis notifications...');
    console.log('   Press Ctrl+C to exit.\n');

    //
    // 4️⃣ SUBSCRIBE TO A SINGLE REDIS PATTERN
    //
    await redis.psubscribe('notifications:*');

    let messageCount = 0;
    const seenMessages = new Set<string>();

    redis.on('pmessage', (pattern: string, channel: string, message: string) => {
      // Avoid duplicate messages
      if (seenMessages.has(message)) return;
      seenMessages.add(message);

      messageCount++;

      try {
        const notification = JSON.parse(message);

        // Determine target type from channel
        let target = 'shop';
        if (channel.includes(':owner:')) target = 'owner';
        else if (channel.includes(':staff:')) target = 'staff';
        else if (channel.includes('user')) target = 'user';

        console.log(`\n📨 NEW ${target.toUpperCase()} NOTIFICATION RECEIVED (${messageCount})`);
        console.log(`   Channel: ${channel}`);
        console.log(`   Pattern: ${pattern}`);
        console.log(`   Type: ${notification.type}`);
        console.log(`   Shop: ${notification.shopId}`);
        console.log(`   Read: ${notification.isRead}`);
        console.log(`   Message: ${notification.message.substring(0, 100)}...`);
        console.log('─'.repeat(70));

      } catch (err) {
        console.error('❌ Error parsing notification:', err);
      }
    });

    //
    // 5️⃣ CLEAN EXIT
    //
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down...');
      await redis.quit();
      await mongoose.connection.close();
      console.log('✅ Connections closed');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

verifyNotifications();
