from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List as TypingList, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
import jwt
from enum import Enum
import json


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "your-secret-key-change-this-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_TIME_MINUTES = 1440  # 24 hours

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Create the main app without a prefix
app = FastAPI(title="Kanban Board API", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, board_id: str):
        await websocket.accept()
        if board_id not in self.active_connections:
            self.active_connections[board_id] = []
        self.active_connections[board_id].append(websocket)
    
    def disconnect(self, websocket: WebSocket, board_id: str):
        if board_id in self.active_connections:
            self.active_connections[board_id].remove(websocket)
    
    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)
    
    async def broadcast_to_board(self, message: dict, board_id: str, exclude_websocket: WebSocket = None):
        if board_id in self.active_connections:
            for connection in self.active_connections[board_id]:
                if connection != exclude_websocket:
                    try:
                        await connection.send_text(json.dumps(message))
                    except:
                        # Remove broken connections
                        self.active_connections[board_id].remove(connection)

manager = ConnectionManager()

# Enums
class WorkspaceRole(str, Enum):
    ADMIN = "admin"
    MEMBER = "member"

class BoardRole(str, Enum):
    OWNER = "owner"
    ADMIN = "admin"
    EDITOR = "editor"
    COMMENTER = "commenter"
    VIEWER = "viewer"

class BoardVisibility(str, Enum):
    PRIVATE = "private"
    WORKSPACE = "workspace"

class ActivityType(str, Enum):
    CARD_CREATED = "card_created"
    CARD_MOVED = "card_moved"
    CARD_UPDATED = "card_updated"
    CARD_DELETED = "card_deleted"
    COMMENT_ADDED = "comment_added"
    LIST_CREATED = "list_created"
    LIST_UPDATED = "list_updated"
    LIST_DELETED = "list_deleted"
    MEMBER_ADDED = "member_added"
    MEMBER_REMOVED = "member_removed"

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    avatar_url: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str
    avatar_url: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

class Workspace(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    owner_id: str
    members: TypingList[Dict[str, str]] = []  # [{"user_id": "", "role": ""}]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WorkspaceCreate(BaseModel):
    name: str
    description: Optional[str] = None

class Board(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    workspace_id: Optional[str] = None
    visibility: BoardVisibility = BoardVisibility.PRIVATE
    owner_id: str
    members: TypingList[Dict[str, str]] = []  # [{"user_id": "", "role": ""}]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BoardCreate(BaseModel):
    title: str
    workspace_id: Optional[str] = None
    visibility: BoardVisibility = BoardVisibility.PRIVATE

class BoardList(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    board_id: str
    position: float
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ListCreate(BaseModel):
    title: str
    position: Optional[float] = None

class Card(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: Optional[str] = None
    list_id: str
    position: float
    labels: TypingList[str] = []
    assignees: TypingList[str] = []  # user_ids
    due_date: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CardCreate(BaseModel):
    title: str
    description: Optional[str] = None
    position: Optional[float] = None
    labels: TypingList[str] = []
    assignees: TypingList[str] = []
    due_date: Optional[datetime] = None

class CardUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    list_id: Optional[str] = None
    position: Optional[float] = None
    labels: Optional[TypingList[str]] = None
    assignees: Optional[TypingList[str]] = None
    due_date: Optional[datetime] = None

class Comment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    text: str
    card_id: str
    author_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CommentCreate(BaseModel):
    text: str

class ActivityLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    board_id: str
    user_id: str
    activity_type: ActivityType
    details: Dict[str, Any]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Utility Functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str):
    # truncate to 72 bytes
    truncated = password.encode("utf-8")[:72]
    return pwd_context.hash(truncated)



def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRATION_TIME_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def prepare_for_mongo(data):
    """Convert datetime objects to ISO strings for MongoDB storage"""
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, datetime):
                data[key] = value.isoformat()
            elif isinstance(value, dict):
                data[key] = prepare_for_mongo(value)
            elif isinstance(value, list):
                data[key] = [prepare_for_mongo(item) if isinstance(item, dict) else item for item in value]
    return data

def parse_from_mongo(item):
    """Parse datetime strings back from MongoDB"""
    if isinstance(item, dict):
        for key, value in item.items():
            if isinstance(value, str) and key in ['created_at', 'updated_at', 'due_date']:
                try:
                    item[key] = datetime.fromisoformat(value.replace('Z', '+00:00'))
                except:
                    pass
            elif isinstance(value, dict):
                item[key] = parse_from_mongo(value)
            elif isinstance(value, list):
                item[key] = [parse_from_mongo(subitem) if isinstance(subitem, dict) else subitem for subitem in value]
    return item

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user_data = await db.users.find_one({"id": user_id})
    if user_data is None:
        raise HTTPException(status_code=401, detail="User not found")
    
    return User(**parse_from_mongo(user_data))

async def log_activity(board_id: str, user_id: str, activity_type: ActivityType, details: Dict[str, Any]):
    """Log activity and broadcast to WebSocket connections"""
    activity = ActivityLog(
        board_id=board_id,
        user_id=user_id,
        activity_type=activity_type,
        details=details
    )
    
    activity_dict = prepare_for_mongo(activity.dict())
    await db.activity_logs.insert_one(activity_dict)
    
    # Broadcast to WebSocket connections
    await manager.broadcast_to_board({
        "type": "activity",
        "activity": activity.dict()
    }, board_id)

# Authentication Routes
@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate):
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create new user
    hashed_password = get_password_hash(user_data.password)
    user = User(
        email=user_data.email,
        name=user_data.name,
        avatar_url=user_data.avatar_url
    )
    
    user_dict = prepare_for_mongo(user.dict())
    user_dict["hashed_password"] = hashed_password
    await db.users.insert_one(user_dict)
    
    # Create access token
    access_token = create_access_token(data={"sub": user.id})
    
    return Token(access_token=access_token, token_type="bearer", user=user)

@api_router.post("/auth/login", response_model=Token)
async def login(user_data: UserLogin):
    # Find user
    user_record = await db.users.find_one({"email": user_data.email})
    if not user_record or not verify_password(user_data.password, user_record["hashed_password"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    user = User(**parse_from_mongo(user_record))
    access_token = create_access_token(data={"sub": user.id})
    
    return Token(access_token=access_token, token_type="bearer", user=user)

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# WebSocket Route
@api_router.websocket("/ws/{board_id}")
async def websocket_endpoint(websocket: WebSocket, board_id: str):
    await manager.connect(websocket, board_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle incoming WebSocket messages if needed
            pass
    except WebSocketDisconnect:
        manager.disconnect(websocket, board_id)

# Workspace Routes
@api_router.post("/workspaces", response_model=Workspace)
async def create_workspace(workspace_data: WorkspaceCreate, current_user: User = Depends(get_current_user)):
    workspace = Workspace(
        name=workspace_data.name,
        description=workspace_data.description,
        owner_id=current_user.id,
        members=[{"user_id": current_user.id, "role": WorkspaceRole.ADMIN}]
    )
    
    workspace_dict = prepare_for_mongo(workspace.dict())
    await db.workspaces.insert_one(workspace_dict)
    
    return workspace

@api_router.get("/workspaces", response_model=TypingList[Workspace])
async def get_workspaces(current_user: User = Depends(get_current_user)):
    workspaces = await db.workspaces.find({
        "members.user_id": current_user.id
    }).to_list(None)
    
    return [Workspace(**parse_from_mongo(ws)) for ws in workspaces]

# Board Routes
@api_router.post("/boards", response_model=Board)
async def create_board(board_data: BoardCreate, current_user: User = Depends(get_current_user)):
    board = Board(
        title=board_data.title,
        workspace_id=board_data.workspace_id,
        visibility=board_data.visibility,
        owner_id=current_user.id,
        members=[{"user_id": current_user.id, "role": BoardRole.OWNER}]
    )
    
    board_dict = prepare_for_mongo(board.dict())
    await db.boards.insert_one(board_dict)
    
    return board

@api_router.get("/boards", response_model=TypingList[Board])
async def get_boards(current_user: User = Depends(get_current_user)):
    boards = await db.boards.find({
        "members.user_id": current_user.id
    }).to_list(None)
    
    return [Board(**parse_from_mongo(board)) for board in boards]

@api_router.get("/boards/{board_id}", response_model=Board)
async def get_board(board_id: str, current_user: User = Depends(get_current_user)):
    board = await db.boards.find_one({"id": board_id, "members.user_id": current_user.id})
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    
    return Board(**parse_from_mongo(board))

# List Routes
@api_router.post("/boards/{board_id}/lists", response_model=BoardList)
async def create_list(board_id: str, list_data: ListCreate, current_user: User = Depends(get_current_user)):
    # Check if user has access to board
    board = await db.boards.find_one({"id": board_id, "members.user_id": current_user.id})
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    
    # Get next position if not provided
    if list_data.position is None:
        last_list = await db.lists.find_one({"board_id": board_id}, sort=[("position", -1)])
        list_data.position = (last_list["position"] + 1000) if last_list else 1000
    
    new_list = BoardList(
        title=list_data.title,
        board_id=board_id,
        position=list_data.position
    )
    
    list_dict = prepare_for_mongo(new_list.dict())
    await db.lists.insert_one(list_dict)
    
    # Log activity
    await log_activity(board_id, current_user.id, ActivityType.LIST_CREATED, {
        "list_id": new_list.id,
        "list_title": new_list.title
    })
    
    return new_list

@api_router.get("/boards/{board_id}/lists", response_model=TypingList[BoardList])
async def get_lists(board_id: str, current_user: User = Depends(get_current_user)):
    # Check if user has access to board
    board = await db.boards.find_one({"id": board_id, "members.user_id": current_user.id})
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    
    lists = await db.lists.find({"board_id": board_id}).sort("position", 1).to_list(None)
    return [BoardList(**parse_from_mongo(lst)) for lst in lists]

# Card Routes
@api_router.post("/lists/{list_id}/cards", response_model=Card)
async def create_card(list_id: str, card_data: CardCreate, current_user: User = Depends(get_current_user)):
    # Check if list exists and get board_id
    list_doc = await db.lists.find_one({"id": list_id})
    if not list_doc:
        raise HTTPException(status_code=404, detail="List not found")
    
    board_id = list_doc["board_id"]
    
    # Check if user has access to board
    board = await db.boards.find_one({"id": board_id, "members.user_id": current_user.id})
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    
    # Get next position if not provided
    if card_data.position is None:
        last_card = await db.cards.find_one({"list_id": list_id}, sort=[("position", -1)])
        card_data.position = (last_card["position"] + 1000) if last_card else 1000
    
    card = Card(
        title=card_data.title,
        description=card_data.description,
        list_id=list_id,
        position=card_data.position,
        labels=card_data.labels,
        assignees=card_data.assignees,
        due_date=card_data.due_date
    )
    
    card_dict = prepare_for_mongo(card.dict())
    await db.cards.insert_one(card_dict)
    
    # Log activity
    await log_activity(board_id, current_user.id, ActivityType.CARD_CREATED, {
        "card_id": card.id,
        "card_title": card.title,
        "list_id": list_id
    })
    
    return card

@api_router.get("/boards/{board_id}/cards", response_model=TypingList[Card])
async def get_cards(board_id: str, current_user: User = Depends(get_current_user)):
    # Check if user has access to board
    board = await db.boards.find_one({"id": board_id, "members.user_id": current_user.id})
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    
    # Get all lists for this board
    lists = await db.lists.find({"board_id": board_id}).to_list(None)
    list_ids = [lst["id"] for lst in lists]
    
    # Get all cards for these lists
    cards = await db.cards.find({"list_id": {"$in": list_ids}}).sort("position", 1).to_list(None)
    return [Card(**parse_from_mongo(card)) for card in cards]

@api_router.put("/cards/{card_id}", response_model=Card)
async def update_card(card_id: str, card_data: CardUpdate, current_user: User = Depends(get_current_user)):
    # Get current card
    current_card = await db.cards.find_one({"id": card_id})
    if not current_card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    # Get board_id through list
    list_doc = await db.lists.find_one({"id": current_card["list_id"]})
    board_id = list_doc["board_id"]
    
    # Check if user has access to board
    board = await db.boards.find_one({"id": board_id, "members.user_id": current_user.id})
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    
    # Prepare update data
    update_data = {k: v for k, v in card_data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    # Handle datetime serialization
    update_data = prepare_for_mongo(update_data)
    
    # Update card
    await db.cards.update_one({"id": card_id}, {"$set": update_data})
    
    # Get updated card
    updated_card = await db.cards.find_one({"id": card_id})
    card_obj = Card(**parse_from_mongo(updated_card))
    
    # Log activity based on what changed
    activity_type = ActivityType.CARD_MOVED if 'list_id' in update_data else ActivityType.CARD_UPDATED
    await log_activity(board_id, current_user.id, activity_type, {
        "card_id": card_id,
        "card_title": card_obj.title,
        "changes": update_data
    })
    
    return card_obj

# Comment Routes
@api_router.post("/cards/{card_id}/comments", response_model=Comment)
async def create_comment(card_id: str, comment_data: CommentCreate, current_user: User = Depends(get_current_user)):
    # Get card and verify access
    card = await db.cards.find_one({"id": card_id})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    # Get board_id through list
    list_doc = await db.lists.find_one({"id": card["list_id"]})
    board_id = list_doc["board_id"]
    
    # Check if user has access to board
    board = await db.boards.find_one({"id": board_id, "members.user_id": current_user.id})
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    
    comment = Comment(
        text=comment_data.text,
        card_id=card_id,
        author_id=current_user.id
    )
    
    comment_dict = prepare_for_mongo(comment.dict())
    await db.comments.insert_one(comment_dict)
    
    # Log activity
    await log_activity(board_id, current_user.id, ActivityType.COMMENT_ADDED, {
        "card_id": card_id,
        "comment_id": comment.id,
        "comment_text": comment.text[:100] + "..." if len(comment.text) > 100 else comment.text
    })
    
    return comment

@api_router.get("/cards/{card_id}/comments", response_model=TypingList[Comment])
async def get_comments(card_id: str, current_user: User = Depends(get_current_user)):
    # Get card and verify access
    card = await db.cards.find_one({"id": card_id})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    # Get board_id through list
    list_doc = await db.lists.find_one({"id": card["list_id"]})
    board_id = list_doc["board_id"]
    
    # Check if user has access to board
    board = await db.boards.find_one({"id": board_id, "members.user_id": current_user.id})
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    
    comments = await db.comments.find({"card_id": card_id}).sort("created_at", 1).to_list(None)
    return [Comment(**parse_from_mongo(comment)) for comment in comments]

# Activity Log Routes
@api_router.get("/boards/{board_id}/activities", response_model=TypingList[ActivityLog])
async def get_activities(board_id: str, limit: int = 20, current_user: User = Depends(get_current_user)):
    # Check if user has access to board
    board = await db.boards.find_one({"id": board_id, "members.user_id": current_user.id})
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    
    activities = await db.activity_logs.find({"board_id": board_id}).sort("created_at", -1).limit(limit).to_list(None)
    return [ActivityLog(**parse_from_mongo(activity)) for activity in activities]

# Search Routes
@api_router.get("/boards/{board_id}/search")
async def search_cards(
    board_id: str, 
    q: Optional[str] = None,
    labels: Optional[str] = None,
    assignees: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    # Check if user has access to board
    board = await db.boards.find_one({"id": board_id, "members.user_id": current_user.id})
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    
    # Build search query
    search_filter = {}
    
    # Get all lists for this board
    lists = await db.lists.find({"board_id": board_id}).to_list(None)
    list_ids = [lst["id"] for lst in lists]
    search_filter["list_id"] = {"$in": list_ids}
    
    # Text search
    if q:
        search_filter["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}}
        ]
    
    # Label filter
    if labels:
        label_list = labels.split(",")
        search_filter["labels"] = {"$in": label_list}
    
    # Assignee filter
    if assignees:
        assignee_list = assignees.split(",")
        search_filter["assignees"] = {"$in": assignee_list}
    
    cards = await db.cards.find(search_filter).sort("position", 1).to_list(None)
    return [Card(**parse_from_mongo(card)) for card in cards]

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()