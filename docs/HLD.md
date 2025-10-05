# High-Level Design (HLD)

---

> **Project:** Kanban Collaboration Board (Trello-like)

> **Stack (assumed):** React (frontend) + Node.js/Express (backend) + MongoDB (Mongoose) + Socket.IO (real-time)

---

# Part A — High-Level Design (HLD)

## 1. Overview

This document describes the architecture and design decisions for the Kanban Collaboration Board. The system supports user authentication, multi-tenant workspaces, boards with ordered lists and cards, comments, activity log, and real-time collaboration (card moves and comments) using WebSockets (Socket.IO).

## 2. Major Components

* **Frontend (React)**

  * Routing + Protected routes (auth)
  * Boards Home (list of boards)
  * Board View (Kanban UI, drag-and-drop)
  * Card Modal (details, comments, activity)
  * Search & Filters
  * Socket client for real-time events

* **Backend (Node.js + Express)**

  * Auth service (JWT)
  * REST API endpoints for core entities (users, workspaces, boards, lists, cards, comments, activity)
  * Validation layer (Joi/Zod or express-validator)
  * Error handling middleware
  * Real-time using Socket.IO (same server or dedicated socket server)

* **Database (MongoDB)**

  * Collections: users, workspaces, boards, lists, cards, comments, activities
  * Indexes for performance (text index for card search, index on boardId, listId, position)

* **Real-time layer (Socket.IO)**

  * Rooms by board (`board:<boardId>`)
  * Events: `card:moved`, `card:created`, `comment:added`, `card:updated`
  * Use Redis adapter for multi-instance scaling (pub/sub)

* **Optional infra**

  * Redis (Socket.IO adapter, caching, rate-limiting)
  * MongoDB Atlas for managed DB
  * CI/CD pipelines for deployment

## 3. Architecture Diagram (ASCII)

```
+-----------+           HTTPS/REST            +----------------+
|  Browser  | <-----------------------------> |   API Server   |
|  (React)  |                                | (Express + WS) |
+-----+-----+                                +---+---+---+----+
      |                                           |   |   |
      | Socket.IO (ws)                            |   |   +--> Activity Service (same DB)
      +-------------------------------------------+   |
                                                  |   +------> Redis (optional, pub/sub)
                                                  |
                                                  +---------> MongoDB
```

## 4. Data Flow (example: move card)

1. User drags a card in UI and drops into a new list/position.
2. Frontend optimistically updates UI and sends `PATCH /api/cards/:id/move` with new `listId` and `position`.
3. Backend validates request, updates card in DB, appends activity entry.
4. Backend emits `card:moved` via Socket.IO to `board:<boardId>` room.
5. Other clients receive event and update local state.

## 5. Real-time choice: WebSockets (Socket.IO) vs SSE

* **Chosen:** Socket.IO (WebSocket + fallback) because:

  * Bi-directional communication needed (client can push typing, presence, edits).
  * Broadcasts are important; Socket.IO provides rooms and adapters.
  * Easier integration for presence and cursor states.
* **SSE** is simpler but unidirectional (server -> client) and less suitable for collaborative editors.

## 6. Security & Auth

* **Auth:** JWT tokens in HTTP-only cookies (or Authorization header) for API calls.
* **AuthZ:** Middleware ensures user is member of a board/workspace before accessing/changing data.
* **Input validation:** Prevent injection and enforce schema.
* **Rate limiting** on critical endpoints.

## 7. Scalability & Availability

* Stateless API servers behind load balancer.
* Socket.IO scaling via Redis adapter (pub/sub) so socket events are synchronized across instances.
* MongoDB sharding or Atlas if scale increases.
* Caching for read-heavy endpoints (optional Redis).

---

