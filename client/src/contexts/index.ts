// Authentication Context
export {
  AuthProvider,
  AuthContext,
  useAuth,
  useIsAuthenticated,
  useAuthUser,
  useUserRole,
} from './auth-context';

export type { AuthUser, AuthContextType } from './auth-context';

// Navigation Context
export {
  NavigationProvider,
  NavigationContext,
  useNavigation,
  useIsAdmin,
  useCanAccess,
  useCurrentUser,
  ProtectedPage,
  MenuItemWrapper,
} from './navigation-context';

export type {
  User,
  UserRole,
  NavigationItem,
  PermissionSet,
  NavigationContextType,
} from './navigation-context';

// Trading Account Context
export {
  TradingAccountProvider,
  useTradingAccount,
  useHasConnectedExchanges,
  useExchange,
} from './trading-account-context';

export type {
  TradingAccountContextType,
  TradePosition,
  TradingOrder,
  ExchangeBalance,
  TradingMetrics,
  ConnectedExchange,
} from './trading-account-context';
