# Part B — Low-Level Design (LLD)

## 1. Core Entities (MongoDB collections)

### `users`

```js
{
  _id: ObjectId,
  name: String,
  email: String (unique),
  passwordHash: String,
  avatarUrl: String,
  createdAt: Date,
  updatedAt: Date
}
```

### `workspaces`

```js
{
  _id: ObjectId,
  name: String,
  ownerId: ObjectId (user),
  members: [{ userId: ObjectId, role: String }],
  createdAt, updatedAt
}
```

### `boards`

```js
{
  _id: ObjectId,
  title: String,
  workspaceId: ObjectId,
  visibility: String (private|workspace|public),
  members: [{ userId: ObjectId, role: String }],
  createdAt, updatedAt
}
```

### `lists`

```js
{
  _id: ObjectId,
  boardId: ObjectId,
  title: String,
  position: Number, // fractional ordering strategy
  createdAt, updatedAt
}
```

### `cards`

```js
{
  _id: ObjectId,
  boardId: ObjectId,
  listId: ObjectId,
  title: String,
  description: String,
  labels: [{ id: String, name: String, color: String }],
  assignees: [ObjectId],
  dueDate: Date|null,
  position: Number,
  createdBy: ObjectId,
  createdAt, updatedAt
}
```

### `comments`

```js
{
  _id: ObjectId,
  cardId: ObjectId,
  authorId: ObjectId,
  text: String,
  createdAt: Date
}
```

### `activity`

```js
{
  _id: ObjectId,
  boardId: ObjectId,
  userId: ObjectId,
  action: String, // e.g., 'card_created', 'card_moved'
  meta: Object, // { cardId, fromListId, toListId }
  createdAt: Date
}
```

## 2. Indexes

* `users.email` → unique index
* `boards.workspaceId` → index
* `lists.boardId, lists.position` → compound index
* `cards.boardId, cards.listId, cards.position` → compound index
* Full-text index on `cards.title` and `cards.description` for search: `text` index
* `activity.boardId, createdAt` → compound index for activity feed (descending)

## 3. Ordering Strategy

* Use **fractional positions** stored as numbers (e.g., 1024, 1536).
* To insert between two positions: `newPos = (prevPos + nextPos) / 2`.
* If positions become too close (float precision), run a reindex job on the list to renumber positions (e.g., 1024, 2048, ...).

## 4. API Design (Representative endpoints)

All endpoints under `/api` and require `Authorization: Bearer <token>` (or cookie)

### Auth

* `POST /api/auth/signup` — body: `{ name, email, password }` → 201, returns token
* `POST /api/auth/login` — body: `{ email, password }` → 200, returns token
* `POST /api/auth/logout` — invalidate cookie (client)
* `GET /api/auth/me` — return current user

### Users

* `GET /api/users/:id` — user profile

### Workspaces

* `POST /api/workspaces` — create
* `GET /api/workspaces/:id` — get with members
* `POST /api/workspaces/:id/invite` — invite user by email

### Boards

* `POST /api/boards` — create board (workspace optional)
* `GET /api/boards` — list user boards
* `GET /api/boards/:id` — board metadata + short lists
* `PATCH /api/boards/:id` — update title/visibility
* `POST /api/boards/:id/members` — add/remove members (owner only)

### Lists

* `POST /api/boards/:boardId/lists` — create list (body: title, position)
* `PATCH /api/lists/:id` — rename/reposition
* `DELETE /api/lists/:id`

### Cards

* `POST /api/lists/:listId/cards` — create card (title, description, position, assignees, labels, dueDate)
* `GET /api/cards/:id` — full card detail (comments, activity snippet)
* `PATCH /api/cards/:id` — edit fields
* `PATCH /api/cards/:id/move` — move card (body: listId, position)
* `DELETE /api/cards/:id`

### Comments

* `POST /api/cards/:cardId/comments` — add comment
* `GET /api/cards/:cardId/comments` — list comments (paginated)

### Activity

* `GET /api/boards/:boardId/activity?limit=20` — get recent activities (paginated)

### Search

* `GET /api/boards/:boardId/search?q=...&label=...&assignee=...` — board-scoped search and filters

## 5. Example Request/Response

**Move card**

* Request: `PATCH /api/cards/64ab.../move`

```json
{ "listId": "64cd...", "position": 1536 }
```

* Response: `200 OK`

```json
{ "success": true, "card": { /* updated card object */ } }
```

* Side effect: server writes activity: `{ action: 'card_moved', meta: {cardId, fromListId, toListId}}` and emits Socket.IO event.

## 6. Socket.IO Events

**Namespace/Room:** connect to default namespace, join room `board:<boardId>` after auth

**Client -> Server**

* `joinBoard` `{ boardId }` — join room
* `leaveBoard` `{ boardId }` — leave room
* `card:move` `{ cardId, fromListId, toListId, position }` — server will validate + persist
* `comment:add` `{ cardId, text }` — create comment

**Server -> Client**

* `card:moved` `{ cardId, fromListId, toListId, position, userId }`
* `card:created` `{ card }`
* `comment:added` `{ comment }`
* `presence:update` `{ userId, boardId, status }` (optional)

**Notes:** Server should perform validation and broadcast only after DB write (or when using optimistic UI, broadcast immediately but reconcile on error).

## 7. Validation & Error Model

Unified error shape:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Title is required",
    "details": { "title": "required" }
  }
}
```

HTTP status codes: 400 (validation), 401 (unauthorized), 403 (forbidden), 404 (not found), 409 (conflict), 500 (server error).

## 8. Pagination & N+1 Avoidance

* Activity and comments use cursor-based or limit-offset pagination.
* When returning board with lists and cards, avoid fetching N lists then N card queries: use single query for cards by `boardId` and group them in-memory by `listId`.

## 9. Seed Data (sample)

A seed script should create:

* `users`: [alice@example.com](mailto:alice@example.com) (owner), [bob@example.com](mailto:bob@example.com) (member)
* `workspace`: "Demo Workspace" (owner: alice)
* `board`: "Sprint Board" under workspace
* `lists`: Backlog (pos 1024), In Progress (pos 2048), Done (pos 3072)
* `cards`: few cards with positions 1100, 1200, 2100

## 10. Tests (recommended)

* Unit tests: auth, position calculation, validation
* Integration tests: API endpoints for card move & comment
* E2E tests (optional): drag-and-drop flows using Playwright or Cypress

---

# Appendix: Implementation Tips & Next Steps

* **Optimistic UI:** Implement optimistic updates on the frontend for snappy UX; reconcile on failure.
* **Reindex job:** implement a background endpoint `/admin/reindex-list/:listId` to renumber positions if precision issues arise.
* **Redis adapter:** in production, enable `socket.io-redis` to allow multiple backend instances to broadcast.
* **Monitoring:** add request tracing (OpenTelemetry) and error tracking (Sentry).

---

*End of document.*
