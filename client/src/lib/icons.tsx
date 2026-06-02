import React from 'react';
import * as LucideLib from 'lucide-react';

const IconFallback = (emoji: string) => (props: any) => (
  <span {...props} aria-hidden className="inline-block leading-none">
    {emoji}
  </span>
);

// Helper to pick from lucide or fallback
const pick = (name: string, emoji = '•') => (LucideLib as any)[name] || IconFallback(emoji);

export const Plus = pick('Plus', '+');
export const Send = pick('Send', '📨');
export const Download = pick('Download', '⬇️');
export const History = pick('History', '🕘');
export const DollarSign = pick('DollarSign', '$');
export const ArrowUpRight = pick('ArrowUpRight', '↗️');
export const ArrowDownLeft = pick('ArrowDownLeft', '↙️');
export const User = pick('User', '👤');
export const Wallet = pick('Wallet', '👛');
export const CreditCard = pick('CreditCard', '💳');
export const TrendingUp = pick('TrendingUp', '📈');
export const TrendingDown = pick('TrendingDown', '📉');
export const MessageCircle = pick('MessageCircle', '💬');
export const Shield = pick('Shield', '🛡️');
export const Zap = pick('Zap', '⚡');
export const Star = pick('Star', '★');
export const Crown = pick('Crown', '👑');
export const Sparkles = pick('Sparkles', '✨');
export const Eye = pick('Eye', '👁️');
export const EyeOff = pick('EyeOff', '🙈');
export const RefreshCw = pick('RefreshCw', '🔄');
export const AlertTriangle = pick('AlertTriangle', '⚠️');
export const Loader = (LucideLib as any).Loader || (LucideLib as any).Loader2 || IconFallback('⏳');
export const Loader2 = (LucideLib as any).Loader2 || (LucideLib as any).Loader || IconFallback('⏳');
export const Lock = pick('Lock', '🔒');
export const AlertCircle = pick('AlertCircle', '⚠️');
export const CheckCircle = pick('CheckCircle', '✔️');
export const Check = pick('Check', '✔️');
export const Phone = pick('Phone', '📞');
export const Mail = pick('Mail', '✉️');
export const UserPlus = pick('UserPlus', '➕');
export const SendIcon = pick('Send', '📨');
export const Copy = pick('Copy', '📋');
export const QrCode = pick('QrCode', '🔲');
export const Upload = pick('Upload', '⬆️');
export const Calendar = pick('Calendar', '📅');
export const Clock = pick('Clock', '🕒');
export const ChevronLeft = pick('ChevronLeft', '◀️');
export const ChevronRight = pick('ChevronRight', '▶️');
export const ArrowLeft = pick('ArrowLeft', '←');
export const ArrowRight = pick('ArrowRight', '→');
export const Filter = pick('Filter', '⚗️');
export const Search = pick('Search', '🔍');
export const Trash2 = pick('Trash2', '🗑️');
export const Trash = pick('Trash', '🗑️');
export const Edit2 = pick('Edit2', '✏️');
export const ExternalLink = pick('ExternalLink', '🔗');
export const Globe = pick('Globe', '🌐');
export const Heart = pick('Heart', '❤️');
export const Info = pick('Info', 'ℹ️');
export const MapPin = pick('MapPin', '📍');
export const Share2 = pick('Share2', '🔗');
export const Award = pick('Award', '🏆');
export const Target = pick('Target', '🎯');
export const Users = pick('Users', '👥');
export const Activity = pick('Activity', '⚙️');
export const PieChart = pick('PieChart', '📊');
export const ChevronDown = pick('ChevronDown', '▾');
export const ChevronUp = pick('ChevronUp', '▴');
export const X = pick('X', '✖️');
export const XCircle = pick('XCircle', '❌');
export const CheckCircle2 = pick('CheckCircle2', '✔️');
export const Circle = pick('Circle', '○');
export const Trophy = pick('Trophy', '🏆');
export const ArrowUpDown = pick('ArrowUpDown', '↕️');
export const ArrowDown = pick('ArrowDown', '↓');
export const ArrowUp = pick('ArrowUp', '↑');
export const LoaderCircle = pick('LoaderCircle', '⏳');
export const RotateCcw = pick('RotateCcw', '↺');
export const RotateCw = pick('RotateCw', '↻');
export const Unlock = pick('Unlock', '🔓');
export const PiggyBank = pick('PiggyBank', '🐷');
export const BarChart = pick('BarChart', '📊');
export const BarChart2 = pick('BarChart2', '📊');
export const BarChart3 = pick('BarChart3', '📊');
export const BookOpen = pick('BookOpen', '📖');
export const Link2 = pick('Link2', '🔗');
export const Box = pick('Box', '📦');
export const Vault = pick('Vault', '🏦');
export const ClockIcon = Clock;
export const Gift = pick('Gift', '🎁');
export const Vote = pick('Vote', '🗳️');
export const FileText = pick('FileText', '📄');

// Export lucide namespace as fallback
export const Lucide = LucideLib as any;

export default {
  Plus,
  Send,
  Download,
  History,
  DollarSign,
  ArrowUpRight,
  ArrowDownLeft,
  User,
  Wallet,
  CreditCard,
  TrendingUp,
  Shield,
  Zap,
  Star,
  Crown,
  Sparkles,
  Eye,
  EyeOff,
  RefreshCw,
  AlertTriangle,
  Loader,
  Loader2,
  Lock,
  AlertCircle,
  CheckCircle,
  Check,
  Phone,
  Mail,
  MessageCircle,
  UserPlus,
  Copy,
  QrCode,
  Upload,
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  Filter,
  Search,
  Trash2,
  Trash,
  Edit2,
  ExternalLink,
  Globe,
  Heart,
  MapPin,
  Share2,
  Award,
  Target,
  Users,
  Activity,
  PieChart,
  ChevronDown,
  ChevronUp,
  X,
  XCircle,
  CheckCircle2,
  Circle,
  Trophy,
  ArrowUpDown,
  ArrowDown,
  ArrowUp,
  LoaderCircle,
  RotateCcw,
  RotateCw,
  Unlock,
  PiggyBank,
  BarChart,
  BarChart2,
  BarChart3,
  BookOpen,
  Link2,
  Box,
  Vault,
  ClockIcon,
  Gift,
  Vote,
  FileText,
  Lucide,
};
