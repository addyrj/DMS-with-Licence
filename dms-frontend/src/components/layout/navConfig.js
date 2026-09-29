// src/components/layout/navConfig.js
// Single source of truth for per-role nav items, shared by Sidebar.js (desktop)
// and MobileNav.js (mobile drawer) so the two can't drift out of sync.
import {
  LayoutDashboard, Users, Monitor, GitBranch, FolderOpen, Megaphone,
  FileVideo, Calendar, HardDrive, UserCircle, Bell, Activity,
} from 'lucide-react';

export const SA_NAV = [
  { href: '/dashboard',              label: 'Dashboard',        icon: LayoutDashboard },
  { href: '/clients',                label: 'Clients',          icon: Users },
  { href: '/notifications',          label: 'Notifications',    icon: Bell },
  { href: '/storage',                label: 'Storage',          icon: HardDrive },
];

export const CA_NAV = [
  { href: '/admin/dashboard',        label: 'Dashboard',        icon: LayoutDashboard },
  { href: '/admin/displays',         label: 'Displays',         icon: Monitor },
  { href: '/admin/production-lines', label: 'Production Lines', icon: GitBranch },
  { href: '/admin/media',            label: 'Media Bucket',     icon: FolderOpen },
  { href: '/admin/content',          label: 'Publish Content',  icon: FileVideo },
  { href: '/admin/announcements',    label: 'Announcements',    icon: Megaphone },
  { href: '/admin/activity',         label: 'Activity Log',     icon: Activity },
  { href: '/admin/users',            label: 'Users',            icon: Users },
  { href: '/admin/profile',          label: 'Profile',          icon: UserCircle },
];

export const EMP_NAV = [
  { href: '/employee/dashboard',     label: 'Dashboard',        icon: LayoutDashboard },
  { href: '/employee/displays',      label: 'Displays',         icon: Monitor },
  { href: '/employee/media-bucket',  label: 'Media Bucket',     icon: FolderOpen },
  { href: '/employee/publish',       label: 'Publish Content',  icon: FileVideo },
  { href: '/employee/announcements', label: 'Announcements',    icon: Megaphone },
];

export const navForRole = (role) =>
  role === 'SUPER_ADMIN' ? SA_NAV : role === 'CLIENT_ADMIN' ? CA_NAV : EMP_NAV;
