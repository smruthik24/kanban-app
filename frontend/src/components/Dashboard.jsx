import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Users, 
  Calendar, 
  Clock,
  Briefcase,
  LogOut,
  Settings,
  Bell,
  Grid3X3,
  Kanban
} from 'lucide-react';
import { toast } from '../hooks/use-toast';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Dashboard = ({ user, onLogout }) => {
  const [boards, setBoards] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateBoard, setShowCreateBoard] = useState(false);
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [newBoard, setNewBoard] = useState({
    title: '',
    workspace_id: '',
    visibility: 'private'
  });
  const [newWorkspace, setNewWorkspace] = useState({
    name: '',
    description: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [boardsRes, workspacesRes] = await Promise.all([
        axios.get(`${API}/boards`),
        axios.get(`${API}/workspaces`)
      ]);
      
      setBoards(boardsRes.data);
      setWorkspaces(workspacesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBoard = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API}/boards`, newBoard);
      setBoards([...boards, response.data]);
      setNewBoard({ title: '', workspace_id: '', visibility: 'private' });
      setShowCreateBoard(false);
      
      toast({
        title: "Board created",
        description: `"${response.data.title}" has been created successfully`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create board",
        variant: "destructive",
      });
    }
  };

  const handleCreateWorkspace = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API}/workspaces`, newWorkspace);
      setWorkspaces([...workspaces, response.data]);
      setNewWorkspace({ name: '', description: '' });
      setShowCreateWorkspace(false);
      
      toast({
        title: "Workspace created",
        description: `"${response.data.name}" workspace has been created`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create workspace",
        variant: "destructive",
      });
    }
  };

  const filteredBoards = boards.filter(board =>
    board.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getWorkspaceName = (workspaceId) => {
    const workspace = workspaces.find(w => w.id === workspaceId);
    return workspace ? workspace.name : 'Personal';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center space-x-4">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
          <p className="text-slate-600 font-medium">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-bold text-slate-900">TaskWave</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" data-testid="notifications-button">
                <Bell className="w-5 h-5" />
              </Button>
              
              <div className="flex items-center space-x-3">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold text-sm">
                    {user.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-slate-900">{user.name}</p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onLogout}
                  data-testid="logout-button"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div>
              <h2 className="text-3xl font-bold text-slate-900">
                Welcome back, {user.name.split(' ')[0]}
              </h2>
              <p className="text-slate-600 mt-1">
                Manage your projects and collaborate with your team
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              <Dialog open={showCreateWorkspace} onOpenChange={setShowCreateWorkspace}>
                <DialogTrigger asChild>
                  <Button variant="outline" data-testid="create-workspace-button">
                    <Users className="w-4 h-4 mr-2" />
                    New Workspace
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Workspace</DialogTitle>
                    <DialogDescription>
                      Workspaces help you organize boards and collaborate with teams
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateWorkspace} className="space-y-4">
                    <div>
                      <Label htmlFor="workspace-name">Workspace Name</Label>
                      <Input
                        id="workspace-name"
                        placeholder="e.g., Marketing Team, Product Development"
                        value={newWorkspace.name}
                        onChange={(e) => setNewWorkspace({...newWorkspace, name: e.target.value})}
                        required
                        data-testid="workspace-name-input"
                      />
                    </div>
                    <div>
                      <Label htmlFor="workspace-description">Description (Optional)</Label>
                      <Input
                        id="workspace-description"
                        placeholder="Brief description of this workspace"
                        value={newWorkspace.description}
                        onChange={(e) => setNewWorkspace({...newWorkspace, description: e.target.value})}
                        data-testid="workspace-description-input"
                      />
                    </div>
                    <Button type="submit" className="w-full" data-testid="create-workspace-submit">
                      Create Workspace
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
              
              <Dialog open={showCreateBoard} onOpenChange={setShowCreateBoard}>
                <DialogTrigger asChild>
                  <Button data-testid="create-board-button">
                    <Plus className="w-4 h-4 mr-2" />
                    New Board
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Board</DialogTitle>
                    <DialogDescription>
                      Start a new project board to organize tasks and collaborate
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateBoard} className="space-y-4">
                    <div>
                      <Label htmlFor="board-title">Board Title</Label>
                      <Input
                        id="board-title"
                        placeholder="e.g., Website Redesign, Product Launch"
                        value={newBoard.title}
                        onChange={(e) => setNewBoard({...newBoard, title: e.target.value})}
                        required
                        data-testid="board-title-input"
                      />
                    </div>
                    <div>
                      <Label htmlFor="board-workspace">Workspace</Label>
                      <Select 
                        value={newBoard.workspace_id} 
                        onValueChange={(value) => setNewBoard({...newBoard, workspace_id: value})}
                      >
                        <SelectTrigger data-testid="workspace-select">
                          <SelectValue placeholder="Select workspace (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="personal">Personal Board</SelectItem>
                          {workspaces.map((workspace) => (
                            <SelectItem key={workspace.id} value={workspace.id}>
                              {workspace.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="board-visibility">Visibility</Label>
                      <Select 
                        value={newBoard.visibility} 
                        onValueChange={(value) => setNewBoard({...newBoard, visibility: value})}
                      >
                        <SelectTrigger data-testid="visibility-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="private">Private</SelectItem>
                          <SelectItem value="workspace">Workspace</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="submit" className="w-full" data-testid="create-board-submit">
                      Create Board
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search boards..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="search-boards"
              />
            </div>
            <Button variant="outline" className="flex items-center">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Boards</CardTitle>
              <Grid3X3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{boards.length}</div>
              <p className="text-xs text-muted-foreground">
                Active project boards
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Workspaces</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{workspaces.length}</div>
              <p className="text-xs text-muted-foreground">
                Team collaboration spaces
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">12</div>
              <p className="text-xs text-muted-foreground">
                Actions this week
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Boards Grid */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-slate-900">Your Boards</h3>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm">
                <Kanban className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {filteredBoards.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Kanban className="w-8 h-8 text-slate-400" />
              </div>
              <CardTitle className="mb-2">No boards found</CardTitle>
              <CardDescription className="mb-6">
                {searchQuery 
                  ? `No boards match "${searchQuery}". Try a different search term.`
                  : "Get started by creating your first project board."
                }
              </CardDescription>
              {!searchQuery && (
                <Button onClick={() => setShowCreateBoard(true)} data-testid="empty-state-create-board">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Board
                </Button>
              )}
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredBoards.map((board) => (
                <Link key={board.id} to={`/board/${board.id}`} data-testid={`board-card-${board.id}`}>
                  <Card className="card-hover cursor-pointer group">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                            {board.title}
                          </CardTitle>
                          <div className="flex items-center mt-2 space-x-2">
                            <Badge variant="secondary" className="text-xs">
                              {getWorkspaceName(board.workspace_id)}
                            </Badge>
                            <Badge 
                              variant={board.visibility === 'private' ? 'destructive' : 'success'}
                              className="text-xs"
                            >
                              {board.visibility}
                            </Badge>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm text-slate-500">
                        <div className="flex items-center">
                          <Users className="w-4 h-4 mr-1" />
                          <span>{board.members?.length || 1} member{board.members?.length !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          <span>{new Date(board.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;