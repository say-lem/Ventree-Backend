# Notification Module Integration Guide

This guide explains how to integrate the Notification Module with other services in the Ventree backend.

## Table of Contents

1. [AuthService Integration](#authservice-integration)
2. [ShopService Integration](#shopservice-integration)
3. [StaffService Integration](#staffservice-integration)
4. [InventoryService Integration](#inventoryservice-integration)
5. [SalesService Integration](#salesservice-integration)
6. [API Gateway Integration](#api-gateway-integration)
7. [Redis Integration](#redis-integration)

---

## AuthService Integration

### Current State (Mock)

The module currently uses mock authentication via headers:

```typescript
// src/modules/notification/middleware/mock-auth.middleware.ts
req.user = {
  userId: parseInt(req.headers['x-mock-user-id'] as string) || 1,
  shopId: parseInt(req.headers['x-mock-shop-id'] as string) || 1,
  role: (req.headers['x-mock-role'] as 'ownerProfile' | 'staff') || 'ownerProfile',
  profileId: parseInt(req.headers['x-mock-profile-id'] as string) || 1,
  replicaId: (req.headers['x-mock-replica-id'] as string) || `mock-${Date.now()}`,
};
```

### Integration Steps

1. **Replace Mock Middleware**

```typescript
// src/modules/notification/notification.routes.ts
import { Router } from 'express';
import { verifyJWT } from '../auth/middleware/jwt.middleware'; // Real JWT middleware

const router = Router();

// Replace mockAuthMiddleware with real JWT verification
router.use(verifyJWT);

// Rest of routes...
```

2. **Update Auth Context Interface**

```typescript
// src/modules/notification/interfaces/auth.interface.ts
export interface AuthContext {
  userId: number;
  shopId: number;
  role: 'ownerProfile' | 'staff';
  profileId: number;
  replicaId: string;
}

// This should match the structure from AuthService JWT payload
```

3. **JWT Payload Structure**

Ensure AuthService JWT includes:

```typescript
{
  userId: number,
  shopId: number,
  role: 'ownerProfile' | 'staff',
  profileId: number,  // ownerProfileId or staffId
  replicaId: string   // CRDT replica identifier
}
```

---

## ShopService Integration

### Current State (Mock)

Shop validation is currently mocked:

```typescript
// src/modules/notification/notification.service.ts
private async validateShopAccess(shopId: number, authContext: MockAuthContext): Promise<void> {
  if (authContext.shopId !== shopId) {
    throw new AuthorizationError('You do not have access to this shop');
  }
  // TODO: Replace with real ShopService validation
}
```

### Integration Steps

1. **Import ShopService**

```typescript
// src/modules/notification/notification.service.ts
import { ShopService } from '../shop/shop.service';
```

2. **Replace Mock Validation**

```typescript
private async validateShopAccess(shopId: number, authContext: AuthContext): Promise<void> {
  // Validate shop exists
  const shopExists = await ShopService.validateShopExists(shopId);
  if (!shopExists) {
    throw new NotFoundError('Shop not found');
  }

  // Validate user has access to shop
  if (authContext.shopId !== shopId) {
    throw new AuthorizationError('You do not have access to this shop');
  }

  // For staff, validate they belong to the shop
  if (authContext.role === 'staff') {
    const belongsToShop = await ShopService.validateStaffBelongsToShop(
      authContext.profileId,
      shopId
    );
    if (!belongsToShop) {
      throw new AuthorizationError('Staff does not belong to this shop');
    }
  }
}
```

3. **Required ShopService Methods**

```typescript
// src/modules/shop/shop.service.ts
export class ShopService {
  async validateShopExists(shopId: number): Promise<boolean> {
    const shop = await ShopModel.findOne({ id: shopId });
    return shop !== null;
  }

  async getShopOwner(shopId: number): Promise<number> {
    const shop = await ShopModel.findOne({ id: shopId });
    if (!shop) throw new NotFoundError('Shop not found');
    return shop.ownerProfileId;
  }

  async validateStaffBelongsToShop(staffId: number, shopId: number): Promise<boolean> {
    const staff = await StaffModel.findOne({ id: staffId, shopId });
    return staff !== null;
  }
}
```

---

## StaffService Integration

### Current State (Mock)

Permission checking is currently mocked:

```typescript
// src/modules/notification/middleware/check-permissions.middleware.ts
const hasPermission = true; // Mock
```

### Integration Steps

1. **Import StaffService**

```typescript
// src/modules/notification/middleware/check-permissions.middleware.ts
import { StaffService } from '../../staff/staff.service';
```

2. **Replace Mock Permission Check**

```typescript
export const checkNotificationPermission = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { role, profileId } = req.user!;

  // Owner has full permissions
  if (role === 'ownerProfile') {
    return next();
  }

  // Staff permission check
  if (role === 'staff') {
    const permissions = await StaffService.getStaffPermissions(profileId);
    
    if (!permissions.notifications) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions to manage notifications',
      });
    }
  }

  next();
};
```

3. **Required StaffService Methods**

```typescript
// src/modules/staff/staff.service.ts
export class StaffService {
  async getStaffPermissions(staffId: number): Promise<StaffPermissions> {
    const permissions = await PermissionsModel.findOne({ staffId });
    if (!permissions) {
      throw new NotFoundError('Staff permissions not found');
    }
    return permissions;
  }

  async validateStaffBelongsToShop(staffId: number, shopId: number): Promise<boolean> {
    const staff = await StaffModel.findOne({ id: staffId, shopId });
    return staff !== null;
  }
}
```

---

## InventoryService Integration

### Current State (Stubs)

Auto-notification triggers are stubbed:

```typescript
// src/modules/notification/triggers/auto-notifications.ts
static async onLowStock(...) {
  // TODO: Integrate with InventoryService
}
```

### Integration Steps

1. **In InventoryService - Low Stock Alert**

```typescript
// src/modules/inventory/inventory.service.ts
import { AutoNotificationTriggers } from '../notification/triggers/auto-notifications';

export class InventoryService {
  async updateStock(
    inventoryId: number,
    shopId: number,
    quantity: number,
    authContext: AuthContext
  ): Promise<void> {
    const inventory = await InventoryModel.findOne({ id: inventoryId, shopId });
    if (!inventory) throw new NotFoundError('Inventory not found');

    const oldQuantity = inventory.quantity;
    inventory.quantity = quantity;
    await inventory.save();

    // Trigger low stock notification
    if (quantity < inventory.lowStockThreshold && quantity > 0) {
      await AutoNotificationTriggers.onLowStock(
        inventoryId,
        shopId,
        inventory.productName,
        quantity,
        inventory.unit,
        inventory.lowStockThreshold,
        authContext
      );
    }

    // Trigger out of stock notification
    if (quantity === 0) {
      await AutoNotificationTriggers.onOutOfStock(
        inventoryId,
        shopId,
        inventory.productName,
        authContext
      );
    }

    // Trigger inventory updated notification
    if (oldQuantity !== quantity) {
      await AutoNotificationTriggers.onInventoryUpdated(
        inventoryId,
        shopId,
        inventory.productName,
        oldQuantity,
        quantity,
        inventory.unit,
        authContext.role === 'staff' ? 'Staff' : 'Owner',
        authContext
      );
    }
  }
}
```

---

## SalesService Integration

### Current State (Stubs)

Sale completion notifications are stubbed.

### Integration Steps

1. **In SalesService - Sale Completed**

```typescript
// src/modules/sales/sales.service.ts
import { AutoNotificationTriggers } from '../notification/triggers/auto-notifications';

export class SalesService {
  async createSale(saleData: CreateSaleDto, authContext: AuthContext): Promise<Sale> {
    // Create sale transaction
    const sale = await SaleModel.create(saleData);

    // Get staff name
    const staffName = authContext.role === 'staff' 
      ? await this.getStaffName(authContext.profileId)
      : 'Owner';

    // Trigger sale completed notification
    await AutoNotificationTriggers.onSaleCompleted(
      sale.id,
      sale.shopId,
      authContext.profileId,
      sale.items.length,
      sale.total,
      sale.currency || 'NGN',
      staffName,
      authContext
    );

    return sale;
  }

  private async getStaffName(staffId: number): Promise<string> {
    const staff = await StaffModel.findOne({ id: staffId });
    return staff?.name || 'Staff';
  }
}
```

---

## API Gateway Integration

### Mount Notification Routes

```typescript
// src/app.ts or src/server.ts
import express from 'express';
import notificationRoutes from './modules/notification';

const app = express();

// Middleware
app.use(express.json());

// Mount notification routes
app.use('/api/v1/notifications', notificationRoutes);

// Other routes...
```

### Error Handling

Ensure global error handler catches notification errors:

```typescript
// src/middleware/errorHandler.ts
import { AppError } from './shared/utils/AppError';

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      details: err instanceof ValidationError ? err.details : undefined,
    });
  }

  // Log unexpected errors
  console.error('Unexpected error:', err);

  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});
```

---

## Redis Integration

### Setup Redis Client

```typescript
// src/config/redis.ts
import Redis from 'ioredis';

export const redisPublisher = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

export const redisSubscriber = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
});
```

### Initialize Notification Emitter

```typescript
// src/app.ts
import { NotificationEmitter } from './modules/notification/notification.emitter';
import { redisPublisher, redisSubscriber } from './config/redis';

// Initialize notification emitter
export const notificationEmitter = new NotificationEmitter(
  redisPublisher,
  redisSubscriber
);

// Subscribe to shop notifications (example)
notificationEmitter.subscribeToShop(1, (notification) => {
  console.log('Received notification:', notification);
  // Forward to WebSocket clients
});
```

### Emit Notifications

```typescript
// src/modules/notification/notification.service.ts
import { notificationEmitter } from '../../app';

export class NotificationService {
  async createNotification(input: CreateNotificationInput): Promise<INotification> {
    // Create notification in database
    const notification = await this.repository.create(notificationData);

    // Emit via Redis pub/sub
    if (notification.staffId) {
      await notificationEmitter.emitToStaff(
        notification.shopId,
        notification.staffId,
        notification
      );
    } else if (notification.ownerProfileId) {
      await notificationEmitter.emitToOwner(
        notification.shopId,
        notification.ownerProfileId,
        notification
      );
    } else {
      // Broadcast to all
      await notificationEmitter.emitToShop(notification.shopId, notification);
    }

    return notification;
  }
}
```

---

## Environment Variables

Add to `.env`:

```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# JWT Configuration (for AuthService integration)
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_EXPIRES_IN=7d

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/ventree
```

---

## Testing Integration

### Integration Test Example

```typescript
// src/modules/notification/__tests__/integration.spec.ts
import request from 'supertest';
import { app } from '../../app';
import { generateJWT } from '../auth/utils/jwt.util';

describe('Notification API Integration', () => {
  let authToken: string;

  beforeAll(async () => {
    // Generate real JWT token
    authToken = generateJWT({
      userId: 1,
      shopId: 1,
      role: 'ownerProfile',
      profileId: 1,
      replicaId: 'test-replica-1',
    });
  });

  it('should create notification with real auth', async () => {
    const response = await request(app)
      .post('/api/v1/notifications')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        shopId: 1,
        recipientType: 'staff',
        recipientId: 2,
        message: 'Test notification',
        type: 'custom',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('vectorClock');
  });
});
```

---

## Checklist

- [ ] Replace mock auth middleware with real JWT verification
- [ ] Integrate ShopService for shop validation
- [ ] Integrate StaffService for permission checking
- [ ] Add auto-triggers to InventoryService
- [ ] Add auto-triggers to SalesService
- [ ] Setup Redis client and emitter
- [ ] Mount notification routes in API Gateway
- [ ] Update environment variables
- [ ] Write integration tests
- [ ] Update API documentation

---

## Support

For questions or issues with integration, contact the backend team or refer to the main architecture document.
