import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { DndContext, DragOverlay, closestCorners, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { 
  Plus, 
  MoreHorizontal, 
  Calendar, 
  User, 
  MessageCircle, 
  ArrowLeft,
  Search,
  Filter,
  Users,
  Activity,
  Clock,
  Tag,
  Edit3,
  Trash2,
  Send,
  Eye
} from 'lucide-react';
import { toast } from '../hooks/use-toast';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// WebSocket connection
let socket = null;

const Board = ({ user, onLogout }) => {
  const { boardId } = useParams();
  const [board, setBoard] = useState(null);
  const [lists, setLists] = useState([]);
  const [cards, setCards] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCard, setActiveCard] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showCardModal, setShowCardModal] = useState(false);
  const [showActivitySidebar, setShowActivitySidebar] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');
  const [newCardTitle, setNewCardTitle] = useState('');
  const [activeListId, setActiveListId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cardComments, setCardComments] = useState([]);
  const [newComment, setNewComment] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    fetchBoardData();
    connectWebSocket();
    
    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [boardId]);

  const connectWebSocket = useCallback(() => {
    try {
      const wsUrl = BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');
      socket = new WebSocket(`${wsUrl}/api/ws/${boardId}`);
      
      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'activity') {
          setActivities(prev => [data.activity, ...prev.slice(0, 19)]);
          // Refresh cards and lists on activity
          fetchCards();
        }
      };
      
      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  }, [boardId]);

  const fetchBoardData = async () => {
    try {
      const [boardRes, listsRes, cardsRes, activitiesRes] = await Promise.all([
        axios.get(`${API}/boards/${boardId}`),
        axios.get(`${API}/boards/${boardId}/lists`),
        axios.get(`${API}/boards/${boardId}/cards`),
        axios.get(`${API}/boards/${boardId}/activities`)
      ]);
      
      setBoard(boardRes.data);
      setLists(listsRes.data);
      setCards(cardsRes.data);
      setActivities(activitiesRes.data);
    } catch (error) {
      console.error('Error fetching board data:', error);
      toast({
        title: "Error",
        description: "Failed to load board data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCards = async () => {
    try {
      const response = await axios.get(`${API}/boards/${boardId}/cards`);
      setCards(response.data);
    } catch (error) {
      console.error('Error fetching cards:', error);
    }
  };

  const fetchCardComments = async (cardId) => {
    try {
      const response = await axios.get(`${API}/cards/${cardId}/comments`);
      setCardComments(response.data);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const createList = async () => {
    if (!newListTitle.trim()) return;
    
    try {
      const response = await axios.post(`${API}/boards/${boardId}/lists`, {
        title: newListTitle
      });
      
      setLists([...lists, response.data]);
      setNewListTitle('');
      
      toast({
        title: "List created",
        description: `"${response.data.title}" list has been created`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create list",
        variant: "destructive",
      });
    }
  };

  const createCard = async (listId) => {
    if (!newCardTitle.trim()) return;
    
    try {
      const response = await axios.post(`${API}/lists/${listId}/cards`, {
        title: newCardTitle
      });
      
      setCards([...cards, response.data]);
      setNewCardTitle('');
      setActiveListId(null);
      
      toast({
        title: "Card created",
        description: `"${response.data.title}" card has been created`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create card",
        variant: "destructive",
      });
    }
  };

  const updateCard = async (cardId, updates) => {
    try {
      const response = await axios.put(`${API}/cards/${cardId}`, updates);
      
      setCards(cards.map(card => 
        card.id === cardId ? response.data : card
      ));
      
      if (selectedCard && selectedCard.id === cardId) {
        setSelectedCard(response.data);
      }
    } catch (error) {
      console.error('Error updating card:', error);
      toast({
        title: "Error",
        description: "Failed to update card",
        variant: "destructive",
      });
    }
  };

  const addComment = async () => {
    if (!newComment.trim() || !selectedCard) return;
    
    try {
      const response = await axios.post(`${API}/cards/${selectedCard.id}/comments`, {
        text: newComment
      });
      
      setCardComments([...cardComments, response.data]);
      setNewComment('');
      
      toast({
        title: "Comment added",
        description: "Your comment has been posted",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add comment",
        variant: "destructive",
      });
    }
  };

  const handleDragStart = (event) => {
    const { active } = event;
    const card = cards.find(c => c.id === active.id);
    setActiveCard(card);
  };

  const handleDragOver = (event) => {
    const { active, over } = event;
    
    if (!over) return;
    
    const activeCard = cards.find(c => c.id === active.id);
    if (!activeCard) return;

    // Check if we're dropping on a list or another card
    const overList = lists.find(l => l.id === over.id);
    const overCard = cards.find(c => c.id === over.id);
    
    let targetListId;
    if (overList) {
      targetListId = overList.id;
    } else if (overCard) {
      targetListId = overCard.list_id;
    } else {
      return;
    }

    // Only update if moving to a different list
    if (activeCard.list_id !== targetListId) {
      const updatedCards = cards.map(card => 
        card.id === activeCard.id 
          ? { ...card, list_id: targetListId }
          : card
      );
      setCards(updatedCards);
    }
  };

  const handleDragEnd = async (event) => {
    setActiveCard(null);
    
    const { active, over } = event;
    
    if (!over) return;
    
    const activeCard = cards.find(c => c.id === active.id);
    if (!activeCard) return;

    // Determine target list
    const overList = lists.find(l => l.id === over.id);
    const overCard = cards.find(c => c.id === over.id);
    
    let targetListId;
    if (overList) {
      targetListId = overList.id;
    } else if (overCard) {
      targetListId = overCard.list_id;
    } else {
      return;
    }

    // Update card position in backend
    if (activeCard.list_id !== targetListId) {
      await updateCard(activeCard.id, { list_id: targetListId });
    }
  };

  const openCardModal = async (card) => {
    setSelectedCard(card);
    setShowCardModal(true);
    await fetchCardComments(card.id);
  };

  const filteredCards = cards.filter(card =>
    card.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center space-x-4">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
          <p className="text-slate-600 font-medium">Loading board...</p>
        </div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-slate-900 mb-2">Board not found</h2>
          <p className="text-slate-600 mb-4">The requested board could not be loaded.</p>
          <Link to="/dashboard">
            <Button>Return to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link to="/dashboard">
                <Button variant="ghost" size="sm" data-testid="back-to-dashboard">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
              <Separator orientation="vertical" className="h-8" />
              <div>
                <h1 className="text-xl font-semibold text-slate-900">{board.title}</h1>
                <div className="flex items-center space-x-2 mt-1">
                  <Badge variant="secondary" className="text-xs">
                    {board.visibility}
                  </Badge>
                  <div className="flex items-center text-sm text-slate-500">
                    <Users className="w-3 h-3 mr-1" />
                    {board.members?.length || 1} member{board.members?.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search cards..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                  data-testid="search-cards"
                />
              </div>
              
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowActivitySidebar(true)}
                data-testid="activity-sidebar-toggle"
              >
                <Activity className="w-4 h-4 mr-2" />
                Activity
              </Button>
              
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold text-sm">
                  {user.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onLogout}
                data-testid="logout-button"
              >
                <Eye className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-64px)]">
        {/* Board Content */}
        <div className="flex-1 p-6 overflow-x-auto">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex space-x-6 h-full">
              {lists.map((list) => (
                <ListColumn
                  key={list.id}
                  list={list}
                  cards={filteredCards.filter(card => card.list_id === list.id)}
                  onCardClick={openCardModal}
                  onAddCard={(title) => {
                    setNewCardTitle(title);
                    createCard(list.id);
                  }}
                  activeListId={activeListId}
                  setActiveListId={setActiveListId}
                />
              ))}
              
              {/* Add New List */}
              <div className="kanban-column w-80 p-4 flex-shrink-0">
                <div className="mb-4">
                  <Input
                    placeholder="Enter list title..."
                    value={newListTitle}
                    onChange={(e) => setNewListTitle(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && createList()}
                    className="mb-3"
                    data-testid="new-list-input"
                  />
                  <Button 
                    onClick={createList} 
                    className="w-full"
                    disabled={!newListTitle.trim()}
                    data-testid="create-list-button"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add List
                  </Button>
                </div>
              </div>
            </div>
            
            <DragOverlay>
              {activeCard ? (
                <CardComponent card={activeCard} isDragging />
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>

        {/* Activity Sidebar */}
        {showActivitySidebar && (
          <div className="w-80 bg-white border-l border-slate-200 flex flex-col">
            <div className="p-4 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">Activity</h3>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowActivitySidebar(false)}
                  data-testid="close-activity-sidebar"
                >
                  ×
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {activities.map((activity) => (
                  <ActivityItem key={activity.id} activity={activity} />
                ))}
                {activities.length === 0 && (
                  <div className="text-center text-slate-500 py-8">
                    <Activity className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                    <p>No recent activity</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Card Modal */}
      <Dialog open={showCardModal} onOpenChange={setShowCardModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              {selectedCard?.title}
            </DialogTitle>
            <DialogDescription>
              in list "{lists.find(l => l.id === selectedCard?.list_id)?.title}"
            </DialogDescription>
          </DialogHeader>
          
          {selectedCard && (
            <div className="space-y-6">
              {/* Card Details */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                  <div>
                    <Label htmlFor="card-description">Description</Label>
                    <Textarea
                      id="card-description"
                      placeholder="Add a more detailed description..."
                      value={selectedCard.description || ''}
                      onChange={(e) => updateCard(selectedCard.id, { description: e.target.value })}
                      className="min-h-[100px] mt-2"
                      data-testid="card-description"
                    />
                  </div>
                  
                  {/* Comments */}
                  <div>
                    <h4 className="font-medium text-slate-900 mb-3">Comments</h4>
                    <div className="space-y-3">
                      {cardComments.map((comment) => (
                        <div key={comment.id} className="bg-slate-50 rounded-lg p-3">
                          <div className="flex items-start space-x-3">
                            <Avatar className="w-6 h-6">
                              <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                                {user.name[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 text-sm">
                                <span className="font-medium">{user.name}</span>
                                <span className="text-slate-500">
                                  {new Date(comment.created_at).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-slate-700 mt-1">{comment.text}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Add Comment */}
                    <div className="flex items-end space-x-2 mt-4">
                      <Textarea
                        placeholder="Write a comment..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="flex-1 min-h-[60px]"
                        data-testid="new-comment-input"
                      />
                      <Button 
                        onClick={addComment}
                        disabled={!newComment.trim()}
                        data-testid="add-comment-button"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                
                {/* Sidebar */}
                <div className="space-y-4">
                  <div>
                    <Label>Labels</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedCard.labels?.map((label, index) => (
                        <Badge key={index} variant="secondary">{label}</Badge>
                      ))}
                      <Button variant="outline" size="sm">
                        <Tag className="w-3 h-3 mr-1" />
                        Add Label
                      </Button>
                    </div>
                  </div>
                  
                  <div>
                    <Label>Due Date</Label>
                    <div className="mt-2">
                      {selectedCard.due_date ? (
                        <div className="flex items-center text-sm text-slate-600">
                          <Calendar className="w-4 h-4 mr-2" />
                          {new Date(selectedCard.due_date).toLocaleDateString()}
                        </div>
                      ) : (
                        <Button variant="outline" size="sm">
                          <Calendar className="w-3 h-3 mr-1" />
                          Add Due Date
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <Label>Assignees</Label>
                    <div className="flex items-center space-x-2 mt-2">
                      {selectedCard.assignees?.length > 0 ? (
                        selectedCard.assignees.map((assignee, index) => (
                          <Avatar key={index} className="w-6 h-6">
                            <AvatarFallback className="text-xs">
                              {assignee[0]}
                            </AvatarFallback>
                          </Avatar>
                        ))
                      ) : (
                        <Button variant="outline" size="sm">
                          <User className="w-3 h-3 mr-1" />
                          Assign
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// List Column Component
const ListColumn = ({ list, cards, onCardClick, onAddCard, activeListId, setActiveListId }) => {
  const [newCardTitle, setNewCardTitle] = useState('');
  const [isAddingCard, setIsAddingCard] = useState(false);

  const handleAddCard = () => {
    if (newCardTitle.trim()) {
      onAddCard(newCardTitle);
      setNewCardTitle('');
      setIsAddingCard(false);
    }
  };

  const {
    setNodeRef: setListRef,
    attributes: listAttributes,
    listeners: listListeners,
  } = useSortable({
    id: list.id,
    data: {
      type: 'list',
    },
  });

  return (
    <div 
      ref={setListRef}
      {...listAttributes}
      {...listListeners}
      className="kanban-column w-80 p-4 flex-shrink-0"
      data-testid={`list-${list.id}`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900">{list.title}</h3>
        <div className="flex items-center space-x-2">
          <Badge variant="secondary" className="text-xs">
            {cards.length}
          </Badge>
          <Button variant="ghost" size="sm">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      <SortableContext items={cards.map(card => card.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3 mb-4 min-h-[200px]">
          {cards.map((card) => (
            <CardComponent
              key={card.id}
              card={card}
              onClick={() => onCardClick(card)}
            />
          ))}
        </div>
      </SortableContext>
      
      {isAddingCard ? (
        <div className="space-y-2">
          <Input
            placeholder="Enter card title..."
            value={newCardTitle}
            onChange={(e) => setNewCardTitle(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddCard()}
            autoFocus
            data-testid="new-card-input"
          />
          <div className="flex space-x-2">
            <Button onClick={handleAddCard} size="sm" data-testid="add-card-submit">
              Add Card
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                setIsAddingCard(false);
                setNewCardTitle('');
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="ghost"
          className="w-full justify-start text-slate-500 hover:text-slate-700"
          onClick={() => setIsAddingCard(true)}
          data-testid="add-card-button"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add a card
        </Button>
      )}
    </div>
  );
};

// Card Component
const CardComponent = ({ card, onClick, isDragging = false }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: card.id,
    data: {
      type: 'card',
      card,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging || isSortableDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`kanban-card ${isDragging ? 'dragging' : ''} ${isSortableDragging ? 'dragging' : ''}`}
      onClick={() => onClick && onClick(card)}
      data-testid={`card-${card.id}`}
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium text-slate-900 text-sm leading-tight flex-1">
          {card.title}
        </h4>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100">
          <Edit3 className="w-3 h-3" />
        </Button>
      </div>
      
      {card.description && (
        <p className="text-xs text-slate-600 mb-3 line-clamp-2">
          {card.description}
        </p>
      )}
      
      {card.labels && card.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {card.labels.slice(0, 3).map((label, index) => (
            <Badge key={index} variant="secondary" className="text-xs px-2 py-0">
              {label}
            </Badge>
          ))}
          {card.labels.length > 3 && (
            <Badge variant="secondary" className="text-xs px-2 py-0">
              +{card.labels.length - 3}
            </Badge>
          )}
        </div>
      )}
      
      <div className="flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center space-x-3">
          {card.due_date && (
            <div className="flex items-center">
              <Calendar className="w-3 h-3 mr-1" />
              {new Date(card.due_date).toLocaleDateString()}
            </div>
          )}
          <div className="flex items-center">
            <MessageCircle className="w-3 h-3 mr-1" />
            0
          </div>
        </div>
        
        {card.assignees && card.assignees.length > 0 && (
          <div className="flex -space-x-1">
            {card.assignees.slice(0, 2).map((assignee, index) => (
              <Avatar key={index} className="w-5 h-5 border-2 border-white">
                <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                  {assignee[0]}
                </AvatarFallback>
              </Avatar>
            ))}
            {card.assignees.length > 2 && (
              <div className="w-5 h-5 bg-slate-200 rounded-full border-2 border-white flex items-center justify-center">
                <span className="text-[10px] text-slate-600">+{card.assignees.length - 2}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Activity Item Component
const ActivityItem = ({ activity }) => {
  const getActivityIcon = () => {
    switch (activity.activity_type) {
      case 'card_created':
        return <Plus className="w-4 h-4 text-green-600" />;
      case 'card_moved':
        return <ArrowLeft className="w-4 h-4 text-blue-600" />;
      case 'comment_added':
        return <MessageCircle className="w-4 h-4 text-purple-600" />;
      default:
        return <Activity className="w-4 h-4 text-slate-600" />;
    }
  };

  const getActivityMessage = () => {
    const details = activity.details;
    switch (activity.activity_type) {
      case 'card_created':
        return `created card "${details.card_title}"`;
      case 'card_moved':
        return `moved card "${details.card_title}"`;
      case 'comment_added':
        return `commented on "${details.card_title}"`;
      default:
        return 'performed an action';
    }
  };

  return (
    <div className="flex items-start space-x-3" data-testid={`activity-${activity.id}`}>
      <div className="flex-shrink-0 w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
        {getActivityIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-900">
          <span className="font-medium">Someone</span> {getActivityMessage()}
        </p>
        <div className="flex items-center mt-1 text-xs text-slate-500">
          <Clock className="w-3 h-3 mr-1" />
          {new Date(activity.created_at).toLocaleString()}
        </div>
      </div>
    </div>
  );
};

export default Board;