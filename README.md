# 🗂️ Kanban Board – Trello-like Real-Time Collaboration App

A simplified **Trello-like Kanban application** built with full-stack web technologies to demonstrate HLD, LLD, and real-time full-stack development capabilities.  
This project enables users to create **workspaces, boards, lists, and cards**, collaborate in **real-time** (via WebSockets), and manage **tasks, comments, and activity logs** efficiently.

---

## ⚙️ Tech Stack & Rationale

### **Backend**
- **Node.js + Express.js**: Lightweight, scalable, and perfect for REST APIs with async I/O.
- **MongoDB (Mongoose)**: Flexible NoSQL database for nested structures like boards, lists, and cards.
- **JWT Authentication**: Secure token-based auth for stateless API sessions.
- **Socket.IO**: Real-time collaboration for card movements and live comments.
- **bcrypt**: For password hashing and user authentication security.

### **Frontend**
- **React.js (Vite/CRA)**: Modular UI components for a responsive and interactive Kanban board.
- **React DnD / react-beautiful-dnd**: Enables drag-and-drop list and card reordering.
- **Axios + React Query**: Efficient API communication with caching.
- **Tailwind CSS**: Rapid UI styling and responsive design.

The combination ensures a **scalable, maintainable, and real-time interactive** system with minimal latency and high UX responsiveness.

---

## 🚀 Setup & Run Instructions

### 🧩 Prerequisites
- Node.js v18+
- MongoDB (local or Atlas)
- npm / yarn

---

### 🗄 Backend Setup

```bash
cd backend
npm install
```
### Create a .env file in the backend/ directory (see .env.example below).
Then run the backend server:

```bash
npm run dev
```


To seed demo data:

```bash
node scripts/seed.js
```


This will populate demo users, workspace, board, lists, and cards.

🎨 Frontend Setup
``` bash
cd frontend
npm install
npm run dev
```


### Access the app at:
👉 http://localhost:3000

### 🧠 Environment Variables Sample

Create a file named .env (or .env.example for reference):

### MongoDB Connection
MONGODB_URI=mongodb://127.0.0.1:27017/kanban_app

### JWT Secret
JWT_SECRET=your_jwt_secret_key

### Database name
DB_NAME=test_database

### CORS ORIGIN
CORS_ORIGINS=http://localhost:3000

## 🧱 Database Schema Overview
### 🧩 Entity Relationship Diagram (ERD)

### 📘 Key Collections
| **Collection** | **Description** |
|----------------|-----------------|
| **Users** | Registered users with name, email, avatar, and hashed password. |
| **Workspaces** | Organizational groups containing multiple boards. |
| **Boards** | Contain lists, members, and visibility settings. |
| **Lists** | Columns in a board (Backlog, In Progress, Done, etc.). |
| **Cards** | Tasks within lists, can be moved, labeled, and assigned. |
| **Comments** | User discussions attached to cards. |
| **Activity** | Audit logs of actions (card created, moved, commented). |




### 🧩 Example Document (Cards Collection)
{
  "title": "Build Login Page",
  "description": "Implement JWT authentication and UI for login/signup.",
  "labels": ["frontend", "auth"],
  "assignees": ["user123"],
  "dueDate": "2025-10-15",
  "position": 1024,
  "listId": "list_001"
}



### 🔄 Real-Time Server Setup

Real-time events are powered by Socket.IO.



### 🔌 Real-time Events
Event	Description
cardMoved	Broadcasts when a card is moved between lists.
commentAdded	Sends a live update when a new comment is added.
boardUpdated	Notifies connected clients of board updates.


## 📂 Project Structure

```plaintext
📁 kanban-app/
├── 📁 backend/
│   ├── src/
│   ├── package.json
│   ├── .env.example
│   
│
├── 📁 frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   ├── components.json
│   ├── package.json
│ 
│
├── 📁 docs/
│   ├── HLD.md
│   ├── LLD.md
│   ├── architecture-diagram.png
│   ├── erd.png
│   └── api-reference.yaml (Swagger)
│
├── 📁 scripts/
│   └── seed.js
│
├── README.md
└── 📁 demo-screenshots/
    ├── Activity.png
    ├── Card.png
    ├── Dashboard.png
    ├── Newboard.png
    ├── Register.png
    ├── Workspace.png
    └── labels.png

```


### 🧪 API Testing

Use Postman or curl to test API endpoints.

Example:
``` bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com", "password":"123456"}'
```



### 📸 Demo Screenshots
Feature	Screenshot
<img width="1920" height="1080" alt="Register" src="https://github.com/user-attachments/assets/c1aa1dbd-0539-4cc2-8331-31e9ea4ee6cd" />

Board View

<img width="1920" height="1080" alt="Dashboard" src="https://github.com/user-attachments/assets/d3b1936b-1463-424b-9902-534ec64a49fd" />

Card Modal

<img width="1920" height="1080" alt="Card" src="https://github.com/user-attachments/assets/d9b2a269-cdc4-4397-93c7-54d663c1342d" />

Workspace

<img width="1920" height="1080" alt="Workspace" src="https://github.com/user-attachments/assets/053da6d1-a26c-4a16-b070-091a8fba20ac" />

Real-time comments

<img width="1920" height="1080" alt="labels" src="https://github.com/user-attachments/assets/207597af-e1ed-4aa1-9a69-07d09a0bf531" />





### ⚖️ Known Limitations

Offline sync not yet supported (planned feature).

Only two roles supported (owner/member).

Activity log limited to 20 most recent events.

Search limited to card title, label, or assignee.

###  Next Steps

Add CRDTs or server-side conflict resolution for real-time consistency.

Expand role-based access control.

Add Calendar View and analytics dashboards.

Integrate email notifications for mentions.

Implement offline-first support.


