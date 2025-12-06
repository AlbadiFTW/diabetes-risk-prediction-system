import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from '../../convex/_generated/api';
import {
  Users, UserCheck, UserX, Activity, TrendingUp, Shield,
  Search, Eye, Trash2, CheckCircle, XCircle,
  AlertTriangle, BarChart3, PieChart, LogOut,
  X, Mail, Phone, Stethoscope, Heart, Loader2, MessageSquare, Clock, FileText, Filter,
  BookOpen, Plus, Edit2, Save, Video, Lightbulb, ExternalLink
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart as RechartsPie, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { toast } from 'sonner';

type TabType = 'overview' | 'users' | 'analytics' | 'assignments' | 'support' | 'audit' | 'education';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'patient' | 'doctor'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  
  // Education Resources state
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [editingResource, setEditingResource] = useState<any>(null);
  const [resourceForm, setResourceForm] = useState({
    title: '',
    description: '',
    content: '',
    type: 'article' as 'article' | 'video' | 'tip' | 'guide' | 'link',
    category: 'general' as 'prevention' | 'nutrition' | 'exercise' | 'medication' | 'monitoring' | 'complications' | 'lifestyle' | 'general',
    url: '',
    thumbnailUrl: '',
    author: '',
    tags: [] as string[],
    isPublished: true,
    order: undefined as number | undefined,
  });
  const [tagInput, setTagInput] = useState('');

  const { signOut } = useAuthActions();

  // Queries
  const stats = useQuery(api.admin.getDashboardStats);
  const users = useQuery(api.admin.getAllUsers, {
    role: roleFilter === 'all' ? 'all' : roleFilter,
    search: searchQuery || undefined,
    status: statusFilter,
  });
  const registrationTrend = useQuery(api.admin.getRegistrationTrend, { days: 14 });
  const assessmentTrend = useQuery(api.admin.getAssessmentTrend, { days: 14 });
  const doctorPatientOverview = useQuery(api.admin.getDoctorPatientOverview);
  const userDetails = useQuery(
    api.admin.getUserDetails,
    selectedUser ? ({ userId: selectedUser._id } as any) : undefined
  );

  // Mutations
  const toggleStatus = useMutation(api.admin.toggleUserStatus);
  const verifyEmail = useMutation(api.admin.verifyUserEmail);
  const deleteUser = useMutation(api.admin.deleteUserByAdmin);
  
  // Education Resources queries and mutations
  const educationResources = useQuery(api.educationResources.getAllResources);
  const createResource = useMutation(api.educationResources.createResource);
  const updateResource = useMutation(api.educationResources.updateResource);
  const deleteResource = useMutation(api.educationResources.deleteResource);
  const seedSampleResources = useMutation(api.educationResources.seedSampleResources);

  const handleToggleStatus = async (userId: any, currentStatus: boolean) => {
    try {
      await toggleStatus({ userId, isActive: !currentStatus });
      toast.success(`User ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update user status');
    }
  };

  const handleVerifyEmail = async (userId: any) => {
    try {
      await verifyEmail({ userId });
      toast.success('Email verified successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to verify email');
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await deleteUser({ userId: userToDelete._id });
      toast.success('User deleted successfully');
      setShowDeleteConfirm(false);
      setUserToDelete(null);
      setSelectedUser(null); // Clear selected user to prevent query errors
      setShowUserModal(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete user');
    }
  };

  // Education Resources handlers
  const handleSaveResource = async () => {
    if (!resourceForm.title.trim() || !resourceForm.description.trim() || !resourceForm.content.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      if (editingResource) {
        await updateResource({
          resourceId: editingResource._id,
          ...resourceForm,
        });
        toast.success('Resource updated successfully');
      } else {
        await createResource(resourceForm);
        toast.success('Resource created successfully');
      }
      setShowResourceModal(false);
      setEditingResource(null);
      setResourceForm({
        title: '',
        description: '',
        content: '',
        type: 'article',
        category: 'general',
        url: '',
        thumbnailUrl: '',
        author: '',
        tags: [],
        isPublished: true,
        order: undefined,
      });
      setTagInput('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save resource');
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !resourceForm.tags.includes(tagInput.trim())) {
      setResourceForm({
        ...resourceForm,
        tags: [...resourceForm.tags, tagInput.trim()],
      });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setResourceForm({
      ...resourceForm,
      tags: resourceForm.tags.filter((t) => t !== tag),
    });
  };

  const formatDate = (timestamp: number | undefined) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDateTime = (timestamp: number | undefined) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    const dateStr = date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const timeStr = date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return `${dateStr} ${timeStr}`;
  };

  const RISK_COLORS = ['#22C55E', '#EAB308', '#F97316', '#EF4444'];

  // Support messages queries
  const supportMessages = useQuery(api.support.getAllSupportMessages, { status: 'all', priority: 'all' });
  const unreadSupportCount = useQuery(api.support.getUnreadSupportCount);
  const markAsRead = useMutation(api.support.markSupportMessageAsRead);
  const updateStatus = useMutation(api.support.updateSupportMessageStatus);
  const respondToMessage = useMutation(api.support.respondToSupportMessage);
  const deleteSupportMessage = useMutation(api.support.deleteSupportMessage);
  const [selectedSupportMessage, setSelectedSupportMessage] = useState<any>(null);
  const [supportResponse, setSupportResponse] = useState('');

  // Audit logs queries
  const auditLogs = useQuery(api.admin.getAuditLogs, { limit: 200 });
  const auditStats = useQuery(api.admin.getAuditLogStats);
  const [auditFilters, setAuditFilters] = useState({
    action: '',
    success: undefined as boolean | undefined,
  });

  // Calculate badge count - only show if > 0
  const supportBadgeCount = typeof unreadSupportCount === 'number' && unreadSupportCount > 0 ? unreadSupportCount : undefined;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
    { id: 'assignments', label: 'Assignments', icon: UserCheck },
    { id: 'support', label: 'Support', icon: MessageSquare, badge: supportBadgeCount },
    { id: 'audit', label: 'Activity Log', icon: FileText },
    { id: 'education', label: 'Education', icon: BookOpen },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Admin Dashboard</h1>
                <p className="text-purple-200 text-sm">Diabetes Risk Prediction System</p>
              </div>
            </div>

            <button
              onClick={() => signOut()}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`relative flex items-center gap-2 px-4 py-3 rounded-t-lg transition ${
                  activeTab === tab.id
                    ? 'bg-gray-50 text-purple-600'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.badge && tab.badge > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] flex items-center justify-center">
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Total Users</p>
                    <p className="text-3xl font-bold text-gray-900">{stats?.totalUsers || 0}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {stats?.patients || 0} patients · {stats?.doctors || 0} doctors
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Total Assessments</p>
                    <p className="text-3xl font-bold text-gray-900">{stats?.totalAssessments || 0}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {stats?.recentAssessments || 0} in last 7 days
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <Activity className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">High Risk Patients</p>
                    <p className="text-3xl font-bold text-red-600">{stats?.highRiskPatients || 0}</p>
                    <p className="text-xs text-gray-400 mt-1">Risk score ≥ 50%</p>
                  </div>
                  <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Verification Rate</p>
                    <p className="text-3xl font-bold text-purple-600">{stats?.verificationRate || 0}%</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {stats?.verifiedUsers || 0} of {stats?.totalUsers || 0} verified
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <Mail className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Risk Distribution */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Distribution</h3>
                <div className="flex items-center">
                  <div className="w-1/2">
                    <ResponsiveContainer width="100%" height={200}>
                      <RechartsPie>
                        <Pie
                          data={[
                            { name: 'Low', value: stats?.riskDistribution?.low || 0 },
                            { name: 'Moderate', value: stats?.riskDistribution?.moderate || 0 },
                            { name: 'High', value: stats?.riskDistribution?.high || 0 },
                            { name: 'Very High', value: stats?.riskDistribution?.veryHigh || 0 },
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {RISK_COLORS.map((color, index) => (
                            <Cell key={index} fill={color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </RechartsPie>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-1/2 space-y-2">
                    {[
                      { label: 'Low Risk', value: stats?.riskDistribution?.low || 0, color: 'bg-green-500' },
                      { label: 'Moderate', value: stats?.riskDistribution?.moderate || 0, color: 'bg-yellow-500' },
                      { label: 'High Risk', value: stats?.riskDistribution?.high || 0, color: 'bg-orange-500' },
                      { label: 'Very High', value: stats?.riskDistribution?.veryHigh || 0, color: 'bg-red-500' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${item.color}`}></div>
                          <span className="text-sm text-gray-600">{item.label}</span>
                        </div>
                        <span className="font-medium">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">New Registrations (14 days)</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={registrationTrend || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#8B5CF6"
                      fill="#C4B5FD"
                      name="Registrations"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
                <p className="text-blue-100">New Registrations (30 days)</p>
                <p className="text-3xl font-bold mt-1">{stats?.recentRegistrations || 0}</p>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
                <p className="text-green-100">Active Users</p>
                <p className="text-3xl font-bold mt-1">{stats?.activeUsers || 0}</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white">
                <p className="text-purple-100">Verified Emails</p>
                <p className="text-3xl font-bold mt-1">{stats?.verifiedUsers || 0}</p>
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by name or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as any)}
                  className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">All Roles</option>
                  <option value="patient">Patients</option>
                  <option value="doctor">Doctors</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Verified</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assessments</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users?.map((user) => (
                    <tr key={user._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                            {user.role === 'doctor' ? (
                              <Stethoscope className="w-5 h-5 text-purple-600" />
                            ) : (
                              <Heart className="w-5 h-5 text-purple-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{user.name}</p>
                            <p className="text-sm text-gray-500">{user.email || 'N/A'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.role === 'doctor'
                            ? 'bg-blue-100 text-blue-800'
                            : user.role === 'admin'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {user.isEmailVerified ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-gray-300" />
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {user.assessmentCount || 0}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              setShowUserModal(true);
                            }}
                            className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {user.role !== 'admin' && (
                            <>
                              <button
                                onClick={() => handleToggleStatus(user._id, user.isActive)}
                                className={`p-2 rounded-lg transition ${
                                  user.isActive
                                    ? 'text-gray-500 hover:text-orange-600 hover:bg-orange-50'
                                    : 'text-gray-500 hover:text-green-600 hover:bg-green-50'
                                }`}
                                title={user.isActive ? 'Deactivate' : 'Activate'}
                              >
                                {user.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                              </button>

                              {!user.isEmailVerified && (
                                <button
                                  onClick={() => handleVerifyEmail(user._id)}
                                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                  title="Verify Email"
                                >
                                  <Mail className="w-4 h-4" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {(!users || users.length === 0) && (
                <div className="text-center py-12 text-gray-500">
                  No users found
                </div>
              )}
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Registration Trend */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">User Registrations</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={registrationTrend || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#8B5CF6"
                      fill="#C4B5FD"
                      name="Registrations"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Assessment Trend */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Health Assessments</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={assessmentTrend || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#10B981"
                      fill="#A7F3D0"
                      name="Assessments"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Risk Distribution Large */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Patient Risk Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={[
                  { name: 'Low Risk', value: stats?.riskDistribution?.low || 0, fill: '#22C55E' },
                  { name: 'Moderate', value: stats?.riskDistribution?.moderate || 0, fill: '#EAB308' },
                  { name: 'High Risk', value: stats?.riskDistribution?.high || 0, fill: '#F97316' },
                  { name: 'Very High', value: stats?.riskDistribution?.veryHigh || 0, fill: '#EF4444' },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {RISK_COLORS.map((color, index) => (
                      <Cell key={index} fill={color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Assignments Tab */}
        {activeTab === 'assignments' && (
          <div className="space-y-6">
            {/* Unassigned Patients Alert */}
            {(doctorPatientOverview?.unassignedCount || 0) > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <p className="text-amber-800">
                  <span className="font-medium">{doctorPatientOverview?.unassignedCount}</span> patients are not assigned to any doctor
                </p>
              </div>
            )}

            {/* Doctors Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {doctorPatientOverview?.doctors.map((doctor) => (
                <div key={doctor._id} className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <Stethoscope className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{doctor.name}</p>
                      <p className="text-sm text-gray-500">{doctor.specialty || 'General'}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-3 border-t border-gray-100">
                    <span className="text-gray-500">Patients</span>
                    <span className="text-2xl font-bold text-blue-600">{doctor.patientCount}</span>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-500">Status</span>
                    <span className={`text-sm font-medium ${doctor.isActive ? 'text-green-600' : 'text-red-600'}`}>
                      {doctor.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Unassigned Patients */}
            {(doctorPatientOverview?.unassignedPatients?.length || 0) > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-900">Unassigned Patients</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {doctorPatientOverview?.unassignedPatients.map((patient) => (
                    <div key={patient._id} className="px-6 py-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                          <Heart className="w-5 h-5 text-gray-400" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{patient.name}</p>
                          <p className="text-sm text-gray-500">Patient</p>
                        </div>
                      </div>
                      <span className="text-sm text-amber-600">No doctor assigned</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Support Tab */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Total Logs</p>
                    <p className="text-3xl font-bold text-gray-900">{auditStats?.totalLogs || 0}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Successful</p>
                    <p className="text-3xl font-bold text-green-600">{auditStats?.successCount || 0}</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Failed</p>
                    <p className="text-3xl font-bold text-red-600">{auditStats?.failureCount || 0}</p>
                  </div>
                  <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                    <XCircle className="w-6 h-6 text-red-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Last 24h</p>
                    <p className="text-3xl font-bold text-purple-600">{auditStats?.recentActivity || 0}</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <Clock className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Filters:</span>
                </div>
                <select
                  value={auditFilters.action}
                  onChange={(e) => setAuditFilters({ ...auditFilters, action: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">All Actions</option>
                  <option value="create_medical_record">Create Medical Record</option>
                  <option value="generate_prediction">Generate Prediction</option>
                  <option value="delete_prediction">Delete Prediction</option>
                  <option value="upload_document">Upload Document</option>
                  <option value="access_dashboard">Access Dashboard</option>
                  <option value="view_patient_data">View Patient Data</option>
                </select>
                <select
                  value={auditFilters.success === undefined ? '' : auditFilters.success.toString()}
                  onChange={(e) => setAuditFilters({ 
                    ...auditFilters, 
                    success: e.target.value === '' ? undefined : e.target.value === 'true' 
                  })}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">All Status</option>
                  <option value="true">Success</option>
                  <option value="false">Failed</option>
                </select>
                <button
                  onClick={() => setAuditFilters({ action: '', success: undefined })}
                  className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
                >
                  Clear Filters
                </button>
              </div>
            </div>

            {/* Audit Logs Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resource</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {auditLogs
                      ?.filter((log: any) => {
                        if (auditFilters.action && log.action !== auditFilters.action) return false;
                        if (auditFilters.success !== undefined && log.success !== auditFilters.success) return false;
                        return true;
                      })
                      .map((log: any, index: number) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDateTime((log as any)._creationTime)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                                  log.userRole === 'admin' ? 'bg-purple-100 text-purple-700' :
                                  log.userRole === 'doctor' ? 'bg-blue-100 text-blue-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {log.userName?.charAt(0) || 'U'}
                                </div>
                              </div>
                              <div className="ml-3">
                                <div className="text-sm font-medium text-gray-900">{log.userName}</div>
                                <div className="text-sm text-gray-500 capitalize">{log.userRole}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                              {log.action?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                            {log.resourceType?.replace(/_/g, ' ')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {log.targetPatientName || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {log.success ? (
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 flex items-center gap-1 w-fit">
                                <CheckCircle className="w-3 h-3" />
                                Success
                              </span>
                            ) : (
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 flex items-center gap-1 w-fit">
                                <XCircle className="w-3 h-3" />
                                Failed
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {(!auditLogs || auditLogs.length === 0) && (
                  <div className="text-center py-12 text-gray-500">
                    No audit logs found
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'support' && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Total Messages</p>
                    <p className="text-3xl font-bold text-gray-900">{supportMessages?.length || 0}</p>
                  </div>
                  <MessageSquare className="w-8 h-8 text-blue-600" />
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Unread</p>
                    <p className="text-3xl font-bold text-red-600">{unreadSupportCount || 0}</p>
                  </div>
                  <Mail className="w-8 h-8 text-red-600" />
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Open</p>
                    <p className="text-3xl font-bold text-orange-600">
                      {supportMessages?.filter((m: any) => m.status === 'open').length || 0}
                    </p>
                  </div>
                  <Clock className="w-8 h-8 text-orange-600" />
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Resolved</p>
                    <p className="text-3xl font-bold text-green-600">
                      {supportMessages?.filter((m: any) => m.status === 'resolved').length || 0}
                    </p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
              </div>
            </div>

            {/* Support Messages List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Support Messages</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {supportMessages && supportMessages.length > 0 ? (
                  supportMessages.map((msg: any) => (
                    <div
                      key={msg._id}
                      className={`px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                        !msg.isRead ? 'bg-blue-50/50' : ''
                      }`}
                      onClick={() => {
                        setSelectedSupportMessage(msg);
                        if (!msg.isRead) {
                          markAsRead({ supportMessageId: msg._id });
                        }
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-gray-900">{msg.subject}</h4>
                            {!msg.isRead && (
                              <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{msg.message.substring(0, 100)}...</p>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>{msg.email}</span>
                            {msg.name && <span>• {msg.name}</span>}
                            <span>• {formatDateTime((msg as any)._creationTime)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            msg.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                            msg.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                            msg.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {msg.priority}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            msg.status === 'open' ? 'bg-blue-100 text-blue-700' :
                            msg.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                            msg.status === 'resolved' ? 'bg-green-100 text-green-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {msg.status}
                          </span>
                          {(msg.status === 'resolved' || msg.status === 'closed') && (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!confirm('Delete this support message? This cannot be undone.')) {
                                  return;
                                }
                                try {
                                  await deleteSupportMessage({ supportMessageId: msg._id });
                                  toast.success('Support message deleted');
                                  if (selectedSupportMessage?._id === msg._id) {
                                    setSelectedSupportMessage(null);
                                  }
                                } catch (error: any) {
                                  toast.error(error.message || 'Failed to delete message');
                                }
                              }}
                              className="ml-1 p-1 rounded-full hover:bg-red-50 text-red-500"
                              title="Delete message"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-6 py-12 text-center text-gray-500">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No support messages yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Education Resources Tab */}
        {activeTab === 'education' && (
          <div className="space-y-6">
            {/* Header with Add Button */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Education Resources</h2>
                <p className="text-gray-600 mt-1">Manage articles, videos, tips, and guides for patients</p>
              </div>
              <div className="flex items-center gap-3">
                {(!educationResources || educationResources.length === 0) && (
                  <button
                    onClick={async () => {
                      try {
                        await seedSampleResources({});
                        toast.success('Sample resources added successfully!');
                      } catch (error: any) {
                        toast.error(error.message || 'Failed to seed sample resources');
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                  >
                    <Plus className="w-4 h-4" />
                    Add Sample Content
                  </button>
                )}
                <button
                  onClick={() => {
                    setEditingResource(null);
                    setResourceForm({
                      title: '',
                      description: '',
                      content: '',
                      type: 'article',
                      category: 'general',
                      url: '',
                      thumbnailUrl: '',
                      author: '',
                      tags: [],
                      isPublished: true,
                      order: undefined,
                    });
                    setTagInput('');
                    setShowResourceModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                >
                  <Plus className="w-4 h-4" />
                  Add Resource
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Total Resources</p>
                    <p className="text-3xl font-bold text-gray-900">{educationResources?.length || 0}</p>
                  </div>
                  <BookOpen className="w-8 h-8 text-blue-600" />
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Published</p>
                    <p className="text-3xl font-bold text-green-600">
                      {educationResources?.filter((r: any) => r.isPublished).length || 0}
                    </p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Draft</p>
                    <p className="text-3xl font-bold text-orange-600">
                      {educationResources?.filter((r: any) => !r.isPublished).length || 0}
                    </p>
                  </div>
                  <FileText className="w-8 h-8 text-orange-600" />
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Total Views</p>
                    <p className="text-3xl font-bold text-purple-600">
                      {educationResources?.reduce((sum: number, r: any) => sum + (r.viewCount || 0), 0) || 0}
                    </p>
                  </div>
                  <Eye className="w-8 h-8 text-purple-600" />
                </div>
              </div>
            </div>

            {/* Resources List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">All Resources</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {educationResources && educationResources.length > 0 ? (
                  educationResources.map((resource: any) => {
                    const typeIcon = resource.type === 'video' ? Video :
                                    resource.type === 'tip' ? Lightbulb :
                                    resource.type === 'link' ? ExternalLink : BookOpen;
                    const TypeIcon = typeIcon;
                    return (
                      <div
                        key={resource._id}
                        className="px-6 py-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <TypeIcon className="w-5 h-5 text-purple-600" />
                              <h4 className="font-semibold text-gray-900">{resource.title}</h4>
                              {!resource.isPublished && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                                  Draft
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{resource.description}</p>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span className="capitalize">{resource.type}</span>
                              <span>•</span>
                              <span className="capitalize">{resource.category}</span>
                              {resource.viewCount !== undefined && (
                                <>
                                  <span>•</span>
                                  <span className="flex items-center gap-1">
                                    <Eye className="w-3 h-3" />
                                    {resource.viewCount} views
                                  </span>
                                </>
                              )}
                              {resource.publishedAt && (
                                <>
                                  <span>•</span>
                                  <span>{formatDate(resource.publishedAt)}</span>
                                </>
                              )}
                            </div>
                            {resource.tags && resource.tags.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {resource.tags.map((tag: string, idx: number) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <button
                              onClick={() => {
                                setEditingResource(resource);
                                setResourceForm({
                                  title: resource.title,
                                  description: resource.description,
                                  content: resource.content,
                                  type: resource.type,
                                  category: resource.category,
                                  url: resource.url || '',
                                  thumbnailUrl: resource.thumbnailUrl || '',
                                  author: resource.author || '',
                                  tags: resource.tags || [],
                                  isPublished: resource.isPublished,
                                  order: resource.order,
                                });
                                setTagInput('');
                                setShowResourceModal(true);
                              }}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="Edit resource"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={async () => {
                                if (!confirm('Delete this resource? This cannot be undone.')) {
                                  return;
                                }
                                try {
                                  await deleteResource({ resourceId: resource._id });
                                  toast.success('Resource deleted');
                                } catch (error: any) {
                                  toast.error(error.message || 'Failed to delete resource');
                                }
                              }}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="Delete resource"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="px-6 py-12 text-center text-gray-500">
                    <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No education resources yet</p>
                    <p className="text-sm mt-1">Click "Add Resource" to create your first one</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* User Details Modal */}
      {showUserModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold">User Details</h2>
              <button
                onClick={() => {
                  setShowUserModal(false);
                  setSelectedUser(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* User Info */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
                  {selectedUser.role === 'doctor' ? (
                    <Stethoscope className="w-8 h-8 text-purple-600" />
                  ) : (
                    <Heart className="w-8 h-8 text-purple-600" />
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{userDetails?.name || selectedUser.name}</h3>
                  <p className="text-gray-500">{userDetails?.email || selectedUser.email}</p>
                  <div className="flex gap-2 mt-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      selectedUser.role === 'doctor' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {selectedUser.role}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      userDetails?.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {userDetails?.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {userDetails?.isEmailVerified && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        Verified
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl">
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="font-medium">{userDetails?.phone || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Gender</p>
                  <p className="font-medium capitalize">{userDetails?.gender || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Date of Birth</p>
                  <p className="font-medium">{userDetails?.dateOfBirth || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Joined</p>
                  <p className="font-medium">{formatDate(userDetails?._creationTime)}</p>
                </div>
              </div>

              {/* Patient-specific: Assessments */}
              {selectedUser.role === 'patient' && userDetails?.predictions && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">
                    Assessment History ({userDetails?.predictions?.length || 0})
                  </h4>
                  {userDetails?.predictions && userDetails.predictions.length > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {userDetails.predictions.slice(0, 10).map((pred: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <span className="text-sm text-gray-600">{formatDateTime(pred._creationTime)}</span>
                          <span className={`px-2 py-1 rounded-full text-sm font-medium ${
                            pred.riskScore >= 75 ? 'bg-red-100 text-red-700' :
                            pred.riskScore >= 50 ? 'bg-orange-100 text-orange-700' :
                            pred.riskScore >= 20 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {pred.riskScore.toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No assessments yet</p>
                  )}
                </div>
              )}

              {/* Doctor-specific: Patients */}
              {selectedUser.role === 'doctor' && userDetails && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">
                    Assigned Patients ({userDetails?.patientCount || 0})
                  </h4>
                  {userDetails?.patients && userDetails.patients.length > 0 ? (
                    <div className="space-y-2">
                      {userDetails.patients.map((patient: any) => (
                        <div key={patient._id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                          <Heart className="w-4 h-4 text-gray-400" />
                          <span className="text-sm">{patient.firstName} {patient.lastName}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No patients assigned</p>
                  )}
                </div>
              )}

              {/* Actions */}
              {selectedUser.role !== 'admin' && (
                <div className="flex gap-3 pt-4 border-t">
                  <button
                    onClick={() => handleToggleStatus(selectedUser._id, userDetails?.isActive ?? true)}
                    className={`flex-1 py-2 rounded-lg font-medium transition ${
                      userDetails?.isActive
                        ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {userDetails?.isActive ? 'Deactivate Account' : 'Activate Account'}
                  </button>

                  <button
                    onClick={() => {
                      setUserToDelete(selectedUser);
                      setShowDeleteConfirm(true);
                    }}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Support Message Detail Modal */}
      {selectedSupportMessage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedSupportMessage.subject}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedSupportMessage.email} {selectedSupportMessage.name && `• ${selectedSupportMessage.name}`}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedSupportMessage(null);
                  setSupportResponse('');
                }}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Message Info */}
              <div className="flex items-center gap-4">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  selectedSupportMessage.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                  selectedSupportMessage.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                  selectedSupportMessage.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {selectedSupportMessage.priority}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  selectedSupportMessage.status === 'open' ? 'bg-blue-100 text-blue-700' :
                  selectedSupportMessage.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                  selectedSupportMessage.status === 'resolved' ? 'bg-green-100 text-green-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {selectedSupportMessage.status}
                </span>
                <span className="text-sm text-gray-500">
                  {formatDateTime((selectedSupportMessage as any)._creationTime)}
                </span>
              </div>

              {/* Original Message */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Message</h3>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedSupportMessage.message}</p>
                </div>
              </div>

              {/* Admin Response (if exists) */}
              {selectedSupportMessage.adminResponse && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Admin Response</h3>
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-gray-700 whitespace-pre-wrap">{selectedSupportMessage.adminResponse}</p>
                    {selectedSupportMessage.respondedAt && (
                      <p className="text-xs text-gray-500 mt-2">
                        Responded on {formatDateTime(selectedSupportMessage.respondedAt)}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-4 pt-4 border-t">
                {/* Status Update */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Update Status</label>
                  <div className="flex gap-2">
                    {['open', 'in_progress', 'resolved', 'closed'].map((status) => (
                      <button
                        key={status}
                        onClick={async () => {
                          try {
                            await updateStatus({
                              supportMessageId: selectedSupportMessage._id,
                              status: status as any,
                            });
                            toast.success('Status updated');
                            setSelectedSupportMessage({ ...selectedSupportMessage, status: status as any });
                          } catch (error: any) {
                            toast.error(error.message || 'Failed to update status');
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                          selectedSupportMessage.status === status
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {status.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Response Form */}
                {!selectedSupportMessage.adminResponse && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Response</label>
                    <textarea
                      value={supportResponse}
                      onChange={(e) => setSupportResponse(e.target.value)}
                      placeholder="Type your response here..."
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                    />
                    <button
                      onClick={async () => {
                        if (!supportResponse.trim()) {
                          toast.error('Please enter a response');
                          return;
                        }
                        try {
                          await respondToMessage({
                            supportMessageId: selectedSupportMessage._id,
                            response: supportResponse,
                          });
                          toast.success('Response sent');
                          setSelectedSupportMessage({
                            ...selectedSupportMessage,
                            adminResponse: supportResponse,
                            status: 'resolved',
                            respondedAt: Date.now(),
                          });
                          setSupportResponse('');
                        } catch (error: any) {
                          toast.error(error.message || 'Failed to send response');
                        }
                      }}
                      className="mt-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                    >
                      Send Response
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && userToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Delete User?</h3>
            </div>

            <p className="text-gray-600 mb-4">
              Are you sure you want to delete <strong>{userToDelete.name}</strong>?
              This will permanently remove their account and all associated data.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setUserToDelete(null);
                }}
                className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resource Create/Edit Modal */}
      {showResourceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">
                {editingResource ? 'Edit Resource' : 'Create New Resource'}
              </h2>
              <button
                onClick={() => {
                  setShowResourceModal(false);
                  setEditingResource(null);
                  setResourceForm({
                    title: '',
                    description: '',
                    content: '',
                    type: 'article',
                    category: 'general',
                    url: '',
                    thumbnailUrl: '',
                    author: '',
                    tags: [],
                    isPublished: true,
                    order: undefined,
                  });
                  setTagInput('');
                }}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
                  <input
                    type="text"
                    value={resourceForm.title}
                    onChange={(e) => setResourceForm({ ...resourceForm, title: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Resource title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Author</label>
                  <input
                    type="text"
                    value={resourceForm.author}
                    onChange={(e) => setResourceForm({ ...resourceForm, author: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Author name (optional)"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
                <textarea
                  value={resourceForm.description}
                  onChange={(e) => setResourceForm({ ...resourceForm, description: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  placeholder="Brief description of the resource"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Content *</label>
                <textarea
                  value={resourceForm.content}
                  onChange={(e) => setResourceForm({ ...resourceForm, content: e.target.value })}
                  rows={10}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none font-mono text-sm"
                  placeholder="Full content of the resource (articles, tips, guide text, etc.)"
                />
              </div>

              {/* Type and Category */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Type *</label>
                  <select
                    value={resourceForm.type}
                    onChange={(e) => setResourceForm({ ...resourceForm, type: e.target.value as any })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="article">Article</option>
                    <option value="video">Video</option>
                    <option value="tip">Tip</option>
                    <option value="guide">Guide</option>
                    <option value="link">External Link</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
                  <select
                    value={resourceForm.category}
                    onChange={(e) => setResourceForm({ ...resourceForm, category: e.target.value as any })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="prevention">Prevention</option>
                    <option value="nutrition">Nutrition</option>
                    <option value="exercise">Exercise</option>
                    <option value="medication">Medication</option>
                    <option value="monitoring">Monitoring</option>
                    <option value="complications">Complications</option>
                    <option value="lifestyle">Lifestyle</option>
                    <option value="general">General</option>
                  </select>
                </div>
              </div>

              {/* URL and Thumbnail (for videos/links) */}
              {(resourceForm.type === 'video' || resourceForm.type === 'link') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {resourceForm.type === 'video' ? 'Video URL' : 'External Link URL'} *
                    </label>
                    <input
                      type="url"
                      value={resourceForm.url}
                      onChange={(e) => setResourceForm({ ...resourceForm, url: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder={resourceForm.type === 'video' ? 'https://youtube.com/...' : 'https://example.com'}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Thumbnail URL</label>
                    <input
                      type="url"
                      value={resourceForm.thumbnailUrl}
                      onChange={(e) => setResourceForm({ ...resourceForm, thumbnailUrl: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>
                </div>
              )}

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Add a tag and press Enter"
                  />
                  <button
                    onClick={handleAddTag}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                  >
                    Add
                  </button>
                </div>
                {resourceForm.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {resourceForm.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm"
                      >
                        {tag}
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="hover:text-purple-900"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Display Order</label>
                  <input
                    type="number"
                    value={resourceForm.order || ''}
                    onChange={(e) => setResourceForm({ ...resourceForm, order: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Lower numbers appear first"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={resourceForm.isPublished}
                      onChange={(e) => setResourceForm({ ...resourceForm, isPublished: e.target.checked })}
                      className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Publish immediately</span>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={() => {
                    setShowResourceModal(false);
                    setEditingResource(null);
                    setResourceForm({
                      title: '',
                      description: '',
                      content: '',
                      type: 'article',
                      category: 'general',
                      url: '',
                      thumbnailUrl: '',
                      author: '',
                      tags: [],
                      isPublished: true,
                      order: undefined,
                    });
                    setTagInput('');
                  }}
                  className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveResource}
                  className="flex-1 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {editingResource ? 'Update Resource' : 'Create Resource'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

