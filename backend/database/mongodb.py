# backend/database/mongodb.py
"""
MongoDB connection and CRUD operations
"""

from motor.motor_asyncio import AsyncClient, AsyncDatabase, AsyncCollection
from pymongo import ASCENDING, DESCENDING, IndexModel
from typing import List, Optional, Dict, Any
from datetime import datetime
import os

class MongoDBClient:
    """MongoDB client singleton"""
    _instance: Optional['MongoDBClient'] = None
    db: Optional[AsyncDatabase] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    async def connect(self):
        """Connect to MongoDB"""
        mongo_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
        db_name = os.getenv("MONGODB_DB", "yuki_trading")
        
        client = AsyncClient(mongo_uri)
        self.db = client[db_name]
        
        # Create indexes
        await self._create_indexes()
        print(f"✅ Connected to MongoDB: {db_name}")
    
    async def disconnect(self):
        """Disconnect from MongoDB"""
        if self.db:
            self.db.client.close()
            print("✅ Disconnected from MongoDB")
    
    async def _create_indexes(self):
        """Create all required indexes"""
        from database.schemas import COLLECTIONS
        
        for collection_name, config in COLLECTIONS.items():
            collection = self.db[collection_name]
            
            for index_fields in config.get("indexes", []):
                index_spec = [(field, ASCENDING if asc else DESCENDING) 
                             for field, asc in [(f, True) for f, _ in [index_fields]]]
                await collection.create_index(index_spec)
        
        print("✅ Database indexes created")
    
    def get_collection(self, name: str) -> AsyncCollection:
        """Get collection reference"""
        return self.db[name]


# Repository pattern - one per collection
class BaseRepository:
    """Base repository with common CRUD operations"""
    
    def __init__(self, collection_name: str):
        self.client = MongoDBClient()
        self.collection = self.client.get_collection(collection_name)
    
    async def create(self, doc: Dict[str, Any]) -> str:
        """Create document and return ID"""
        result = await self.collection.insert_one(doc)
        return str(result.inserted_id)
    
    async def find_by_id(self, doc_id: str) -> Optional[Dict]:
        """Find by document ID"""
        from bson import ObjectId
        return await self.collection.find_one({"_id": ObjectId(doc_id)})
    
    async def find_one(self, query: Dict) -> Optional[Dict]:
        """Find first matching document"""
        return await self.collection.find_one(query)
    
    async def find_many(self, query: Dict, skip: int = 0, limit: int = 100, 
                       sort: Optional[List] = None) -> List[Dict]:
        """Find multiple documents"""
        cursor = self.collection.find(query).skip(skip).limit(limit)
        if sort:
            cursor = cursor.sort(sort)
        return await cursor.to_list(None)
    
    async def update(self, doc_id: str, update_data: Dict) -> bool:
        """Update document by ID"""
        from bson import ObjectId
        update_data['updated_at'] = datetime.now()
        result = await self.collection.update_one(
            {"_id": ObjectId(doc_id)},
            {"$set": update_data}
        )
        return result.modified_count > 0
    
    async def delete(self, doc_id: str) -> bool:
        """Delete document by ID"""
        from bson import ObjectId
        result = await self.collection.delete_one({"_id": ObjectId(doc_id)})
        return result.deleted_count > 0
    
    async def count(self, query: Dict = None) -> int:
        """Count documents"""
        if query is None:
            query = {}
        return await self.collection.count_documents(query)


# ============================================================================
# SPECIALIZED REPOSITORIES
# ============================================================================

class UserRepository(BaseRepository):
    def __init__(self):
        super().__init__("users")
    
    async def find_by_username(self, username: str) -> Optional[Dict]:
        """Find user by username"""
        return await self.find_one({"username": username})
    
    async def find_by_email(self, email: str) -> Optional[Dict]:
        """Find user by email"""
        return await self.find_one({"email": email})
    
    async def find_by_wallet(self, wallet_address: str) -> Optional[Dict]:
        """Find user by wallet address"""
        return await self.find_one({"wallet_address": wallet_address})


class StrategyRepository(BaseRepository):
    def __init__(self):
        super().__init__("strategies")
    
    async def find_by_user(self, user_id: str, skip: int = 0, 
                          limit: int = 100) -> List[Dict]:
        """Get all strategies for user"""
        return await self.find_many(
            {"user_id": user_id, "deleted_at": None},
            skip=skip,
            limit=limit,
            sort=[("created_at", DESCENDING)]
        )
    
    async def find_live_strategies(self, user_id: str) -> List[Dict]:
        """Get live trading strategies"""
        return await self.find_many(
            {"user_id": user_id, "is_live": True, "deleted_at": None},
            sort=[("live_deployed_at", DESCENDING)]
        )
    
    async def find_by_status(self, status: str, limit: int = 50) -> List[Dict]:
        """Get strategies by status"""
        return await self.find_many(
            {"status": status, "deleted_at": None},
            limit=limit
        )
    
    async def update_backtest_results(self, strategy_id: str, 
                                     backtest_results: Dict) -> bool:
        """Update backtest results"""
        from bson import ObjectId
        return await self.collection.update_one(
            {"_id": ObjectId(strategy_id)},
            {
                "$set": {
                    "last_backtest": backtest_results,
                    "updated_at": datetime.now()
                },
                "$push": {"backtest_history": backtest_results}
            }
        ).modified_count > 0


class CandleRepository(BaseRepository):
    def __init__(self):
        super().__init__("candles")
    
    async def insert_many_candles(self, candles: List[Dict]) -> int:
        """Insert multiple candles (for data sync)"""
        if not candles:
            return 0
        result = await self.collection.insert_many(candles, ordered=False)
        return len(result.inserted_ids)
    
    async def get_ohlcv(self, chain: str, pair: str, timeframe: str,
                       start_ts: int, end_ts: int, limit: int = 1000) -> List[Dict]:
        """Get historical OHLCV data for backtesting"""
        return await self.find_many(
            {
                "chain": chain,
                "pair": pair,
                "timeframe": timeframe,
                "timestamp": {"$gte": start_ts, "$lte": end_ts}
            },
            limit=limit,
            sort=[("timestamp", ASCENDING)]
        )
    
    async def get_latest_candles(self, chain: str, pair: str, timeframe: str,
                                limit: int = 500) -> List[Dict]:
        """Get most recent candles"""
        return await self.find_many(
            {
                "chain": chain,
                "pair": pair,
                "timeframe": timeframe
            },
            limit=limit,
            sort=[("timestamp", DESCENDING)]
        )
    
    async def upsert_candle(self, chain: str, pair: str, timeframe: str, 
                           timestamp: int, ohlcv: Dict) -> bool:
        """Insert or update a single candle"""
        result = await self.collection.update_one(
            {
                "chain": chain,
                "pair": pair,
                "timeframe": timeframe,
                "timestamp": timestamp
            },
            {"$set": {**ohlcv, "synced_at": datetime.now()}},
            upsert=True
        )
        return result.upserted_id is not None or result.modified_count > 0


class SignalRepository(BaseRepository):
    def __init__(self):
        super().__init__("signals")
    
    async def create_signal(self, signal_data: Dict) -> str:
        """Create new signal"""
        signal_data['created_at'] = datetime.now()
        signal_data['updated_at'] = datetime.now()
        return await self.create(signal_data)
    
    async def find_by_strategy(self, strategy_id: str, skip: int = 0,
                              limit: int = 100) -> List[Dict]:
        """Get signals for strategy"""
        return await self.find_many(
            {"strategy_id": strategy_id},
            skip=skip,
            limit=limit,
            sort=[("created_at", DESCENDING)]
        )
    
    async def find_by_user(self, user_id: str, skip: int = 0,
                          limit: int = 100) -> List[Dict]:
        """Get signals for user"""
        return await self.find_many(
            {"user_id": user_id},
            skip=skip,
            limit=limit,
            sort=[("created_at", DESCENDING)]
        )
    
    async def find_pending_execution(self) -> List[Dict]:
        """Get signals pending execution (for webhook consumers)"""
        return await self.find_many(
            {"status": "broadcasted"},
            limit=100,
            sort=[("created_at", DESCENDING)]
        )
    
    async def mark_executed(self, signal_id: str, execution_details: Dict) -> bool:
        """Mark signal as executed"""
        from bson import ObjectId
        return await self.collection.update_one(
            {"_id": ObjectId(signal_id)},
            {
                "$set": {
                    "status": "executed",
                    "executed_at": datetime.now(),
                    "execution_details": execution_details,
                    "updated_at": datetime.now()
                }
            }
        ).modified_count > 0


class TradeRepository(BaseRepository):
    def __init__(self):
        super().__init__("trades")
    
    async def create_trade(self, trade_data: Dict) -> str:
        """Create new trade"""
        trade_data['created_at'] = datetime.now()
        return await self.create(trade_data)
    
    async def find_by_user(self, user_id: str, skip: int = 0,
                          limit: int = 100) -> List[Dict]:
        """Get trades for user"""
        return await self.find_many(
            {"user_id": user_id},
            skip=skip,
            limit=limit,
            sort=[("created_at", DESCENDING)]
        )
    
    async def find_by_strategy(self, strategy_id: str) -> List[Dict]:
        """Get trades for strategy"""
        return await self.find_many(
            {"strategy_id": strategy_id},
            sort=[("created_at", DESCENDING)]
        )
    
    async def get_open_trades(self, user_id: str) -> List[Dict]:
        """Get currently open trades"""
        return await self.find_many(
            {"user_id": user_id, "status": "open"}
        )
    
    async def close_trade(self, trade_id: str, exit_price: float,
                         exit_reason: str, gas_fee: float = 0) -> bool:
        """Close a trade"""
        from bson import ObjectId
        
        # Get the trade to calculate P&L
        trade = await self.find_by_id(trade_id)
        if not trade:
            return False
        
        entry_amount = trade['entry_amount']
        profit_loss_usd = (exit_price - trade['entry_price']) * entry_amount
        profit_loss_pct = ((exit_price - trade['entry_price']) / trade['entry_price']) * 100
        
        now = datetime.now()
        duration = (now - trade['entry_time']).total_seconds()
        
        return await self.collection.update_one(
            {"_id": ObjectId(trade_id)},
            {
                "$set": {
                    "exit_price": exit_price,
                    "exit_time": now,
                    "exit_reason": exit_reason,
                    "exit_gas_fee": gas_fee,
                    "profit_loss_usd": profit_loss_usd,
                    "profit_loss_pct": profit_loss_pct,
                    "duration_seconds": duration,
                    "status": "closed",
                    "closed_at": now
                }
            }
        ).modified_count > 0


class PortfolioRepository(BaseRepository):
    def __init__(self):
        super().__init__("portfolios")
    
    async def get_or_create(self, user_id: str) -> Dict:
        """Get portfolio or create if doesn't exist"""
        portfolio = await self.find_one({"user_id": user_id})
        
        if not portfolio:
            portfolio_data = {
                "user_id": user_id,
                "total_balance_usd": 0.0,
                "cash_balance_usd": 0.0,
                "positions_value_usd": 0.0,
                "unrealized_profit_loss_usd": 0.0,
                "realized_profit_loss_usd": 0.0,
                "total_profit_loss_usd": 0.0,
                "holdings": [],
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            }
            doc_id = await self.create(portfolio_data)
            portfolio = await self.find_by_id(doc_id)
        
        return portfolio
    
    async def update_holdings(self, user_id: str, holdings: List[Dict]) -> bool:
        """Update portfolio holdings"""
        # Calculate totals
        positions_value = sum(h['current_value_usd'] for h in holdings)
        unrealized_pl = sum(h['profit_loss_usd'] for h in holdings)
        
        return await self.collection.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "holdings": holdings,
                    "positions_value_usd": positions_value,
                    "unrealized_profit_loss_usd": unrealized_pl,
                    "total_balance_usd": positions_value,
                    "updated_at": datetime.now()
                }
            }
        ).modified_count > 0


# Global repository instances
users = UserRepository()
strategies = StrategyRepository()
candles = CandleRepository()
signals = SignalRepository()
trades = TradeRepository()
portfolios = PortfolioRepository()
