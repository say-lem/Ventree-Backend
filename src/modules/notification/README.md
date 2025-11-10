# Notification Management Module

A comprehensive notification system for Ventree IBS with CRDT-based synchronization, offline-first support, and real-time delivery.

## Features

- **CRDT-based Synchronization**: Vector clock implementation for conflict-free replication
- **Real-time Delivery**: Redis pub/sub and WebSocket support for instant notifications
- **Offline Support**: Works seamlessly with offline-first PWA architecture
- **Multi-recipient**: Support for owner, staff, and broadcast notifications
- **Type System**: Predefined notification types with template engine
- **Permission-based**: Role-based access control for notification management
- **Scalable**: Designed for horizontal scaling with cross-instance broadcasting

## Architecture Alignment

This module follows the Ventree Backend Architecture Document:

- **Modular Monolith Pattern**: Clear service boundaries and separation of concerns
- **CRDT-based Sync**: Vector clocks for eventual consistency
- **Event-Driven**: Redis pub/sub for async processing
- **Stateless API**: No server-side session state
- **MongoDB Primary Storage**: With optimized indexes
- **Redis for Caching**: And cross-instance pub/sub

## Module Structure

```
notification/
├── controllers/
│   └── notification.controller.ts    # HTTP request handlers
├── services/
│   └── notification.service.ts       # Business logic layer
├── repositories/
│   └── notification.repository.ts    # Data access layer
├── routes/
│   └── notification.routes.ts        # API routes
├── emitters/
│   └── notification.emitter.ts       # Redis pub/sub emitter
├── websockets/
│   └── notification.websocket.ts     # WebSocket handler (stub)
├── schemas/
│   └── notification.schema.ts        # Mongoose schema with indexes
├── dto/
│   ├── create-notification.dto.ts    # Create notification validation
│   ├── query-notifications.dto.ts    # Query validation
│   └── mark-read.dto.ts              # Mark read validation
├── middleware/
│   ├── mock-auth.middleware.ts       # Mock JWT auth (temporary)
│   └── check-permissions.middleware.ts # Permission checking
├── interfaces/
│   ├── mock-auth.interface.ts        # Mock auth context (temporary)
│   └── mock-services.interface.ts    # Mock service interfaces (temporary)
├── types/
│   └── notification-types.ts         # Notification type definitions
├── utils/
│   ├── vector-clock.util.ts          # CRDT vector clock implementation
│   └── notification-template.util.ts # Message template engine
├── triggers/
│   └── auto-notifications.ts         # Auto-notification stubs
├── docs/
│   └── CRDT_VECTOR_CLOCK.md          # CRDT documentation
├── index.ts                          # Module exports
├── README.md                         # This file
├── INTEGRATION.md                    # Integration guide
└── MODULE_SUMMARY.md                 # Implementation summary
```

## API Endpoints

### Create Notification
```http
POST /api/v1/notifications
Content-Type: application/json
x-mock-shop-id: 1
x-mock-user-id: 1
x-mock-role: ownerProfile
x-mock-profile-id: 1

{
  "shopId": 1,
  "recipientType": "staff",
  "recipientId": 2,
  "message": "Low stock alert for Product A",
  "type": "low_stock",
  "inventoryId": 123,
  "metadata": {
    "productName": "Product A",
    "quantity": 5,
    "unit": "pieces"
  }
}
```

### Get Notifications
```http
GET /api/v1/notifications?shopId=1&unreadOnly=true&limit=20&offset=0
x-mock-shop-id: 1
x-mock-user-id: 1
x-mock-role: staff
x-mock-profile-id: 2
```

### Get Unread Count
```http
GET /api/v1/notifications/unread-count?shopId=1
x-mock-shop-id: 1
x-mock-user-id: 1
```

### Mark as Read
```http
PATCH /api/v1/notifications/:id/read
x-mock-shop-id: 1
x-mock-user-id: 1
```

### Bulk Mark as Read
```http
PATCH /api/v1/notifications/mark-read
Content-Type: application/json

{
  "notificationIds": ["id1", "id2", "id3"]
}
```

### Delete Notification
```http
DELETE /api/v1/notifications/:id
x-mock-shop-id: 1
x-mock-user-id: 1
```

## Notification Types

- `low_stock` - Low stock alert
- `out_of_stock` - Out of stock alert
- `sale_completed` - Sale transaction completed
- `inventory_updated` - Inventory quantity changed
- `staff_action` - Staff created/deleted/updated
- `system` - System alerts
- `custom` - Custom notifications

## CRDT Vector Clock

The module implements vector clocks for conflict-free replication:

```typescript
// Initialize vector clock
const clock = VectorClockUtil.init(replicaId);

// Increment on update
const newClock = VectorClockUtil.increment(clock, replicaId);

// Merge clocks from different replicas
const merged = VectorClockUtil.merge(clockA, clockB);

// Compare for causal ordering
const comparison = VectorClockUtil.compare(clockA, clockB);
// Returns: -1 (A before B), 0 (concurrent), 1 (B before A)
```

## Database Schema

```typescript
{
  shopId: number,              // Shop identifier
  ownerProfileId?: number,     // Target owner (optional)
  staffId?: number,            // Target staff (optional)
  inventoryId?: number,        // Related inventory item (optional)
  message: string,             // Notification message (max 500 chars)
  isRead: boolean,             // Read status
  vectorClock: VectorClock,    // CRDT vector clock
  type: NotificationType,      // Notification type
  metadata?: object,           // Additional data
  created_at: Date,
  updated_at: Date
}
```

### Indexes

- `{ shopId: 1, created_at: -1 }` - Shop notifications sorted by date
- `{ shopId: 1, staffId: 1, isRead: 1 }` - Staff unread notifications
- `{ shopId: 1, ownerProfileId: 1, isRead: 1 }` - Owner unread notifications
- `{ shopId: 1, type: 1, created_at: -1 }` - Notifications by type

## Integration Points

### With AuthService (When Available)

Replace `mockAuthMiddleware` with real JWT verification:

```typescript
import { verifyJWT } from '@/modules/auth/middleware/jwt.middleware';
router.use(verifyJWT);
```

### With StaffService (When Available)

Replace mock permission checks:

```typescript
import { StaffService } from '@/modules/staff/staff.service';
const permissions = await StaffService.getStaffPermissions(staffId);
if (!permissions.notifications) {
  throw new AuthorizationError('Insufficient permissions');
}
```

### With InventoryService (When Available)

Integrate auto-triggers:

```typescript
// In InventoryService.updateStock()
if (newQuantity < LOW_STOCK_THRESHOLD) {
  await AutoNotificationTriggers.onLowStock(
    inventoryId, shopId, productName, newQuantity, unit, threshold, authContext
  );
}
```

### With SalesService (When Available)

Integrate sale notifications:

```typescript
// In SalesService.createSale()
await AutoNotificationTriggers.onSaleCompleted(
  saleId, shopId, staffId, itemCount, total, currency, staffName, authContext
);
```

## Real-time Delivery

### Redis Pub/Sub

```typescript
import { NotificationEmitter } from './notification.emitter';

// Initialize emitter
const emitter = new NotificationEmitter(redisPublisher, redisSubscriber);

// Emit to shop
await emitter.emitToShop(shopId, notification);

// Emit to specific user
await emitter.emitToUser(userId, notification);

// Subscribe to notifications
await emitter.subscribeToShop(shopId, (notification) => {
  // Handle notification
});
```

### WebSocket (Stub)

```typescript
import { NotificationWebSocketHandler } from './notification.websocket';

const wsHandler = new NotificationWebSocketHandler();

// Register connection
wsHandler.registerConnection(connectionId, ws, userId, shopId, role, profileId);

// Send to client
wsHandler.sendToClient(userId, notification);

// Broadcast to shop
wsHandler.broadcastToShop(shopId, notification);
```

## Testing

### Manual Testing with Postman

1. Create a Postman collection
2. Add mock auth headers to all requests:
   - `x-mock-user-id`: User ID
   - `x-mock-shop-id`: Shop ID
   - `x-mock-role`: ownerProfile or staff
   - `x-mock-profile-id`: Profile ID
   - `x-mock-replica-id`: Replica identifier

3. Test all CRUD operations
4. Test concurrent notifications (vector clock merge)
5. Test pagination and filtering

### Unit Tests (To be implemented)

```bash
npm run test:notification
npm run test:notification:coverage
```

## Performance Considerations

- **Indexes**: All queries use compound indexes for optimal performance
- **Pagination**: Default limit of 20, max 100 per request
- **Caching**: Unread counts can be cached in Redis
- **Batch Operations**: Bulk mark-as-read for efficiency
- **Connection Pooling**: MongoDB and Redis use connection pools

## Security

- **Input Validation**: All inputs validated with express-validator
- **Authorization**: Role-based access control
- **Message Sanitization**: Prevents XSS attacks
- **Rate Limiting**: Should be added at API Gateway level
- **Audit Logging**: All operations logged with correlation IDs

## Future Enhancements

- [ ] Push notifications (FCM/APNS)
- [ ] Email notifications
- [ ] SMS notifications
- [ ] Notification preferences per user
- [ ] Notification scheduling
- [ ] Notification templates management UI
- [ ] Advanced filtering and search
- [ ] Notification analytics

## Dependencies

- `express` - Web framework
- `mongoose` - MongoDB ODM
- `express-validator` - Input validation
- `redis` (future) - Pub/sub and caching
- Shared utilities: `asyncHandler`, `AppError`

## License

Internal use only - Ventree IBS
