// Utility functions for formatting numbers and other values

export function formatNumber(value: number): string {
  if (typeof value !== 'number' || isNaN(value)) return '-';
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function formatDate(date: Date | string): string {
  if (typeof date === 'string') date = new Date(date);
  if (!(date instanceof Date) || isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}
export function formatCurrency(value: number, currency: string = 'USD'): string {
  if (typeof value !== 'number' || isNaN(value)) return '-';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}
export function formatPercentage(value: number): string {
  if (typeof value !== 'number' || isNaN(value)) return '-';
  return new Intl.NumberFormat(undefined, {
    style: 'percent',
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatAddress(address: string): string {
  if (typeof address !== 'string' || address.length < 10) return '-';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
export function formatPhoneNumber(phone: string): string {
  if (typeof phone !== 'string' || phone.length < 10) return '-';
  return phone.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
}   
export function formatTimeAgo(date: Date | string): string {
  if (typeof date === 'string') date = new Date(date);
  if (!(date instanceof Date) || isNaN(date.getTime())) return '-';
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (seconds < 60) return `${seconds} seconds ago`;
    if (minutes < 60) return `${minutes} minutes ago`;
    return `${hours} hours ago`;
}
export function formatFileSize(bytes: number): string {
    if (typeof bytes !== 'number' || isNaN(bytes) || bytes < 0) return '-';
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, i);
    return `${value.toFixed(2)} ${sizes[i]}`;
}
export function formatDuration(seconds: number): string {
    if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) return '-';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
}
export function formatPercentageChange(oldValue: number, newValue: number): string {
    if (typeof oldValue !== 'number' || typeof newValue !== 'number' || isNaN(oldValue) || isNaN(newValue)) return '-';
    if (oldValue === 0) return newValue > 0 ? '∞%' : '0%';
    const change = ((newValue - oldValue) / Math.abs(oldValue)) * 100;
    return `${change.toFixed(2)}%`;
}   
export function formatTime(date: Date | string): string {
    if (typeof date === 'string') date = new Date(date);
    if (!(date instanceof Date) || isNaN(date.getTime())) return '-';
    return date.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}
