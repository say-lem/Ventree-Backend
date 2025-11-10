# **Backend Architecture Document — Ventree**

## **Document Metadata**

| Field | Value |
| :---- | :---- |
| **Version** | 1.0 |
| **Date** | 2025-11-05 |
| **Audience** | Engineers, Architects, DevOps, Product Owner |

## **Executive Summary**

This document defines the backend architecture for the **Inventory & Bookkeeping System (IBS)** — a web-first PWA that supports **offline operation**, **CRDT-based conflict-free syncing**, multi-profile shops (owner \+ up to 5 staff profiles), and robust audit/analytics. The architecture is a modular service-oriented **Node.js (TypeScript)** system implemented initially as a **modular monolith** and ready to split into microservices later.

### **Goals**

* **Offline-capable** clients with deterministic merge semantics (**CRDTs**).  
* **Secure authentication** \+ role-based access (**RBAC**).  
* **Immutable sales ledger** for audit.  
* **Real-time updates** via WebSocket, robust HTTP sync fallback.  
* **Scalable, observable, and maintainable backend.**

## **1\. High-Level Architecture**

### **Logical Diagram**

\[Browser PWA\] \<--HTTPS / WS--\> \[API Gateway (Express)\] \--\> \[Services Layer\]

|  |  |  |  |
| :---- | :---- | :---- | :---- |
| AuthService | ShopService | InventoryService | SyncService |
|  |  |  |  |
|  | **\[Primary Data Store: MongoDB\]** |  |  |
|  |  |  |  |
|  | **\[Redis (cache, session), Message Queue\]** |  |  |
|  |  |  |  |
|  | **\[Workers: analytics, GC, export\]** |  |  |

### **Key Architectural Patterns**

* **Modular Monolith:** To start, using clear service boundaries via folders/modules for **scalability and maintainability**.  
* **Event-Driven:** For async processing, analytics, and worker decoupling via a Message Queue.  
* **CRDT-based Sync Layer:** Op-based primary sync; state-based for counters/sets to ensure eventual consistency.  
* **Stateless API Servers:** Behind a load balancer; persistence and session state managed in DB/Redis.

## **2\. Components**

### **Frontend (Client)**

* **React PWA** using IndexedDB (idb) for local persistence.  
* **Stores:** Local CRDT state (PN-Counter, OR-Set, LWW registers), Op queue (offline operations), and **ReplicaId** (UUID per browser/profile).  
* **Sync Logic:** **WebSocket** (preferred) \+ **HTTP fallback** (/sync/ops).

### **API Gateway**

* **Express.js** with robust middleware for: **Auth (JWT verify)**, Rate limiter, CORS, Helmet, Request logger, and Error handler.  
* Exposes **REST endpoints** and a **WebSocket endpoint**.

### **Services (Modules)**

| Service | Key Responsibilities |
| :---- | :---- |
| **AuthService** | Login, signup, refresh, logout, refresh token storage & revocation. |
| **ShopService** | Shop creation, settings, KYC. |
| **StaffService** | Create/limit staff profiles, password reset. |
| **InventoryService** | Product catalog, **PN-counters** for stock. |
| **SalesService** | **Append-only sales ledger**, cost allocation hooks. |
| **SyncService** | Op ingestion, dedupe, **CRDT apply functions**, snapshots. |
| **AnalyticsService** | Aggregation worker, materialized views. |
| **NotificationService** | Create/push notifications. |

### **Persistence & Infra**

* **MongoDB (Primary):** Stores shop, profile, inventory, products, sales, ops, refresh\_tokens, and analytics data.  
* **Redis:** Caching, ephemeral session store, **pub/sub for cross-instance WS broadcasting**.  
* **Message Queue (RabbitMQ / SQS):** For asynchronous background tasks.  
* **Storage (Cloudinary / S3):** For images/pdfs (KYC docs).  
* **Secrets (Cloud KMS / HashiCorp Vault):** For secure storage of credentials and keys.  
* **Observability:** Prometheus, Grafana, ELK/Opensearch or Datadog for monitoring.

## **3\. Data Model (Summary)**

### **Collections (Main)**

* shops — Shop metadata, owner reference.  
* shop\_profiles — Staff profiles.  
* products — OR-Set metadata \+ LWW fields (price/name).  
* inventory — **PN-Counter** per product per shop.  
* sales — **Immutable append-only ledger** (dedupe by opId).  
* ops — Incoming op log for dedup \+ audit.  
* refresh\_tokens — Hashed tokens for revocation.  
* analytics — Precomputed aggregates.

### **Example Documents (CRDT & Audit focus)**

**inventory (PN-Counter for Stock)**  
`{`  
  `"_id": "inventory:shop:xyz:prod:sku123",`  
  `"shopId": "shop:xyz",`  
  `"productId": "prod:sku123",`  
  `"counts": {`  
    `"P": { "shop:xyz:owner": 100, "shop:xyz:staff:1": 0 }, // P: Positive (stock-in)`  
    `"N": { "shop:xyz:owner": 25,  "shop:xyz:staff:1": 10 }  // N: Negative (stock-out)`  
  `},`  
  `"lastUpdatedAt": "..." // Used for LWW on the metadata`  
`}`

**sales (Append-Only Ledger)**  
`{`  
  `"_id": "sale:uuid-001",`  
  `"shopId": "shop:xyz",`  
  `"opId": "op:uuid-001", // CRDT Op ID for deduplication`  
  `"replicaId": "shop:xyz:staff:1",`  
  `"timestamp": "2025-11-05T09:05:00Z",`  
  `"items": [{ "productId":"p1", "qty":2, "unitPrice":200 }],`  
  `"total": 400`  
`}`

## **4\. CRDT Design & Merge Rules (Detailed Elaboration)**

We employ **Conflict-free Replicated Data Types (CRDTs)** to ensure that concurrent, potentially offline, operations from multiple staff profiles merge deterministically without requiring a central coordination authority to resolve conflicts. The core property is that merge operations must be **associative, commutative, and idempotent**.

### **Hybrid CRDT Strategy**

| CRDT Type | Data Field Example | Mechanism | Merge Rule | Value Calculation |
| :---- | :---- | :---- | :---- | :---- |
| **PN-Counter** | inventory.counts (stock) | Vector Clock/State-based. Tracks increments (P) and decrements (N) per replicaId. | **Per-key maximum** for P\_{replica} and N\_{replica} vectors. | Value \= \\sum(\\text{P}) \- \\sum(\\text{N}) |
| **OR-Set (Observed-Remove Set)** | products (catalog list) | Tracks elements with unique tags (adds) and tombstones (removes). | **Set union** of adds and tombstones. An element is present if its add-tag is in Adds but **not** in Tombstones. | Set membership |
| **LWW-Register (Last-Write-Wins)** | products.name, products.price | Stores { value, timestamp, replicaId }. | Selects the record with the **greatest timestamp**; uses replicaId (UUID/string comparison) as a **tie-breaker**. | Latest value |
| **Append-Only Log** | sales, ops | Op-based. Every operation gets a unique opId. | **Set union** of operations. | Sequence of records, deduplicated by opId. |

### **PN-Counter Deep Dive (Inventory)**

The PN-Counter handles inventory stock, which is the most critical shared mutable state.

1. **Local Update:** When a staff member records a sale (stock-out) while offline, they generate an operation that locally increments their replica's counter for **N** (Negative). A stock-in operation increments their replica's counter for **P** (Positive).  
   * *Example:* Staff S1 sells 10 units. \\rightarrow Update local: N\['S1'\] \= 10\.  
2. **Merge Rule:** When two replicas (A and B) sync, they merge their state by taking the element-wise maximum of their P and N vectors.  
   *   
   *   
   * This ensures no update is lost, as the maximum value for each replica's contribution is preserved.

### **Idempotency and Deduplication**

* Every operation object pushed from the client **must** contain a unique **opId** (a UUID).  
* The **SyncService** maintains the ops collection, which acts as a log and a deduplication table.  
* **Idempotency Check:** Before applying an operation to the authoritative state (MongoDB inventory, products), the server checks if an operation with that **opId** already exists in the ops collection. If it does, the operation is skipped.  
* This is crucial for robust sync over unreliable HTTP/WS connections, as clients may retry pushing the same batch of operations.

## **5\. API Overview**

Base: https://api.example.com/api/v1

### **Auth**

* POST /auth/signup — Create owner \+ shop.  
* POST /auth/login — Login (returns **accessToken**, **refreshToken**, role, profileId).  
* POST /auth/refresh — Rotate refresh token (requires refresh token).  
* POST /auth/logout — Revoke refresh token.  
* GET /auth/me — Get token subject info.

### **Shop & Profiles**

* POST /shops/:shopId/profiles — Create staff (**owner only**; enforce max 5).  
* PATCH /shops/:shopId/profiles/:profileId — Update staff profile (**owner only**).

### **Inventory & Products**

* POST /shops/:shopId/products — Add product (**owner only**).  
* GET /shops/:shopId/inventory — List inventory.  
* POST /shops/:shopId/inventory/stock-in — Stock adjustment op.  
* POST /shops/:shopId/inventory/stock-out — Stock adjustment op (sales call triggers this).

### **Sales**

* POST /shops/:shopId/sales — Create sale (**op-based**, owner/staff). Body includes opId, replicaId, ts, items.  
* GET /shops/:shopId/sales — Query sales.

### **Sync (CRDT)**

* POST /sync/ops — **Push batch ops** (body: { ops: \[ {...} \] }). Server returns { applied: \[...\], missingOps: \[...\] }.  
* GET /sync/ops?since=\<ts\> — **Pull ops** since timestamp.

### **Analytics, Notifications, Audit**

* GET /shops/:shopId/analytics/sales?from=\&to=  
* GET /shops/:shopId/notifications  
* GET /shops/:shopId/audit?from=\&to=

## **6\. Authentication & Session Lifecycle (Secure Practices)**

* **Access Token (JWT):** Short-lived (expiresIn: 1h), uses HS256/RS256, payload includes shopId, role, profileId.  
* **Refresh Token:** Long-lived (e.g., 7 days), client-stored, server stores **sha256(refreshToken)** and verifies on refresh. **Refresh tokens are rotated on each use.**  
* **Login Flow:** Server verifies password hash using **await bcrypt.compare()**.  
* **Revocation:** Owner can revoke staff refresh tokens by marking the DB entry revoked.  
* **Password Storage:** **bcrypt** with at least **12 rounds**.

## **7\. Authorization (RBAC)**

* **Role model:** owner (full privileges) and staff (limited: sales, view inventory).  
* **Middleware:** authMiddleware verifies JWT; requireRole(...roles) validates role.  
* Permission checks are enforced in the **API Gateway** and the relevant **Service modules**.

## **8\. Sync & Offline Strategy**

### **Client Responsibilities**

* Generate a unique **op** for every local action with a unique **opId** and **replicaId**.  
* Append ops to the local opQueue in IndexedDB.  
* Push ops via WS or POST /sync/ops.  
* Merge remote ops into local CRDT state.

### **Server Responsibilities (SyncService)**

* **Deduplicate** by opId (check ops collection).  
* **Apply op** to authoritative state using CRDT merge functions.  
* **Broadcast** applied ops to other connected clients via **Redis pub/sub** and **WS**.  
* Respond to GET /sync/ops?since with missing ops.

### **Anti-entropy**

* Periodic server-side snapshots and client-side GET /sync/state?since= requests are implemented for repair and divergence detection.

## **9\. Analytics & Costing**

* **Profit Calculation:** Cost is allocated at sale time via a **deterministic FIFO strategy** (recommended). Profit \= \\sum(\\text{qty} \\times (\\text{unitPrice} \- \\text{allocatedCost})).  
* **Materialized Views:** **Analytics Worker** listens to the sales stream and updates precomputed aggregates in MongoDB (e.g., analytics.daily.{shopId}.{date}).

## **10\. Indexing, Performance & Scaling**

### **MongoDB Indexes (Recommended)**

* sales: { shopId:1, timestamp:-1 }  
* inventory: { shopId:1, productId:1 }  
* ops: { opId:1 } (unique)  
* shop\_profiles: { shopId:1, username:1 } (unique per shop)

### **Scaling**

* **API:** Stateless, scaled with autoscaling group / k8s deployment.  
* **MongoDB:** Replica set \+ future sharding by shopId.  
* **Redis:** For caching and cross-instance pub/sub.

## **11\. Security Checklist (Must-Haves)**

1. Always set expiresIn for JWTs (access tokens).  
2. Use async await bcrypt.compare(...).  
3. Store refresh token **hash only**.  
4. Rate-limit /auth/login.  
5. Enforce **HTTPS** and **HSTS**.  
6. Input validation (Zod/Joi).  
7. CSP, Helmet, and sanitize all outputs.  
8. Secrets in KMS / Vault.  
9. Routine dependency scanning.  
10. Automated backups and tested restores.

## **12\. Observability & SLOs**

### **Metrics**

API latency (P50, P95, P99), Error rates (5xx), Sync ops rate & backlog, Active connections (WS), Analytics worker lag.

### **Logs & Traces**

**Structured logs** with correlation IDs. **Distributed tracing** (OpenTelemetry).

### **SLO Examples**

* **99.9%** API availability.  
* Sync op processing lag **\< 5s** under normal load.

## **13\. Testing Strategy**

* **Unit Tests:** Critical for **CRDT merge functions** (associativity, commutativity, idempotency).  
* **Integration Tests:** End-to-end offline → online sync flows.  
* **Load Tests:** Auth path, sync endpoints, sales ingestion (k6).  
* **Security Tests:** SAST/DAST, pentest for auth flows.

## **14\. Migrations & Data Management**

* **Versioned migration scripts** (e.g., migrate-mongo).  
* Data backfill required for initial CRDT adoption.  
* **Tombstone GC:** Keep OR-Set tombstones for configurable TTL (30d default) before compaction.  
* **Replica retirement path** defined for decommissioning client devices/profiles.

## **15\. Deployment & CI/CD**

* GitHub Actions / GitLab CI for build & test pipelines.  
* Run lints, unit tests, security scans on PRs.  
* Use **blue/green or canary deploys** on k8s / cloud provider.  
* Secrets from KMS; environment-specific config management.  
* Automated DB backup & point-in-time recovery enabling.

## **16\. Operational Runbook (Quick)**

* **Restarting API server:** Verify queue consumer reconnects to pub/sub.  
* **Restore from backup:** Restore sales first, then ops, then inventory.  
* **Revoking a staff account:** Revoke refresh tokens, rotate shop password if necessary.  
* **Investigating sync mismatch:** Run anti-entropy snapshot, inspect ops logs by opId.

## **17\. Appendices**

### **A — CRDT Utilities (TypeScript Stubs)**

`type ReplicaId = string;`  
`// PNCounts tracks the Positive (P) and Negative (N) contributions from each replica`  
`type PNCounts = {`   
    `P: Record<ReplicaId, number>,`   
    `N: Record<ReplicaId, number>`   
`};`

`/**`  
 `* Merges two PN-Counters using the element-wise maximum rule.`  
 `* This is the core CRDT property for inventory stock synchronization.`  
 `*/`  
`function mergePN(a: PNCounts, b: PNCounts): PNCounts {`  
  `const out: PNCounts = { P: {}, N: {} };`  
    
  `// Merge Positive (P) contributions: take max for each replica`  
  `const keysP = new Set([...Object.keys(a.P), ...Object.keys(b.P)]);`  
  `for (const k of keysP) {`  
    `// Math.max ensures we keep the highest recorded contribution for a replica`  
    `out.P[k] = Math.max(a.P[k]||0, b.P[k]||0);`   
  `}`

  `// Merge Negative (N) contributions: take max for each replica`  
  `const keysN = new Set([...Object.keys(a.N), ...Object.keys(b.N)]);`  
  `for (const k of keysN) {`  
    `out.N[k] = Math.max(a.N[k]||0, b.N[k]||0);`  
  `}`  
  `return out;`  
`}`

`/**`  
 `* Calculates the final value of the PN-Counter.`  
 `*/`  
`function valuePN(counts: PNCounts): number {`  
    `const sumP = Object.values(counts.P).reduce((sum, val) => sum + val, 0);`  
    `const sumN = Object.values(counts.N).reduce((sum, val) => sum + val, 0);`  
    `return sumP - sumN;`  
`}`

### **B — Example POST /sync/ops Handler (Conceptual)**

The SyncService handles incoming batches of operations (ops).

1. **Validate:** Verify the JWT and check req.user.role for allowed op types (e.g., staff cannot send product update ops).  
2. **Process Batch:** Iterate through the received ops.  
3. **Deduplicate:** For each op, check if Ops.exists(op.opId).  
4. **Persist & Apply:**  
   * If the opId is **new**:  
     * Insert into the ops collection (audit log).  
     * await applyOpToState(op): Calls the specific CRDT merge function (e.g., mergePN for inventory updates) and persists the new authoritative state to MongoDB.  
     * Add op.opId to the list of applied ops.  
     * Broadcast the op to other replicas via WebSocket/Redis.  
   * If the opId is **duplicate**:  
     * Skip the application step.  
5. **Respond:** Return { applied: \[...\], missingOps: \[...\] } to confirm successful processing and inform the client of any ops they need to pull from other replicas (if relevant).

### **C — Security-critical code notes**

* jwt.sign(payload, secret, { expiresIn: '1h' }) — mandatory short expiry.  
* Use await bcrypt.compare(password, hash) — mandatory async compare.  
* Store refresh token hash only, not raw string.

## **18\. Roadmap & Next Steps**

### **Immediate:**

1. Implement **Auth module** with JWT expiry, refresh tokens & revocation.  
2. Implement shop\_profiles collection and staff creation API (owner-only).  
3. Implement **sales append-only ledger** with opId dedupe.  
4. Implement **PN-Counter CRDT** and basic POST /sync/ops flow.  
5. Add tests for **CRDT merge properties**.

### **Short-term:**

* WebSocket live sync with Redis pub/sub.  
* Analytics worker and indexes.  
* Monitoring dashboards and alerts.

### **Long-term:**

* Consider splitting heavy services (analytics, sync) into separate **microservices**.  
* Add stronger conflict surfacing for price edits (UI-based resolution).

