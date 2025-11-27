/**
 * Vector Clock for CRDT-based Notification Synchronization
 * Implements conflict-free replication using vector clocks
 */

export interface VectorClock {
  [replicaId: string]: number;
}

export class VectorClockUtil {
  /**
   * Initialize a new vector clock with a single replica
   * @param replicaId - The replica identifier
   * @returns A new vector clock with the replica counter set to 0
   */
  static init(replicaId: string): VectorClock {
    return { [replicaId]: 0 };
  }

  /**
   * Increment the counter for a specific replica
   * @param clock - The current vector clock
   * @param replicaId - The replica to increment
   * @returns A new vector clock with the incremented counter
   */
  static increment(clock: VectorClock, replicaId: string): VectorClock {
    return {
      ...clock,
      [replicaId]: (clock[replicaId] || 0) + 1,
    };
  }

  /**
   * Merge two vector clocks using element-wise maximum
   * This is the core CRDT property ensuring eventual consistency
   * @param clockA - First vector clock
   * @param clockB - Second vector clock
   * @returns Merged vector clock with max values for each replica
   */
  static merge(clockA: VectorClock, clockB: VectorClock): VectorClock {
    const merged: VectorClock = { ...clockA };

    // Take element-wise maximum
    for (const replicaId in clockB) {
      merged[replicaId] = Math.max(
        merged[replicaId] || 0,
        clockB[replicaId] || 0
      );
    }

    return merged;
  }

  /**
   * Compare two vector clocks to determine causal ordering
   * @param clockA - First vector clock
   * @param clockB - Second vector clock
   * @returns -1 if A happened before B, 0 if concurrent, 1 if B happened before A
   */
  static compare(clockA: VectorClock, clockB: VectorClock): -1 | 0 | 1 {
    const allReplicas = new Set([
      ...Object.keys(clockA),
      ...Object.keys(clockB),
    ]);

    let aLessThanB = false;
    let bLessThanA = false;

    for (const replicaId of allReplicas) {
      const aValue = clockA[replicaId] || 0;
      const bValue = clockB[replicaId] || 0;

      if (aValue < bValue) {
        aLessThanB = true;
      } else if (aValue > bValue) {
        bLessThanA = true;
      }
    }

    // A happened before B if all A's counters <= B's counters and at least one is strictly less
    if (aLessThanB && !bLessThanA) {
      return -1;
    }

    // B happened before A if all B's counters <= A's counters and at least one is strictly less
    if (bLessThanA && !aLessThanB) {
      return 1;
    }

    // Concurrent if neither dominates
    return 0;
  }

  /**
   * Check if clockA happened before clockB
   * @param clockA - First vector clock
   * @param clockB - Second vector clock
   * @returns true if A happened before B
   */
  static happensBefore(clockA: VectorClock, clockB: VectorClock): boolean {
    return this.compare(clockA, clockB) === -1;
  }

  /**
   * Check if two clocks are concurrent (no causal relationship)
   * @param clockA - First vector clock
   * @param clockB - Second vector clock
   * @returns true if clocks are concurrent
   */
  static areConcurrent(clockA: VectorClock, clockB: VectorClock): boolean {
    return this.compare(clockA, clockB) === 0;
  }

  /**
   * Get the maximum counter value across all replicas
   * @param clock - The vector clock
   * @returns The maximum counter value
   */
  static getMaxCounter(clock: VectorClock): number {
    const values = Object.values(clock);
    return values.length > 0 ? Math.max(...values) : 0;
  }

  /**
   * Create a deep copy of a vector clock
   * @param clock - The vector clock to copy
   * @returns A new vector clock with the same values
   */
  static clone(clock: VectorClock): VectorClock {
    return { ...clock };
  }
}
