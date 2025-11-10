# CRDT Vector Clock Documentation

## Overview

The Notification Module uses **Vector Clocks** as a Conflict-free Replicated Data Type (CRDT) to ensure eventual consistency across multiple replicas in an offline-first architecture.

## What is a Vector Clock?

A vector clock is a data structure used to determine the causal ordering of events in a distributed system. Each replica maintains a counter for every other replica it knows about.

### Structure

```typescript
interface VectorClock {
  [replicaId: string]: number;
}

// Example:
{
  "shop:1:owner": 5,
  "shop:1:staff:1": 3,
  "shop:1:staff:2": 7
}
```

## Core Operations

### 1. Initialize

Create a new vector clock for a replica:

```typescript
const clock = VectorClockUtil.init("shop:1:owner");
// Result: { "shop:1:owner": 0 }
```

### 2. Increment

Increment the counter when a local event occurs:

```typescript
const clock = { "shop:1:owner": 5, "shop:1:staff:1": 3 };
const newClock = VectorClockUtil.increment(clock, "shop:1:owner");
// Result: { "shop:1:owner": 6, "shop:1:staff:1": 3 }
```

### 3. Merge

Merge two vector clocks using element-wise maximum:

```typescript
const clockA = { "shop:1:owner": 5, "shop:1:staff:1": 3 };
const clockB = { "shop:1:owner": 3, "shop:1:staff:1": 7 };
const merged = VectorClockUtil.merge(clockA, clockB);
// Result: { "shop:1:owner": 5, "shop:1:staff:1": 7 }
```

**Properties:**
- **Commutative**: merge(A, B) = merge(B, A)
- **Associative**: merge(merge(A, B), C) = merge(A, merge(B, C))
- **Idempotent**: merge(A, A) = A

### 4. Compare

Determine causal ordering between two clocks:

```typescript
const clockA = { "shop:1:owner": 5, "shop:1:staff:1": 3 };
const clockB = { "shop:1:owner": 6, "shop:1:staff:1": 3 };
const result = VectorClockUtil.compare(clockA, clockB);
// Result: -1 (A happened before B)
```

**Return values:**
- `-1`: clockA happened before clockB
- `0`: clocks are concurrent (no causal relationship)
- `1`: clockB happened before clockA

## Use Cases in Notification Module

### 1. Notification Creation

When a notification is created, initialize its vector clock:

```typescript
const notification = {
  shopId: 1,
  message: "Low stock alert",
  vectorClock: VectorClockUtil.init(authContext.replicaId),
  // Other fields...
};
```

### 2. Mark as Read

When marking a notification as read, increment the vector clock:

```typescript
const currentClock = notification.vectorClock;
const newClock = VectorClockUtil.increment(currentClock, authContext.replicaId);

notification.vectorClock = newClock;
notification.isRead = true;
```

### 3. Synchronization

When syncing notifications between replicas:

```typescript
// Local notification
const localNotification = {
  id: "notif-1",
  vectorClock: { "replica-A": 5, "replica-B": 3 }
};

// Remote notification (same ID)
const remoteNotification = {
  id: "notif-1",
  vectorClock: { "replica-A": 3, "replica-B": 7 }
};

// Merge vector clocks
const mergedClock = VectorClockUtil.merge(
  localNotification.vectorClock,
  remoteNotification.vectorClock
);
// Result: { "replica-A": 5, "replica-B": 7 }

// Determine which notification is newer
const comparison = VectorClockUtil.compare(
  localNotification.vectorClock,
  remoteNotification.vectorClock
);

if (comparison === 0) {
  // Concurrent updates - use conflict resolution strategy
  // For notifications, we can merge or use Last-Write-Wins with timestamp
} else if (comparison === -1) {
  // Remote is newer, update local
  localNotification.vectorClock = mergedClock;
} else {
  // Local is newer, keep local
}
```

## Conflict Resolution

### Scenario 1: Concurrent Mark as Read

Two replicas mark the same notification as read offline:

```typescript
// Initial state
const notification = {
  id: "notif-1",
  isRead: false,
  vectorClock: { "replica-A": 0, "replica-B": 0 }
};

// Replica A marks as read
const replicaA = {
  id: "notif-1",
  isRead: true,
  vectorClock: { "replica-A": 1, "replica-B": 0 }
};

// Replica B marks as read (concurrent)
const replicaB = {
  id: "notif-1",
  isRead: true,
  vectorClock: { "replica-A": 0, "replica-B": 1 }
};

// When syncing, merge vector clocks
const merged = VectorClockUtil.merge(
  replicaA.vectorClock,
  replicaB.vectorClock
);
// Result: { "replica-A": 1, "replica-B": 1 }

// Both marked as read, so final state is isRead: true
// No conflict because both operations are idempotent
```

### Scenario 2: Concurrent Create and Delete

```typescript
// Replica A creates notification
const created = {
  id: "notif-2",
  isRead: false,
  vectorClock: { "replica-A": 1, "replica-B": 0 }
};

// Replica B tries to delete (doesn't know about creation yet)
// This is detected as concurrent because:
const comparison = VectorClockUtil.compare(
  { "replica-A": 1, "replica-B": 0 },
  { "replica-A": 0, "replica-B": 1 }
);
// Result: 0 (concurrent)

// Resolution: Creation wins (notification exists)
```

## Best Practices

### 1. Replica ID Format

Use consistent replica ID format:

```typescript
// Owner replica
const ownerReplicaId = `shop:${shopId}:owner:${ownerProfileId}`;

// Staff replica
const staffReplicaId = `shop:${shopId}:staff:${staffId}`;

// Browser/device specific
const deviceReplicaId = `shop:${shopId}:staff:${staffId}:${deviceUUID}`;
```

### 2. Clock Pruning

Periodically remove old replica entries to prevent unbounded growth:

```typescript
function pruneVectorClock(clock: VectorClock, activeReplicas: Set<string>): VectorClock {
  const pruned: VectorClock = {};
  for (const replicaId of activeReplicas) {
    if (clock[replicaId] !== undefined) {
      pruned[replicaId] = clock[replicaId];
    }
  }
  return pruned;
}
```

### 3. Monotonicity

Always increment, never decrement:

```typescript
// ✅ Correct
clock[replicaId] = (clock[replicaId] || 0) + 1;

// ❌ Wrong
clock[replicaId] = 0; // Never reset
```

### 4. Merge Before Update

Always merge incoming clocks before applying updates:

```typescript
// ✅ Correct
const mergedClock = VectorClockUtil.merge(localClock, remoteClock);
notification.vectorClock = VectorClockUtil.increment(mergedClock, replicaId);

// ❌ Wrong
notification.vectorClock = VectorClockUtil.increment(localClock, replicaId);
// This ignores remote updates
```

## Performance Considerations

### Space Complexity

- **O(n)** where n is the number of active replicas
- Typical size: 5-10 replicas per shop (1 owner + up to 5 staff)
- Storage: ~50-100 bytes per vector clock

### Time Complexity

- **Initialize**: O(1)
- **Increment**: O(1)
- **Merge**: O(n) where n is total unique replicas
- **Compare**: O(n) where n is total unique replicas

### Optimization Tips

1. **Limit replica count**: Max 6 replicas per shop (architecture constraint)
2. **Use sparse representation**: Only store non-zero counters
3. **Batch operations**: Merge multiple clocks in one pass
4. **Cache comparisons**: Store comparison results for frequently accessed pairs

## Testing Vector Clocks

### Unit Test Example

```typescript
describe('VectorClockUtil', () => {
  describe('merge', () => {
    it('should take element-wise maximum', () => {
      const clockA = { replica1: 5, replica2: 3 };
      const clockB = { replica1: 3, replica2: 7 };
      const merged = VectorClockUtil.merge(clockA, clockB);
      expect(merged).toEqual({ replica1: 5, replica2: 7 });
    });

    it('should be commutative', () => {
      const clockA = { replica1: 5, replica2: 3 };
      const clockB = { replica1: 3, replica2: 7 };
      const mergeAB = VectorClockUtil.merge(clockA, clockB);
      const mergeBA = VectorClockUtil.merge(clockB, clockA);
      expect(mergeAB).toEqual(mergeBA);
    });

    it('should be idempotent', () => {
      const clock = { replica1: 5, replica2: 3 };
      const merged = VectorClockUtil.merge(clock, clock);
      expect(merged).toEqual(clock);
    });
  });

  describe('compare', () => {
    it('should detect happens-before relationship', () => {
      const clockA = { replica1: 5, replica2: 3 };
      const clockB = { replica1: 6, replica2: 3 };
      expect(VectorClockUtil.compare(clockA, clockB)).toBe(-1);
    });

    it('should detect concurrent events', () => {
      const clockA = { replica1: 5, replica2: 3 };
      const clockB = { replica1: 3, replica2: 7 };
      expect(VectorClockUtil.compare(clockA, clockB)).toBe(0);
    });
  });
});
```

## References

- [Vector Clocks on Wikipedia](https://en.wikipedia.org/wiki/Vector_clock)
- [CRDTs: Consistency without concurrency control](https://arxiv.org/abs/0907.0929)
- [Conflict-free Replicated Data Types](https://crdt.tech/)
- Ventree Backend Architecture Document (Section 4: CRDT Design)

## Summary

Vector clocks enable the Notification Module to:

1. ✅ Detect causal relationships between events
2. ✅ Merge concurrent updates without conflicts
3. ✅ Support offline-first operations
4. ✅ Ensure eventual consistency
5. ✅ Scale horizontally across multiple replicas

The implementation is production-ready and follows CRDT best practices for distributed systems.
