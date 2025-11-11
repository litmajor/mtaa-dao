#!/usr/bin/env python3
"""
REL-NEXUS Relay Agent - Advanced Message Routing & Communication Module
==================================================================

Full technical implementation with enterprise-grade features:
- Multi-protocol routing (TCP/UDP/WebSocket/MQTT)
- Advanced encryption with key rotation
- Intelligent load balancing and failover
- Priority queue management
- Dead letter handling with retry logic
- Network topology discovery and optimization
- Distributed cluster bridging
- Real-time monitoring and telemetry
"""

import asyncio
import json
import hashlib
import hmac
import time
import uuid
import logging
import struct
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any, Callable
from dataclasses import dataclass, asdict
from enum import Enum
from collections import defaultdict, deque
try:
    from agent_core_anatomy import AgentID
except ImportError:
    AgentID = str
import heapq
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
import socket
import ssl
import websockets
import aiohttp
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64
import os


# =============================================================================
# Core Data Structures and Enums
# =============================================================================

class MessagePriority(Enum):
    CRITICAL = 0    # Elder commands, emergency alerts
    HIGH = 1        # System operations, security events
    MEDIUM = 2      # Standard agent communications
    LOW = 3         # Housekeeping, telemetry
    BULK = 4        # Large data transfers

class MessageType(Enum):
    COMMAND = "CMD"
    RESPONSE = "RSP"
    ALERT = "ALT"
    HEARTBEAT = "HB"
    DATA_SYNC = "SYNC"
    HANDSHAKE = "HS"
    ACKNOWLEDGMENT = "ACK"

class NodeStatus(Enum):
    ACTIVE = "active"
    DEGRADED = "degraded"
    OFFLINE = "offline"
    MAINTENANCE = "maintenance"

class RoutingProtocol(Enum):
    TCP = "tcp"
    UDP = "udp"
    WEBSOCKET = "ws"
    MQTT = "mqtt"
    HTTP = "http"

@dataclass
class Message:
    id: str
    source_id: str  # or AgentID
    destination_id: str  # or AgentID
    msg_type: MessageType
    priority: MessagePriority
    payload: Dict[str, Any]
    timestamp: float
    ttl: int = 300  # Time to live in seconds
    retry_count: int = 0
    max_retries: int = 3
    route_history: Optional[List[str]] = None
    encryption_level: str = "AES256"
    checksum: str = ""

    def __post_init__(self):
        if self.route_history is None:
            self.route_history = []
        # Ensure all route_history entries are str
        self.route_history = [str(r) for r in self.route_history]
        self.source_id = str(self.source_id)
        self.destination_id = str(self.destination_id)
        if not self.checksum:
            self.generate_checksum()
    
    def generate_checksum(self):
        """Generate SHA-256 checksum for message integrity"""
        content = f"{self.source_id}{self.destination_id}{json.dumps(self.payload, sort_keys=True)}{self.timestamp}"
        self.checksum = hashlib.sha256(content.encode()).hexdigest()
    
    def is_expired(self) -> bool:
        return time.time() - self.timestamp > self.ttl
    
    def can_retry(self) -> bool:
        return self.retry_count < self.max_retries

@dataclass
class NetworkNode:
    node_id: str
    address: str
    port: int
    protocol: RoutingProtocol
    status: NodeStatus
    last_seen: float
    latency: float = 0.0
    bandwidth_utilization: float = 0.0
    cluster_id: str = ""
    capabilities: Optional[List[str]] = None
    
    def __post_init__(self):
        if self.capabilities is None:
            self.capabilities = []

@dataclass
class RoutingMetrics:
    messages_sent: int = 0
    messages_delivered: int = 0
    messages_failed: int = 0
    avg_latency: float = 0.0
    bandwidth_usage: float = 0.0
    active_connections: int = 0


# =============================================================================
# Advanced Encryption and Security Module
# =============================================================================

class AdvancedCrypto:
    def __init__(self):
        self.fernet_keys = {}  # Store per-node Fernet keys
        self.rsa_keys = self._generate_rsa_keypair()
        self.key_rotation_interval = 3600  # 1 hour
        self.last_rotation = time.time()
    
    def _generate_rsa_keypair(self):
        """Generate RSA key pair for secure key exchange"""
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048
        )
        public_key = private_key.public_key()
        return {"private": private_key, "public": public_key}
    
    def get_or_create_fernet_key(self, node_id: str) -> Fernet:
        """Get or create a Fernet key for a specific node"""
        if node_id not in self.fernet_keys:
            key = Fernet.generate_key()
            self.fernet_keys[node_id] = Fernet(key)
        return self.fernet_keys[node_id]
    
    def encrypt_message(self, message: str, node_id: str) -> bytes:
        """Encrypt message for specific node"""
        fernet = self.get_or_create_fernet_key(node_id)
        return fernet.encrypt(message.encode())
    
    def decrypt_message(self, encrypted_data: bytes, node_id: str) -> str:
        """Decrypt message from specific node"""
        fernet = self.get_or_create_fernet_key(node_id)
        return fernet.decrypt(encrypted_data).decode()
    
    def rotate_keys(self, force: bool = False):
        """Rotate encryption keys periodically"""
        if force or (time.time() - self.last_rotation) > self.key_rotation_interval:
            old_keys = self.fernet_keys.copy()
            self.fernet_keys.clear()
            self.last_rotation = time.time()
            logging.info(f"Rotated {len(old_keys)} encryption keys")
    
    def sign_message(self, message: str) -> bytes:
        """Sign message with private key"""
        signature = self.rsa_keys["private"].sign(
            message.encode(),
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.MAX_LENGTH
            ),
            hashes.SHA256()
        )
        return signature
    
    def verify_signature(self, message: str, signature: bytes, public_key) -> bool:
        """Verify message signature"""
        try:
            public_key.verify(
                signature,
                message.encode(),
                padding.PSS(
                    mgf=padding.MGF1(hashes.SHA256()),
                    salt_length=padding.PSS.MAX_LENGTH
                ),
                hashes.SHA256()
            )
            return True
        except Exception:
            return False


# =============================================================================
# Intelligent Routing Engine
# =============================================================================

class RoutingEngine:
    def __init__(self):
        self.routing_table: Dict[str, NetworkNode] = {}
        self.cluster_map: Dict[str, List[str]] = defaultdict(list)
        self.latency_history: Dict[str, deque] = defaultdict(lambda: deque(maxlen=100))
        self.bandwidth_history: Dict[str, deque] = defaultdict(lambda: deque(maxlen=100))
        
    def add_node(self, node: NetworkNode):
        """Add or update a network node"""
        self.routing_table[node.node_id] = node
        if node.cluster_id:
            self.cluster_map[node.cluster_id].append(node.node_id)
        logging.info(f"Added node {node.node_id} to routing table")
    
    def remove_node(self, node_id: str):
        """Remove node from routing table"""
        if node_id in self.routing_table:
            node = self.routing_table[node_id]
            del self.routing_table[node_id]
            if node.cluster_id and node_id in self.cluster_map[node.cluster_id]:
                self.cluster_map[node.cluster_id].remove(node_id)
            logging.info(f"Removed node {node_id} from routing table")
    
    def find_best_route(self, destination_id: str, exclude_nodes: Optional[List[str]] = None) -> Optional[NetworkNode]:
        """Find the best route to destination using intelligent algorithms"""
        if exclude_nodes is None:
            exclude_nodes = []
        
        # Direct route check
        if destination_id in self.routing_table and destination_id not in exclude_nodes:
            node = self.routing_table[destination_id]
            if node.status == NodeStatus.ACTIVE:
                return node
        
        # Find bridge nodes in same cluster
        target_cluster = self._find_node_cluster(destination_id)
        if target_cluster:
            bridge_candidates = [
                self.routing_table[node_id] 
                for node_id in self.cluster_map[target_cluster]
                if node_id not in exclude_nodes and 
                self.routing_table[node_id].status == NodeStatus.ACTIVE
            ]
            
            if bridge_candidates:
                # Select best bridge based on latency and bandwidth
                return min(bridge_candidates, 
                          key=lambda n: (n.latency, n.bandwidth_utilization))
        
        return None
    
    def _find_node_cluster(self, node_id: str) -> Optional[str]:
        """Find which cluster a node belongs to"""
        for cluster_id, nodes in self.cluster_map.items():
            if node_id in nodes:
                return cluster_id
        return None
    
    def update_node_metrics(self, node_id: str, latency: float, bandwidth: float):
        """Update node performance metrics"""
        if node_id in self.routing_table:
            self.routing_table[node_id].latency = latency
            self.routing_table[node_id].bandwidth_utilization = bandwidth
            self.latency_history[node_id].append(latency)
            self.bandwidth_history[node_id].append(bandwidth)
    
    def get_network_topology(self) -> Dict[str, Any]:
        """Get current network topology snapshot"""
        return {
            "nodes": {node_id: asdict(node) for node_id, node in self.routing_table.items()},
            "clusters": dict(self.cluster_map),
            "total_nodes": len(self.routing_table),
            "active_nodes": sum(1 for n in self.routing_table.values() if n.status == NodeStatus.ACTIVE)
        }


# =============================================================================
# Priority Queue Manager
# =============================================================================

class PriorityQueueManager:
    def __init__(self, max_size: int = 10000):
        self.queues = {priority: [] for priority in MessagePriority}
        self.max_size = max_size
        self.total_size = 0
        self.lock = threading.Lock()
    
    def enqueue(self, message: Message) -> bool:
        """Add message to appropriate priority queue"""
        with self.lock:
            if self.total_size >= self.max_size:
                # Drop lowest priority messages if queue is full
                self._drop_low_priority_messages()
            
            heapq.heappush(self.queues[message.priority], 
                          (message.timestamp, message.id, message))
            self.total_size += 1
            return True
    
    def dequeue(self) -> Optional[Message]:
        """Get highest priority message from queues"""
        with self.lock:
            for priority in MessagePriority:
                if self.queues[priority]:
                    _, _, message = heapq.heappop(self.queues[priority])
                    self.total_size -= 1
                    return message
            return None
    
    def peek(self, priority: Optional[MessagePriority] = None) -> Optional[Message]:
        """Peek at next message without removing it"""
        with self.lock:
            if priority:
                queue = self.queues[priority]
                return queue[0][2] if queue else None
            
            for priority in MessagePriority:
                if self.queues[priority]:
                    return self.queues[priority][0][2]
            return None
    
    def _drop_low_priority_messages(self):
        """Drop lowest priority messages when queue is full"""
        for priority in reversed(list(MessagePriority)):
            if self.queues[priority]:
                heapq.heappop(self.queues[priority])
                self.total_size -= 1
                logging.warning(f"Dropped {priority.name} priority message due to queue overflow")
                break
    
    def get_queue_stats(self) -> Dict[str, int]:
        """Get current queue statistics"""
        with self.lock:
            return {
                priority.name: len(queue) 
                for priority, queue in self.queues.items()
            }


# =============================================================================
# Dead Letter Handler
# =============================================================================

class DeadLetterHandler:
    def __init__(self, max_dead_letters: int = 1000):
        self.dead_letters: List[Tuple[Message, str, datetime]] = []
        self.max_dead_letters = max_dead_letters
        self.retry_schedule = {}
        self.lock = threading.Lock()
    
    def add_dead_letter(self, message: Message, failure_reason: str):
        """Add message to dead letter queue"""
        with self.lock:
            if len(self.dead_letters) >= self.max_dead_letters:
                # Remove oldest dead letter
                self.dead_letters.pop(0)
            
            self.dead_letters.append((message, failure_reason, datetime.now()))
            
            # Schedule retry if message can be retried
            if message.can_retry():
                retry_delay = min(2 ** message.retry_count, 300)  # Exponential backoff, max 5 minutes
                retry_time = time.time() + retry_delay
                self.retry_schedule[message.id] = retry_time
            
            logging.warning(f"Added message {message.id} to dead letter queue: {failure_reason}")
    
    def get_retryable_messages(self) -> List[Message]:
        """Get messages ready for retry"""
        current_time = time.time()
        retryable = []
        
        with self.lock:
            for message_id, retry_time in list(self.retry_schedule.items()):
                if current_time >= retry_time:
                    # Find the message in dead letters
                    for i, (message, reason, timestamp) in enumerate(self.dead_letters):
                        if message.id == message_id:
                            message.retry_count += 1
                            retryable.append(message)
                            # Remove from dead letters and retry schedule
                            self.dead_letters.pop(i)
                            del self.retry_schedule[message_id]
                            break
        
        return retryable
    
    def get_dead_letter_stats(self) -> Dict[str, Any]:
        """Get dead letter statistics"""
        with self.lock:
            reasons = defaultdict(int)
            for _, reason, _ in self.dead_letters:
                reasons[reason] += 1
            
            return {
                "total_dead_letters": len(self.dead_letters),
                "scheduled_retries": len(self.retry_schedule),
                "failure_reasons": dict(reasons)
            }


# =============================================================================
# Protocol Handlers
# =============================================================================

class ProtocolHandler:
    """Base class for protocol-specific handlers"""
    
    async def send_message(self, node: NetworkNode, message: Message) -> bool:
        raise NotImplementedError
    
    async def receive_message(self) -> Optional[Message]:
        raise NotImplementedError

class TCPHandler(ProtocolHandler):
    def __init__(self, crypto: AdvancedCrypto):
        self.crypto = crypto
        self.connections = {}
    
    async def send_message(self, node: NetworkNode, message: Message) -> bool:
        try:
            # Establish connection if not exists
            if node.node_id not in self.connections:
                reader, writer = await asyncio.open_connection(node.address, node.port)
                self.connections[node.node_id] = (reader, writer)
            
            reader, writer = self.connections[node.node_id]
            
            # Encrypt and send message
            message_data = json.dumps(asdict(message))
            encrypted_data = self.crypto.encrypt_message(message_data, node.node_id)
            
            # Send message length first, then message
            writer.write(struct.pack('!I', len(encrypted_data)))
            writer.write(encrypted_data)
            await writer.drain()
            
            return True
        except Exception as e:
            logging.error(f"TCP send failed to {node.node_id}: {e}")
            # Clean up failed connection
            if node.node_id in self.connections:
                del self.connections[node.node_id]
            return False

class WebSocketHandler(ProtocolHandler):
    def __init__(self, crypto: AdvancedCrypto):
        self.crypto = crypto
        self.connections = {}
    
    async def send_message(self, node: NetworkNode, message: Message) -> bool:
        try:
            uri = f"ws://{node.address}:{node.port}"
            
            # Reuse connection if available
            if node.node_id not in self.connections:
                websocket = await websockets.connect(uri)
                self.connections[node.node_id] = websocket
            
            websocket = self.connections[node.node_id]
            
            # Encrypt and send message
            message_data = json.dumps(asdict(message))
            encrypted_data = self.crypto.encrypt_message(message_data, node.node_id)
            
            await websocket.send(encrypted_data)
            return True
        except Exception as e:
            logging.error(f"WebSocket send failed to {node.node_id}: {e}")
            if node.node_id in self.connections:
                del self.connections[node.node_id]
            return False

class HTTPHandler(ProtocolHandler):
    def __init__(self, crypto: AdvancedCrypto):
        self.crypto = crypto
        self.session = None
    
    async def _get_session(self):
        if self.session is None:
            self.session = aiohttp.ClientSession()
        return self.session
    
    async def send_message(self, node: NetworkNode, message: Message) -> bool:
        try:
            session = await self._get_session()
            url = f"http://{node.address}:{node.port}/relay"
            
            # Encrypt message
            message_data = json.dumps(asdict(message))
            encrypted_data = self.crypto.encrypt_message(message_data, node.node_id)
            
            async with session.post(url, data=encrypted_data) as response:
                return response.status == 200
        except Exception as e:
            logging.error(f"HTTP send failed to {node.node_id}: {e}")
            return False


# =============================================================================
# Main Relay Agent Implementation
# =============================================================================

class RelayAgent:
    def __init__(self, agent_id: str, cluster_id: str = "", config: Optional[Dict[str, Any]] = None):
        # Use canonical AgentID type if available
        if AgentID is not str and callable(AgentID):
            if not isinstance(agent_id, AgentID):
                self.agent_id = AgentID(f"REL-NEXUS-{str(agent_id)}")
            else:
                self.agent_id = agent_id
        else:
            self.agent_id = f"REL-NEXUS-{agent_id}"
        self.cluster_id = cluster_id
        self.config = config or {}
        
        # Core components
        self.crypto = AdvancedCrypto()
        self.routing_engine = RoutingEngine()
        self.queue_manager = PriorityQueueManager()
        self.dead_letter_handler = DeadLetterHandler()
        
        # Protocol handlers
        self.protocol_handlers = {
            RoutingProtocol.TCP: TCPHandler(self.crypto),
            RoutingProtocol.WEBSOCKET: WebSocketHandler(self.crypto),
            RoutingProtocol.HTTP: HTTPHandler(self.crypto)
        }
        
        # State management
        self.is_running = False
        self.metrics = RoutingMetrics()
        self.event_callbacks: Dict[str, List[Callable]] = defaultdict(list)
        
        # Background tasks
        self.executor = ThreadPoolExecutor(max_workers=10)
        self.background_tasks = []
        
        # Setup logging
        logging.basicConfig(
            level=logging.INFO,
            format=f'[{self.agent_id}] %(asctime)s - %(levelname)s - %(message)s'
        )
        
        logging.info(f"Relay Agent {self.agent_id} initialized")
    
    async def start(self):
        """Start the relay agent and all background services"""
        if self.is_running:
            return
        
        self.is_running = True
        logging.info(f"Starting Relay Agent {self.agent_id}")
        
        # Start background tasks
        self.background_tasks = [
            asyncio.create_task(self._message_processing_loop()),
            asyncio.create_task(self._heartbeat_loop()),
            asyncio.create_task(self._dead_letter_retry_loop()),
            asyncio.create_task(self._metrics_collection_loop()),
            asyncio.create_task(self._key_rotation_loop())
        ]
        
        logging.info("All background services started")
    
    async def stop(self):
        """Stop the relay agent and cleanup resources"""
        if not self.is_running:
            return
        
        self.is_running = False
        logging.info("Stopping Relay Agent")
        
        # Cancel background tasks
        for task in self.background_tasks:
            task.cancel()
        
        # Wait for tasks to complete
        await asyncio.gather(*self.background_tasks, return_exceptions=True)
        
        # Cleanup resources
        self.executor.shutdown(wait=True)
        
        # Close protocol handler connections
        for handler in self.protocol_handlers.values():
            if hasattr(handler, 'connections'):
                for conn in handler.connections.values():
                    if hasattr(conn, 'close'):
                        await conn.close()
        
        logging.info("Relay Agent stopped")
    
    def register_node(self, node: NetworkNode):
        """Register a new node in the network"""
        self.routing_engine.add_node(node)
        self._emit_event('node_registered', {'node_id': node.node_id})
    
    def unregister_node(self, node_id: str):
        """Unregister a node from the network"""
        self.routing_engine.remove_node(node_id)
        self._emit_event('node_unregistered', {'node_id': node_id})
    
    async def send_message(self, message: Message) -> bool:
        """Send a message through the relay network"""
        # Validate message
        if message.is_expired():
            logging.warning(f"Message {message.id} expired, not sending")
            return False
        
        # Add to routing history
        if message.route_history is None:
            message.route_history = []
        message.route_history.append(str(self.agent_id))
        
        # Enqueue message
        if self.queue_manager.enqueue(message):
            self.metrics.messages_sent += 1
            self._emit_event('message_queued', {'message_id': message.id})
            return True
        else:
            logging.error(f"Failed to enqueue message {message.id}")
            return False
    
    async def broadcast_message(self, message: Message, cluster_id: Optional[str] = None) -> int:
        """Broadcast message to all nodes in cluster or network"""
        sent_count = 0
        target_nodes = []
        
        if cluster_id:
            # Broadcast to specific cluster
            if cluster_id in self.routing_engine.cluster_map:
                target_nodes = [
                    self.routing_engine.routing_table[node_id]
                    for node_id in self.routing_engine.cluster_map[cluster_id]
                    if self.routing_engine.routing_table[node_id].status == NodeStatus.ACTIVE
                ]
        else:
            # Broadcast to all active nodes
            target_nodes = [
                node for node in self.routing_engine.routing_table.values()
                if node.status == NodeStatus.ACTIVE
            ]
        
        # Send to all target nodes
        for node in target_nodes:
            broadcast_msg = Message(
                id=f"{message.id}-broadcast-{node.node_id}",
                source_id=message.source_id,
                destination_id=node.node_id,
                msg_type=message.msg_type,
                priority=message.priority,
                payload=message.payload,
                timestamp=time.time()
            )
            
            if await self.send_message(broadcast_msg):
                sent_count += 1
        
        logging.info(f"Broadcast message sent to {sent_count}/{len(target_nodes)} nodes")
        return sent_count
    
    async def _message_processing_loop(self):
        """Main message processing loop"""
        while self.is_running:
            try:
                message = self.queue_manager.dequeue()
                if message:
                    await self._process_message(message)
                else:
                    await asyncio.sleep(0.01)  # Small delay when no messages
            except Exception as e:
                logging.error(f"Error in message processing loop: {e}")
    
    async def _process_message(self, message: Message):
        """Process a single message"""
        start_time = time.time()
        
        try:
            # Find best route to destination
            route = self.routing_engine.find_best_route(
                message.destination_id, 
                exclude_nodes=message.route_history or []
            )
            
            if not route:
                self.dead_letter_handler.add_dead_letter(
                    message, f"No route found to {message.destination_id}"
                )
                self.metrics.messages_failed += 1
                return
            
            # Get appropriate protocol handler
            handler = self.protocol_handlers.get(route.protocol)
            if not handler:
                self.dead_letter_handler.add_dead_letter(
                    message, f"No handler for protocol {route.protocol}"
                )
                self.metrics.messages_failed += 1
                return
            
            # Send message
            success = await handler.send_message(route, message)
            
            if success:
                self.metrics.messages_delivered += 1
                latency = time.time() - start_time
                self.routing_engine.update_node_metrics(
                    route.node_id, latency, route.bandwidth_utilization
                )
                self._emit_event('message_delivered', {
                    'message_id': message.id,
                    'destination': message.destination_id,
                    'latency': latency
                })
            else:
                self.dead_letter_handler.add_dead_letter(
                    message, f"Failed to send via {route.protocol}"
                )
                self.metrics.messages_failed += 1
        
        except Exception as e:
            self.dead_letter_handler.add_dead_letter(message, str(e))
            self.metrics.messages_failed += 1
            logging.error(f"Error processing message {message.id}: {e}")
    
    async def _heartbeat_loop(self):
        """Send periodic heartbeats to maintain node status"""
        while self.is_running:
            try:
                heartbeat_msg = Message(
                    id=str(uuid.uuid4()),
                    source_id=str(self.agent_id),
                    destination_id="BROADCAST",
                    msg_type=MessageType.HEARTBEAT,
                    priority=MessagePriority.LOW,
                    payload={
                        "timestamp": time.time(),
                        "cluster_id": self.cluster_id,
                        "status": "active",
                        "metrics": asdict(self.metrics)
                    },
                    timestamp=time.time()
                )
                
                await self.broadcast_message(heartbeat_msg, self.cluster_id)
                await asyncio.sleep(30)  # Heartbeat every 30 seconds
            except Exception as e:
                logging.error(f"Error in heartbeat loop: {e}")
    
    async def _dead_letter_retry_loop(self):
        """Retry failed messages from dead letter queue"""
        while self.is_running:
            try:
                retryable_messages = self.dead_letter_handler.get_retryable_messages()
                for message in retryable_messages:
                    await self.send_message(message)
                
                await asyncio.sleep(10)  # Check every 10 seconds
            except Exception as e:
                logging.error(f"Error in dead letter retry loop: {e}")
    
    async def _metrics_collection_loop(self):
        """Collect and update performance metrics"""
        while self.is_running:
            try:
                # Update average latency
                total_latency = 0
                node_count = 0
                for node in self.routing_engine.routing_table.values():
                    if node.status == NodeStatus.ACTIVE:
                        total_latency += node.latency
                        node_count += 1
                
                if node_count > 0:
                    self.metrics.avg_latency = total_latency / node_count
                
                self.metrics.active_connections = node_count
                
                await asyncio.sleep(60)  # Update every minute
            except Exception as e:
                logging.error(f"Error in metrics collection loop: {e}")
    
    async def _key_rotation_loop(self):
        """Periodic encryption key rotation"""
        while self.is_running:
            try:
                self.crypto.rotate_keys()
                await asyncio.sleep(3600)  # Rotate every hour
            except Exception as e:
                logging.error(f"Error in key rotation loop: {e}")
    
    def _emit_event(self, event_type: str, data: Dict[str, Any]):
        """Emit event to registered callbacks"""
        for callback in self.event_callbacks.get(event_type, []):
            try:
                callback(data)
            except Exception as e:
                logging.error(f"Error in event callback for {event_type}: {e}")
    
    def register_event_callback(self, event_type: str, callback: Callable):
        """Register callback for specific event type"""
        self.event_callbacks[event_type].append(callback)
    
    def get_status(self) -> Dict[str, Any]:
        """Get comprehensive status of the relay agent"""
        return {
            "agent_id": self.agent_id,
            "cluster_id": self.cluster_id,
            "is_running": self.is_running,
            "metrics": asdict(self.metrics),
            "queue_stats": self.queue_manager.get_queue_stats(),
            "dead_letter_stats": self.dead_letter_handler.get_dead_letter_stats(),
            "routing_table": self.routing_engine.get_network_topology(),
            "protocol_handlers": {
                protocol.name: len(getattr(handler, 'connections', {}))
                for protocol, handler in self.protocol_handlers.items()
            }
        }
    

    def get_performance_report(self) -> Dict[str, Any]:
        """Generate detailed performance report"""
        total_messages = (
            self.metrics.messages_sent +
            self.metrics.messages_delivered +
            self.metrics.messages_failed
        )
        success_rate = (
            self.metrics.messages_delivered / total_messages * 100
            if total_messages > 0 else 0
        )
        return {
            "performance_summary": {
                "total_messages_processed": total_messages,
                "success_rate_percent": round(success_rate, 2),
                "average_latency_ms": round(self.metrics.avg_latency * 1000, 2),
                "active_connections": self.metrics.active_connections,
                "bandwidth_utilization": self.metrics.bandwidth_usage
            },
            "queue_analysis": self.queue_manager.get_queue_stats(),
            "failure_analysis": self.dead_letter_handler.get_dead_letter_stats(),
            "network_health": {
                "total_nodes": len(self.routing_engine.routing_table),
                "active_nodes": sum(1 for n in self.routing_engine.routing_table.values()
                                     if n.status == NodeStatus.ACTIVE),
                "degraded_nodes": sum(1 for n in self.routing_engine.routing_table.values()
                                       if n.status == NodeStatus.DEGRADED),
                "offline_nodes": sum(1 for n in self.routing_engine.routing_table.values()
                                      if n.status == NodeStatus.OFFLINE)
            }
        }


# =============================================================================
# Network Discovery and Auto-Configuration
# =============================================================================

class NetworkDiscovery:
    """Automatic network topology discovery and configuration"""
    
    def __init__(self, relay_agent: RelayAgent):
        self.relay_agent = relay_agent
        self.discovery_interval = 60  # Discovery scan every minute
        self.multicast_group = '224.1.1.1'
        self.multicast_port = 12345
        
    async def start_discovery(self):
        """Start network discovery service"""
        discovery_tasks = [
            asyncio.create_task(self._multicast_discovery()),
            asyncio.create_task(self._subnet_scan()),
            asyncio.create_task(self._beacon_listener())
        ]
        
        await asyncio.gather(*discovery_tasks, return_exceptions=True)
    
    async def _multicast_discovery(self):
        """Discover nodes using multicast announcements"""
        while self.relay_agent.is_running:
            try:
                # Send discovery beacon
                beacon_data = {
                    "agent_id": self.relay_agent.agent_id,
                    "cluster_id": self.relay_agent.cluster_id,
                    "timestamp": time.time(),
                    "capabilities": ["relay", "bridge", "encrypt"],
                    "protocols": ["tcp", "websocket", "http"]
                }
                
                sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                sock.sendto(json.dumps(beacon_data).encode(), 
                           (self.multicast_group, self.multicast_port))
                sock.close()
                
                await asyncio.sleep(self.discovery_interval)
            except Exception as e:
                logging.error(f"Multicast discovery error: {e}")
    
    async def _subnet_scan(self):
        """Scan local subnet for relay agents"""
        import ipaddress
        import subprocess
        
        while self.relay_agent.is_running:
            try:
                # Get local network range
                hostname = socket.gethostname()
                local_ip = socket.gethostbyname(hostname)
                network = ipaddress.IPv4Network(f"{local_ip}/24", strict=False)
                
                # Scan common relay ports
                common_ports = [8080, 8081, 9090, 9091]
                
                for ip in network.hosts():
                    for port in common_ports:
                        try:
                            # Quick connection test
                            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                            sock.settimeout(1)
                            result = sock.connect_ex((str(ip), port))
                            
                            if result == 0:
                                # Potential relay node found
                                await self._probe_node(str(ip), port)
                            
                            sock.close()
                        except:
                            pass
                
                await asyncio.sleep(300)  # Subnet scan every 5 minutes
            except Exception as e:
                logging.error(f"Subnet scan error: {e}")
    
    async def _beacon_listener(self):
        """Listen for discovery beacons from other nodes"""
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        
        # Join multicast group
        mreq = struct.pack("4sl", socket.inet_aton(self.multicast_group), 
                          socket.INADDR_ANY)
        sock.setsockopt(socket.IPPROTO_IP, socket.IP_ADD_MEMBERSHIP, mreq)
        sock.bind(('', self.multicast_port))
        sock.settimeout(1)
        
        while self.relay_agent.is_running:
            try:
                data, addr = sock.recvfrom(1024)
                beacon_info = json.loads(data.decode())
                
                # Don't process our own beacons
                if beacon_info.get('agent_id') != self.relay_agent.agent_id:
                    await self._process_discovered_node(beacon_info, addr[0])
            except socket.timeout:
                continue
            except Exception as e:
                logging.error(f"Beacon listener error: {e}")
        
        sock.close()
    
    async def _probe_node(self, ip: str, port: int):
        """Probe a potential node for relay capabilities"""
        try:
            # Send identification request
            probe_data = {
                "type": "identification_request",
                "requester": self.relay_agent.agent_id,
                "timestamp": time.time()
            }
            
            # Try HTTP first
            async with aiohttp.ClientSession() as session:
                timeout = aiohttp.ClientTimeout(total=5)
                async with session.post(f"http://{ip}:{port}/identify", 
                                      json=probe_data, timeout=timeout) as response:
                    if response.status == 200:
                        node_info = await response.json()
                        await self._process_discovered_node(node_info, ip)
        except:
            pass  # Node doesn't support HTTP identification
    
    async def _process_discovered_node(self, node_info: Dict[str, Any], ip: str):
        """Process a discovered node and add to routing table"""
        try:
            node_id = node_info.get('agent_id')
            if not node_id or node_id == self.relay_agent.agent_id:
                return
            
            # Determine best protocol
            supported_protocols = node_info.get('protocols', ['tcp'])
            protocol = RoutingProtocol.TCP  # Default
            
            if 'websocket' in supported_protocols:
                protocol = RoutingProtocol.WEBSOCKET
            elif 'http' in supported_protocols:
                protocol = RoutingProtocol.HTTP
            
            # Create network node
            node = NetworkNode(
                node_id=node_id,
                address=ip,
                port=node_info.get('port', 8080),
                protocol=protocol,
                status=NodeStatus.ACTIVE,
                last_seen=time.time(),
                cluster_id=node_info.get('cluster_id', ''),
                capabilities=node_info.get('capabilities', [])
            )
            
            # Register node
            self.relay_agent.register_node(node)
            logging.info(f"Discovered and registered node: {node_id} at {ip}")
            
        except Exception as e:
            logging.error(f"Error processing discovered node: {e}")


# =============================================================================
# Advanced Message Filters and Transformers
# =============================================================================

class MessageFilter:
    """Base class for message filters"""
    
    def should_process(self, message: Message) -> bool:
        raise NotImplementedError
    
    def transform(self, message: Message) -> Message:
        return message

class PriorityBoostFilter(MessageFilter):
    """Boost priority for messages from specific sources"""
    
    def __init__(self, boost_sources: List[str], target_priority: MessagePriority):
        self.boost_sources = boost_sources
        self.target_priority = target_priority
    
    def should_process(self, message: Message) -> bool:
        return message.source_id in self.boost_sources
    
    def transform(self, message: Message) -> Message:
        message.priority = self.target_priority
        return message

class SecurityFilter(MessageFilter):
    """Filter messages based on security policies"""
    
    def __init__(self, blocked_sources: List[str], required_encryption: str = "AES256"):
        self.blocked_sources = blocked_sources
        self.required_encryption = required_encryption
    
    def should_process(self, message: Message) -> bool:
        # Block messages from blacklisted sources
        if message.source_id in self.blocked_sources:
            return False
        
        # Require minimum encryption level
        if message.encryption_level != self.required_encryption:
            return False
        
        return True

class RateLimitFilter(MessageFilter):
    """Rate limiting filter to prevent message flooding"""
    
    def __init__(self, max_messages_per_minute: int = 100):
        self.max_messages_per_minute = max_messages_per_minute
        self.message_timestamps: Dict[str, deque] = defaultdict(lambda: deque(maxlen=max_messages_per_minute))
    
    def should_process(self, message: Message) -> bool:
        current_time = time.time()
        source_timestamps = self.message_timestamps[message.source_id]
        
        # Remove timestamps older than 1 minute
        while source_timestamps and (current_time - source_timestamps[0]) > 60:
            source_timestamps.popleft()
        
        # Check if under rate limit
        if len(source_timestamps) >= self.max_messages_per_minute:
            logging.warning(f"Rate limit exceeded for source {message.source_id}")
            return False
        
        source_timestamps.append(current_time)
        return True

class MessageProcessor:
    """Manages message filters and transformations"""
    
    def __init__(self):
        self.filters: List[MessageFilter] = []
    
    def add_filter(self, filter_instance: MessageFilter):
        """Add a message filter"""
        self.filters.append(filter_instance)
    
    def process_message(self, message: Message) -> Optional[Message]:
        """Process message through all filters"""
        for filter_instance in self.filters:
            if not filter_instance.should_process(message):
                return None  # Message filtered out
            message = filter_instance.transform(message)
        
        return message


# =============================================================================
# Cluster Management and Bridge Operations
# =============================================================================

class ClusterBridge:
    """Manages inter-cluster communication and bridging"""
    
    def __init__(self, relay_agent: RelayAgent):
        self.relay_agent = relay_agent
        self.bridge_connections: Dict[str, NetworkNode] = {}
        self.cluster_routing_table: Dict[str, List[str]] = defaultdict(list)
        self.bridge_metrics: Dict[str, Dict[str, int]] = defaultdict(lambda: {
            "messages_bridged": 0,
            "bridge_latency": 0,
            "connection_failures": 0
        })
    
    def establish_bridge(self, target_cluster: str, bridge_node: NetworkNode):
        """Establish bridge to another cluster"""
        self.bridge_connections[target_cluster] = bridge_node
        self.cluster_routing_table[target_cluster].append(bridge_node.node_id)
        logging.info(f"Established bridge to cluster {target_cluster} via {bridge_node.node_id}")
    
    def remove_bridge(self, target_cluster: str):
        """Remove bridge to cluster"""
        if target_cluster in self.bridge_connections:
            del self.bridge_connections[target_cluster]
            del self.cluster_routing_table[target_cluster]
            logging.info(f"Removed bridge to cluster {target_cluster}")
    
    async def bridge_message(self, message: Message, target_cluster: str) -> bool:
        """Bridge message to another cluster"""
        if target_cluster not in self.bridge_connections:
            logging.warning(f"No bridge available to cluster {target_cluster}")
            return False
        
        bridge_node = self.bridge_connections[target_cluster]
        start_time = time.time()
        
        try:
            # Create bridge message with special routing
            bridge_msg = Message(
                id=f"BRIDGE-{message.id}",
                source_id=message.source_id,
                destination_id=message.destination_id,
                msg_type=message.msg_type,
                priority=message.priority,
                payload={
                    **message.payload,
                    "bridge_info": {
                        "origin_cluster": self.relay_agent.cluster_id,
                        "target_cluster": target_cluster,
                        "bridge_timestamp": time.time()
                    }
                },
                timestamp=time.time()
            )
            
            # Send through bridge
            success = await self.relay_agent.send_message(bridge_msg)
            
            # Update metrics
            if success:
                self.bridge_metrics[target_cluster]["messages_bridged"] += 1
                self.bridge_metrics[target_cluster]["bridge_latency"] = int(time.time() - start_time)
            else:
                self.bridge_metrics[target_cluster]["connection_failures"] += 1
            
            return success
            
        except Exception as e:
            logging.error(f"Bridge operation failed: {e}")
            self.bridge_metrics[target_cluster]["connection_failures"] += 1
            return False
    
    def get_bridge_status(self) -> Dict[str, Any]:
        """Get status of all cluster bridges"""
        return {
            "active_bridges": list(self.bridge_connections.keys()),
            "bridge_metrics": dict(self.bridge_metrics),
            "cluster_routing": dict(self.cluster_routing_table)
        }


# =============================================================================
# Health Monitoring and Diagnostics
# =============================================================================

class HealthMonitor:
    """Comprehensive health monitoring for relay agent"""
    
    def __init__(self, relay_agent: RelayAgent):
        self.relay_agent = relay_agent
        self.health_checks: Dict[str, Callable] = {}
        self.health_history: deque = deque(maxlen=1000)
        self.alert_thresholds = {
            "message_failure_rate": 0.1,  # 10% failure rate
            "average_latency": 5.0,       # 5 second latency
            "queue_size": 8000,           # 80% of max queue size
            "dead_letter_count": 100      # 100 dead letters
        }
    
    def register_health_check(self, name: str, check_function: Callable):
        """Register a custom health check"""
        self.health_checks[name] = check_function
    
    async def run_health_checks(self) -> Dict[str, Any]:
        """Run all health checks and return status"""
        health_status = {
            "timestamp": time.time(),
            "overall_status": "healthy",
            "checks": {},
            "alerts": []
        }
        
        # Built-in health checks
        health_status["checks"].update(await self._check_message_flow())
        health_status["checks"].update(await self._check_network_connectivity())
        health_status["checks"].update(await self._check_resource_usage())
        health_status["checks"].update(await self._check_queue_health())
        
        # Custom health checks
        for name, check_func in self.health_checks.items():
            try:
                result = await check_func()
                health_status["checks"][name] = result
            except Exception as e:
                health_status["checks"][name] = {
                    "status": "error",
                    "message": str(e)
                }
        
        # Evaluate overall health
        failed_checks = [name for name, check in health_status["checks"].items() 
                        if check.get("status") != "healthy"]
        
        if failed_checks:
            health_status["overall_status"] = "degraded" if len(failed_checks) <= 2 else "unhealthy"
            health_status["alerts"] = [f"Failed health check: {name}" for name in failed_checks]
        
        # Store in history
        self.health_history.append(health_status)
        
        return health_status
    
    async def _check_message_flow(self) -> Dict[str, Dict[str, Any]]:
        """Check message processing health"""
        metrics = self.relay_agent.metrics
        total_messages = metrics.messages_sent + metrics.messages_delivered + metrics.messages_failed
        
        failure_rate = (metrics.messages_failed / total_messages 
                       if total_messages > 0 else 0)
        
        return {
            "message_flow": {
                "status": "healthy" if failure_rate < self.alert_thresholds["message_failure_rate"] else "unhealthy",
                "failure_rate": failure_rate,
                "total_processed": total_messages,
                "throughput_per_minute": total_messages / max(1, (time.time() - 0) / 60)  # Simplified
            }
        }
    
    async def _check_network_connectivity(self) -> Dict[str, Dict[str, Any]]:
        """Check network node connectivity"""
        active_nodes = sum(1 for n in self.relay_agent.routing_engine.routing_table.values() 
                          if n.status == NodeStatus.ACTIVE)
        total_nodes = len(self.relay_agent.routing_engine.routing_table)
        
        connectivity_ratio = active_nodes / max(1, total_nodes)
        
        return {
            "network_connectivity": {
                "status": "healthy" if connectivity_ratio > 0.8 else "degraded",
                "active_nodes": active_nodes,
                "total_nodes": total_nodes,
                "connectivity_ratio": connectivity_ratio
            }
        }
    
    async def _check_resource_usage(self) -> Dict[str, Dict[str, Any]]:
        """Check system resource usage"""
        import psutil
        
        cpu_percent = psutil.cpu_percent(interval=1)
        memory_percent = psutil.virtual_memory().percent
        
        return {
            "resource_usage": {
                "status": "healthy" if cpu_percent < 80 and memory_percent < 80 else "degraded",
                "cpu_percent": cpu_percent,
                "memory_percent": memory_percent
            }
        }
    
    async def _check_queue_health(self) -> Dict[str, Dict[str, Any]]:
        """Check message queue health"""
        queue_stats = self.relay_agent.queue_manager.get_queue_stats()
        total_queued = sum(queue_stats.values())
        
        dead_letter_stats = self.relay_agent.dead_letter_handler.get_dead_letter_stats()
        dead_letter_count = dead_letter_stats["total_dead_letters"]
        
        queue_status = "healthy"
        if total_queued > self.alert_thresholds["queue_size"]:
            queue_status = "degraded"
        if dead_letter_count > self.alert_thresholds["dead_letter_count"]:
            queue_status = "unhealthy"
        
        return {
            "queue_health": {
                "status": queue_status,
                "total_queued": total_queued,
                "dead_letters": dead_letter_count,
                "queue_distribution": queue_stats
            }
        }


# =============================================================================
# Configuration Management
# =============================================================================

class ConfigManager:
    """Manages relay agent configuration with hot-reload capability"""
    
    def __init__(self, config_file: str = "relay_config.json"):
        self.config_file = config_file
        self.config = self._load_default_config()
        self.config_callbacks: List[Callable] = []
        self.last_modified = 0
    
    def _load_default_config(self) -> Dict[str, Any]:
        """Load default configuration"""
        return {
            "agent": {
                "max_queue_size": 10000,
                "heartbeat_interval": 30,
                "key_rotation_interval": 3600,
                "discovery_enabled": True
            },
            "security": {
                "encryption_required": True,
                "allowed_protocols": ["tcp", "websocket", "http"],
                "rate_limit_per_minute": 1000,
                "blocked_sources": []
            },
            "networking": {
                "tcp_port": 8080,
                "websocket_port": 8081,
                "http_port": 8082,
                "multicast_group": "224.1.1.1",
                "multicast_port": 12345
            },
            "monitoring": {
                "health_check_interval": 60,
                "metrics_retention_hours": 24,
                "alert_thresholds": {
                    "message_failure_rate": 0.1,
                    "average_latency": 5.0,
                    "queue_size": 8000,
                    "dead_letter_count": 100
                }
            }
        }
    
    def load_config(self) -> Dict[str, Any]:
        """Load configuration from file"""
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r') as f:
                    file_config = json.load(f)
                    # Merge with defaults
                    self.config.update(file_config)
                    self.last_modified = os.path.getmtime(self.config_file)
            else:
                # Create default config file
                self.save_config()
        except Exception as e:
            logging.error(f"Error loading config: {e}")
        
        return self.config
    
    def save_config(self):
        """Save current configuration to file"""
        try:
            with open(self.config_file, 'w') as f:
                json.dump(self.config, f, indent=2)
        except Exception as e:
            logging.error(f"Error saving config: {e}")
    
    def update_config(self, updates: Dict[str, Any]):
        """Update configuration with new values"""
        def deep_update(target, source):
            for key, value in source.items():
                if isinstance(value, dict) and key in target and isinstance(target[key], dict):
                    deep_update(target[key], value)
                else:
                    target[key] = value
        
        deep_update(self.config, updates)
        self.save_config()
        
        # Notify callbacks
        for callback in self.config_callbacks:
            try:
                callback(self.config)
            except Exception as e:
                logging.error(f"Error in config callback: {e}")
    
    def register_callback(self, callback: Callable):
        """Register callback for configuration changes"""
        self.config_callbacks.append(callback)
    
    async def watch_config_file(self):
        """Watch config file for changes and reload"""
        while True:
            try:
                if os.path.exists(self.config_file):
                    current_modified = os.path.getmtime(self.config_file)
                    if current_modified > self.last_modified:
                        logging.info("Configuration file changed, reloading...")
                        self.load_config()
                        
                        # Notify callbacks
                        for callback in self.config_callbacks:
                            try:
                                callback(self.config)
                            except Exception as e:
                                logging.error(f"Error in config callback: {e}")
                
                await asyncio.sleep(5)  # Check every 5 seconds
            except Exception as e:
                logging.error(f"Error watching config file: {e}")
                await asyncio.sleep(30)


# =============================================================================
# Usage Example and Testing Framework
# =============================================================================

async def example_usage():
    """Example usage of the Relay Agent"""
    
    # Create relay agent
    relay = RelayAgent("MAIN-001", cluster_id="CLUSTER-ALPHA")
    
    # Setup configuration
    config_manager = ConfigManager()
    config = config_manager.load_config()
    
    # Register some nodes
    relay.register_node(NetworkNode(
        node_id="AGENT-001",
        address="192.168.1.100",
        port=8080,
        protocol=RoutingProtocol.TCP,
        status=NodeStatus.ACTIVE,
        last_seen=time.time(),
        cluster_id="CLUSTER-ALPHA"
    ))
    
    relay.register_node(NetworkNode(
        node_id="AGENT-002",
        address="192.168.1.101",
        port=8081,
        protocol=RoutingProtocol.WEBSOCKET,
        status=NodeStatus.ACTIVE,
        last_seen=time.time(),
        cluster_id="CLUSTER-BETA"
    ))
    
    # Setup message processing filters
    message_processor = MessageProcessor()
    message_processor.add_filter(RateLimitFilter(max_messages_per_minute=500))
    message_processor.add_filter(SecurityFilter(blocked_sources=["MALICIOUS-AGENT"]))
    
    # Setup health monitoring
    health_monitor = HealthMonitor(relay)
    
    # Start relay agent
    await relay.start()
    
    # Send some test messages
    test_message = Message(
        id=str(uuid.uuid4()),
        source_id="TEST-SENDER",
        destination_id="AGENT-001",
        msg_type=MessageType.COMMAND,
        priority=MessagePriority.HIGH,
        payload={"action": "status_check", "parameters": {}},
        timestamp=time.time()
    )
    
    await relay.send_message(test_message)
    
    # Broadcast message
    broadcast_message = Message(
        id=str(uuid.uuid4()),
        source_id="SYSTEM",
        destination_id="BROADCAST",
        msg_type=MessageType.ALERT,
        priority=MessagePriority.CRITICAL,
        payload={"alert_type": "system_maintenance", "message": "Scheduled maintenance in 5 minutes"},
        timestamp=time.time()
    )
    
    await relay.broadcast_message(broadcast_message, "CLUSTER-ALPHA")
    
    # Check health
    health_status = await health_monitor.run_health_checks()
    print("Health Status:", json.dumps(health_status, indent=2))
    
    # Get performance report
    performance_report = relay.get_performance_report()
    print("Performance Report:", json.dumps(performance_report, indent=2))
    
    # Run for a while
    await asyncio.sleep(10)
    
    # Stop relay agent
    await relay.stop()

if __name__ == "__main__":
    # Run the example
    asyncio.run(example_usage())