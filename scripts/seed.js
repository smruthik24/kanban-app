// scripts/seed.js
// Usage: node scripts/seed.js
// Expects MONGODB_URI in env (.env or environment)

const mongoose = require('mongoose');
const { Schema } = mongoose;
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/kanban_seed';

// Define minimal schemas for seed script (mirror your real models for production)
const userSchema = new Schema(
  { name: String, email: String, passwordHash: String, avatarUrl: String },
  { timestamps: true }
);
const workspaceSchema = new Schema(
  { name: String, ownerId: Schema.Types.ObjectId, members: [{ userId: Schema.Types.ObjectId, role: String }] },
  { timestamps: true }
);
const boardSchema = new Schema(
  { title: String, workspaceId: Schema.Types.ObjectId, visibility: String, members: [{ userId: Schema.Types.ObjectId, role: String }] },
  { timestamps: true }
);
const listSchema = new Schema(
  { boardId: Schema.Types.ObjectId, title: String, position: Number },
  { timestamps: true }
);
const cardSchema = new Schema(
  {
    boardId: Schema.Types.ObjectId,
    listId: Schema.Types.ObjectId,
    title: String,
    description: String,
    labels: Array,
    assignees: [Schema.Types.ObjectId],
    dueDate: Date,
    position: Number,
    createdBy: Schema.Types.ObjectId
  },
  { timestamps: true }
);
const commentSchema = new Schema(
  { cardId: Schema.Types.ObjectId, authorId: Schema.Types.ObjectId, text: String },
  { timestamps: true }
);
const activitySchema = new Schema(
  { boardId: Schema.Types.ObjectId, userId: Schema.Types.ObjectId, action: String, meta: Object },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);
const Workspace = mongoose.model('Workspace', workspaceSchema);
const Board = mongoose.model('Board', boardSchema);
const List = mongoose.model('List', listSchema);
const Card = mongoose.model('Card', cardSchema);
const Comment = mongoose.model('Comment', commentSchema);
const Activity = mongoose.model('Activity', activitySchema);

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await Promise.all([
      User.deleteMany(),
      Workspace.deleteMany(),
      Board.deleteMany(),
      List.deleteMany(),
      Card.deleteMany(),
      Comment.deleteMany(),
      Activity.deleteMany()
    ]);
    console.log('Cleared existing data');

    // Create users
    const alice = await User.create({
      name: 'Alice',
      email: 'alice@example.com',
      passwordHash: 'hashed_password_here',
      avatarUrl: 'https://i.pravatar.cc/150?img=1'
    });

    const bob = await User.create({
      name: 'Bob',
      email: 'bob@example.com',
      passwordHash: 'hashed_password_here',
      avatarUrl: 'https://i.pravatar.cc/150?img=2'
    });

    // Create workspace
    const workspace = await Workspace.create({
      name: 'Demo Workspace',
      ownerId: alice._id,
      members: [
        { userId: alice._id, role: 'owner' },
        { userId: bob._id, role: 'member' }
      ]
    });

    // Create board
    const board = await Board.create({
      title: 'Sprint Board',
      workspaceId: workspace._id,
      visibility: 'workspace',
      members: [
        { userId: alice._id, role: 'owner' },
        { userId: bob._id, role: 'member' }
      ]
    });

    // Create lists
    const backlog = await List.create({ boardId: board._id, title: 'Backlog', position: 1024 });
    const inProgress = await List.create({ boardId: board._id, title: 'In Progress', position: 2048 });
    const done = await List.create({ boardId: board._id, title: 'Done', position: 3072 });

    // Create cards
    const card1 = await Card.create({
      boardId: board._id,
      listId: backlog._id,
      title: 'Setup project structure',
      description: 'Initialize repo, setup backend and frontend folders',
      labels: [{ id: 'setup', name: 'Setup', color: '#0079BF' }],
      assignees: [alice._id],
      position: 1100,
      createdBy: alice._id
    });

    const card2 = await Card.create({
      boardId: board._id,
      listId: inProgress._id,
      title: 'Implement user authentication',
      description: 'Add signup/login endpoints with JWT',
      labels: [{ id: 'auth', name: 'Auth', color: '#61BD4F' }],
      assignees: [bob._id],
      position: 2100,
      createdBy: bob._id
    });

    const card3 = await Card.create({
      boardId: board._id,
      listId: done._id,
      title: 'Design HLD and LLD',
      description: 'Create architecture and schema design documentation',
      labels: [{ id: 'docs', name: 'Documentation', color: '#FF9F1A' }],
      assignees: [alice._id, bob._id],
      position: 3100,
      createdBy: alice._id
    });

    // Comments
    await Comment.create({
      cardId: card2._id,
      authorId: alice._id,
      text: 'Great progress! Let’s add password reset next.'
    });

    // Activity logs
    await Activity.insertMany([
      { boardId: board._id, userId: alice._id, action: 'card_created', meta: { cardId: card1._id } },
      { boardId: board._id, userId: bob._id, action: 'card_moved', meta: { cardId: card2._id, fromListId: backlog._id, toListId: inProgress._id } },
      { boardId: board._id, userId: alice._id, action: 'comment_added', meta: { cardId: card2._id } }
    ]);

    console.log('Seed data created successfully');
  } catch (err) {
    console.error('Error during seeding:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

seed();
