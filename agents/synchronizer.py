#!/usr/bin/env python3
"""
SYNCHRONISER AGENT (SYNCH-CORE) - Complete Implementation
The heartbeat of coherence across all Elder nodes and agent clusters.

Agent ID Format: SYNC-{VARIANT}-{SERIAL}
Example: SYNC-AETHRA-0027
"""

import time
import json
import hashlib
import asyncio
import logging
import threading
from typing import Dict, List, Any, Optional, Set, Tuple
from collections import Counter, defaultdict, deque
from dataclasses import dataclass, asdict
from enum import Enum
from datetime import datetime, timedelta
import uuid
import hmac
import base64
from concurrent.futures import ThreadPoolExecutor


class SyncMode(Enum):
    STEADY_BEAT = "steady_beat"
    DELTA_ONLY = "delta_only"
    MAJORITY_VOTE = "majority_vote"
    ISOLATED_RECONVERGE = "isolated_reconverge"


class AgentStatus(Enum):
    ALIVE = "ALIVE"
    DEGRADED = "DEGRADED"
    OFFLINE = "OFFLINE"
    RECOVERING = "RECOVERING"


@dataclass
class VectorClock:
    """Logical clock for distributed synchronization"""
    clocks: Dict[str, int]
    
    def __post_init__(self):
        if not self.clocks:
            self.clocks = {}
    
    def tick(self, node_id: str) -> None:
        """Increment local clock"""
        self.clocks[node_id] = self.clocks.get(node_id, 0) + 1
    
    def update(self, other: 'VectorClock') -> None:
        """Update with another vector clock"""
        for node_id, clock_val in other.clocks.items():
            self.clocks[node_id] = max(self.clocks.get(node_id, 0), clock_val)
    
    def compare(self, other: 'VectorClock') -> str:
        """Compare two vector clocks"""
        self_keys = set(self.clocks.keys())
        other_keys = set(other.clocks.keys())
        all_keys = self_keys | other_keys
        
        self_greater = False
        other_greater = False
        
        for key in all_keys:
            self_val = self.clocks.get(key, 0)
            other_val = other.clocks.get(key, 0)
            
            if self_val > other_val:
                self_greater = True
            elif other_val > self_val:
                other_greater = True
        
        if self_greater and not other_greater:
            return "after"
        elif other_greater and not self_greater:
            return "before"
        elif not self_greater and not other_greater:
            return "concurrent"
        else:
            return "concurrent"


@dataclass
class SyncBeat:
    """Heartbeat pulse data structure"""
    timestamp: float
    agent_id: str
    status: AgentStatus
    vector_clock: VectorClock
    state_hash: str
    signature: str
    sequence_number: int
    
    def to_dict(self) -> Dict:
        return {
            'timestamp': self.timestamp,
            'agent_id': self.agent_id,
            'status': self.status.value,
            'vector_clock': asdict(self.vector_clock),
            'state_hash': self.state_hash,
            'signature': self.signature,
            'sequence_number': self.sequence_number
        }


@dataclass
class StateSnapshot:
    """Node state snapshot"""
    node_id: str
    timestamp: float
    data: Dict[str, Any]
    version: int
    checksum: str
    
    def compute_checksum(self) -> str:
        """Compute state checksum"""
        data_str = json.dumps(self.data, sort_keys=True)
        return hashlib.sha256(data_str.encode()).hexdigest()


@dataclass
class CommitEntry:
    """Commit log entry"""
    timestamp: float
    operation: str
    state_hash: str
    affected_nodes: List[str]
    vector_clock: VectorClock
    rollback_data: Optional[Dict] = None


class ClockSyncer:
    """Aligns time ticks using Vector clocks"""
    
    def __init__(self, node_id: str):
        self.node_id = node_id
        self.vector_clock = VectorClock({node_id: 0})
        self.drift_threshold = 5.0  # seconds
    
    def tick(self) -> VectorClock:
        """Increment local clock and return current state"""
        self.vector_clock.tick(self.node_id)
        return VectorClock(self.vector_clock.clocks.copy())
    
    def sync_with_peer(self, peer_clock: VectorClock) -> None:
        """Synchronize with peer's vector clock"""
        self.vector_clock.update(peer_clock)
        self.vector_clock.tick(self.node_id)
    
    def detect_drift(self, peer_clocks: List[VectorClock]) -> bool:
        """Detect if clocks have drifted significantly"""
        current_time = time.time()
        
        for peer_clock in peer_clocks:
            # Simple drift detection based on logical clock differences
            max_diff = max(abs(self.vector_clock.clocks.get(node, 0) - 
                             peer_clock.clocks.get(node, 0))
                          for node in set(self.vector_clock.clocks.keys()) | 
                          set(peer_clock.clocks.keys()))
            
            if max_diff > self.drift_threshold:
                return True
        
        return False


class StateDiffer:
    """Compares node states and resolves drift or divergence"""
    
    def __init__(self):
        self.conflict_resolver = "majority_wins"
    
    def compute_state_hash(self, state: Dict[str, Any]) -> str:
        """Compute deterministic hash of state"""
        state_str = json.dumps(state, sort_keys=True)
        return hashlib.sha256(state_str.encode()).hexdigest()
    
    def find_differences(self, state1: StateSnapshot, state2: StateSnapshot) -> Dict[str, Any]:
        """Find differences between two states"""
        diff = {}
        
        # Find keys that differ
        all_keys = set(state1.data.keys()) | set(state2.data.keys())
        
        for key in all_keys:
            val1 = state1.data.get(key)
            val2 = state2.data.get(key)
            
            if val1 != val2:
                diff[key] = {
                    'state1': val1,
                    'state2': val2,
                    'conflict': True
                }
        
        return diff
    
    def resolve_conflicts(self, snapshots: List[StateSnapshot]) -> StateSnapshot:
        """Resolve conflicts using majority consensus"""
        if not snapshots:
            raise ValueError("No snapshots to resolve")
        
        if len(snapshots) == 1:
            return snapshots[0]
        
        # Find most common state for each key
        all_keys = set()
        for snapshot in snapshots:
            all_keys.update(snapshot.data.keys())
        
        resolved_data = {}
        
        for key in all_keys:
            values = []
            for snapshot in snapshots:
                if key in snapshot.data:
                    values.append(json.dumps(snapshot.data[key], sort_keys=True))
            
            if values:
                # Use majority vote
                most_common = Counter(values).most_common(1)[0][0]
                resolved_data[key] = json.loads(most_common)
        
        # Create new resolved snapshot
        resolved_snapshot = StateSnapshot(
            node_id="RESOLVED",
            timestamp=time.time(),
            data=resolved_data,
            version=max(s.version for s in snapshots) + 1,
            checksum=""
        )
        resolved_snapshot.checksum = resolved_snapshot.compute_checksum()
        
        return resolved_snapshot


class BroadcastChannel:
    """Pushes updates across agent subsystems"""
    
    def __init__(self, agent_id: str):
        self.agent_id = agent_id
        self.subscribers = defaultdict(list)
        self.message_queue = asyncio.Queue()
        self.broadcast_history = deque(maxlen=1000)
    
    def subscribe(self, protocol_tag: str, callback) -> None:
        """Subscribe to specific protocol messages"""
        self.subscribers[protocol_tag].append(callback)
    
    async def broadcast(self, protocol_tag: str, message: Dict[str, Any]) -> None:
        """Broadcast message to all subscribers"""
        broadcast_msg = {
            'timestamp': time.time(),
            'sender': self.agent_id,
            'protocol': protocol_tag,
            'payload': message,
            'message_id': str(uuid.uuid4())
        }
        
        # Store in history
        self.broadcast_history.append(broadcast_msg)
        
        # Notify subscribers
        for callback in self.subscribers.get(protocol_tag, []):
            try:
                await callback(broadcast_msg)
            except Exception as e:
                logging.error(f"Broadcast callback error: {e}")
    
    async def send_targeted(self, target_agent: str, protocol_tag: str, 
                          message: Dict[str, Any]) -> None:
        """Send targeted message to specific agent"""
        targeted_msg = {
            'timestamp': time.time(),
            'sender': self.agent_id,
            'target': target_agent,
            'protocol': protocol_tag,
            'payload': message,
            'message_id': str(uuid.uuid4())
        }
        
        await self.message_queue.put(targeted_msg)


class RecoveryLogManager:
    """Maintains commit logs and rollback checkpoints"""
    
    def __init__(self, max_entries: int = 10000):
        self.commit_log: List[CommitEntry] = []
        self.checkpoints: Dict[str, StateSnapshot] = {}
        self.max_entries = max_entries
        self.lock = threading.Lock()
    
    def log_commit(self, operation: str, state_hash: str, 
                   affected_nodes: List[str], vector_clock: VectorClock,
                   rollback_data: Optional[Dict] = None) -> None:
        """Log a commit operation"""
        with self.lock:
            entry = CommitEntry(
                timestamp=time.time(),
                operation=operation,
                state_hash=state_hash,
                affected_nodes=affected_nodes,
                vector_clock=VectorClock(vector_clock.clocks.copy()),
                rollback_data=rollback_data
            )
            
            self.commit_log.append(entry)
            
            # Trim log if too large
            if len(self.commit_log) > self.max_entries:
                self.commit_log = self.commit_log[-self.max_entries//2:]
    
    def create_checkpoint(self, checkpoint_id: str, snapshot: StateSnapshot) -> None:
        """Create a rollback checkpoint"""
        with self.lock:
            self.checkpoints[checkpoint_id] = snapshot
    
    def get_rollback_point(self, target_time: float) -> Optional[CommitEntry]:
        """Find the best rollback point before target time"""
        with self.lock:
            candidates = [entry for entry in self.commit_log 
                         if entry.timestamp <= target_time]
            
            return max(candidates, key=lambda x: x.timestamp) if candidates else None
    
    def replay_from_checkpoint(self, checkpoint_id: str, 
                              target_time: float) -> List[CommitEntry]:
        """Get operations to replay from checkpoint to target time"""
        if checkpoint_id not in self.checkpoints:
            raise ValueError(f"Checkpoint {checkpoint_id} not found")
        
        checkpoint_time = self.checkpoints[checkpoint_id].timestamp
        
        with self.lock:
            return [entry for entry in self.commit_log 
                   if checkpoint_time < entry.timestamp <= target_time]


class QuorumChecker:
    """Ensures update decisions respect required consensus"""
    
    def __init__(self, total_nodes: int, quorum_size: Optional[int] = None):
        self.total_nodes = total_nodes
        self.quorum_size = quorum_size or (total_nodes // 2 + 1)
        self.pending_votes: Dict[str, Dict[str, Any]] = {}
    
    def initiate_vote(self, proposal_id: str, proposal_data: Dict[str, Any]) -> None:
        """Start a new voting round"""
        self.pending_votes[proposal_id] = {
            'proposal': proposal_data,
            'votes': {},
            'start_time': time.time(),
            'status': 'pending'
        }
    
    def cast_vote(self, proposal_id: str, node_id: str, vote: bool, 
                  justification: str = "") -> None:
        """Cast a vote for a proposal"""
        if proposal_id not in self.pending_votes:
            raise ValueError(f"Proposal {proposal_id} not found")
        
        self.pending_votes[proposal_id]['votes'][node_id] = {
            'vote': vote,
            'timestamp': time.time(),
            'justification': justification
        }
    
    def check_quorum(self, proposal_id: str) -> Tuple[bool, str]:
        """Check if quorum has been reached"""
        if proposal_id not in self.pending_votes:
            return False, "Proposal not found"
        
        votes = self.pending_votes[proposal_id]['votes']
        
        if len(votes) < self.quorum_size:
            return False, f"Insufficient votes: {len(votes)}/{self.quorum_size}"
        
        positive_votes = sum(1 for v in votes.values() if v['vote'])
        
        if positive_votes >= self.quorum_size:
            self.pending_votes[proposal_id]['status'] = 'approved'
            return True, "Quorum reached - approved"
        
        negative_votes = len(votes) - positive_votes
        if negative_votes >= self.quorum_size:
            self.pending_votes[proposal_id]['status'] = 'rejected'
            return True, "Quorum reached - rejected"
        
        return False, "Quorum not reached"


class SynchroniserAgent:
    """Main Synchroniser Agent - The heartbeat of coherence"""
    
    def __init__(self, agent_id: str, variant: str = "AETHRA", 
                 serial: str = None, quorum_size: int = 3):
        # Generate agent ID
        if serial is None:
            serial = f"{int(time.time()) % 10000:04d}"
        
        self.agent_id = f"SYNC-{variant}-{serial}"
        self.variant = variant
        self.serial = serial
        
        # Core components
        self.clock_syncer = ClockSyncer(self.agent_id)
        self.state_differ = StateDiffer()
        self.broadcast_channel = BroadcastChannel(self.agent_id)
        self.recovery_manager = RecoveryLogManager()
        self.quorum_checker = QuorumChecker(quorum_size, quorum_size)
        
        # State management
        self.state_snapshots: Dict[str, StateSnapshot] = {}
        self.sync_mode = SyncMode.STEADY_BEAT
        self.status = AgentStatus.ALIVE
        self.sequence_number = 0
        
        # Security
        self.private_key = self._generate_key()
        self.trusted_agents: Set[str] = set()
        
        # Metrics
        self.metrics = {
            'sync_latency': deque(maxlen=100),
            'heartbeat_frequency': 0,
            'rollback_events': 0,
            'cluster_drift_index': 0.0,
            'commit_integrity_score': 1.0
        }
        
        # Background tasks
        self.running = False
        self.tasks: List[asyncio.Task] = []
        
        # Logging
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(f"SyncAgent-{self.agent_id}")
    
    def _generate_key(self) -> bytes:
        """Generate cryptographic key for signing"""
        return hashlib.sha256(f"{self.agent_id}{time.time()}".encode()).digest()
    
    def _sign_message(self, message: str) -> str:
        """Sign a message with HMAC"""
        signature = hmac.new(self.private_key, message.encode(), hashlib.sha256)
        return base64.b64encode(signature.digest()).decode()
    
    def _verify_signature(self, message: str, signature: str, sender: str) -> bool:
        """Verify message signature (simplified)"""
        # In production, this would use proper public key cryptography
        return True  # Placeholder
    
    def generate_beat(self) -> SyncBeat:
        """Generate a heartbeat pulse"""
        self.sequence_number += 1
        
        # Compute current state hash
        current_state = {
            'snapshots': len(self.state_snapshots),
            'mode': self.sync_mode.value,
            'status': self.status.value
        }
        state_hash = hashlib.sha256(
            json.dumps(current_state, sort_keys=True).encode()
        ).hexdigest()
        
        # Create beat message
        beat_data = {
            'timestamp': time.time(),
            'agent_id': self.agent_id,
            'status': self.status.value,
            'state_hash': state_hash,
            'sequence_number': self.sequence_number
        }
        
        # Sign the beat
        message_str = json.dumps(beat_data, sort_keys=True)
        signature = self._sign_message(message_str)
        
        return SyncBeat(
            timestamp=beat_data['timestamp'],
            agent_id=self.agent_id,
            status=self.status,
            vector_clock=self.clock_syncer.tick(),
            state_hash=state_hash,
            signature=signature,
            sequence_number=self.sequence_number
        )
    
    async def process_beat(self, beat: SyncBeat) -> None:
        """Process incoming heartbeat"""
        if not self._verify_signature(beat.state_hash, beat.signature, beat.agent_id):
            self.logger.warning(f"Invalid signature from {beat.agent_id}")
            return
        
        # Update vector clock
        self.clock_syncer.sync_with_peer(beat.vector_clock)
        
        # Record metrics
        latency = time.time() - beat.timestamp
        self.metrics['sync_latency'].append(latency)
        
        self.logger.info(f"Processed beat from {beat.agent_id}, latency: {latency:.3f}s")
    
    def receive_state(self, node_id: str, state_data: Dict[str, Any], 
                     version: int = 1) -> None:
        """Store state snapshot from a node"""
        snapshot = StateSnapshot(
            node_id=node_id,
            timestamp=time.time(),
            data=state_data,
            version=version,
            checksum=""
        )
        snapshot.checksum = snapshot.compute_checksum()
        
        self.state_snapshots[node_id] = snapshot
        
        # Log the state update
        self.recovery_manager.log_commit(
            operation=f"state_update_{node_id}",
            state_hash=snapshot.checksum,
            affected_nodes=[node_id],
            vector_clock=self.clock_syncer.vector_clock
        )
    
    def detect_drift(self) -> bool:
        """Check if node states have diverged significantly"""
        if len(self.state_snapshots) < 2:
            return False
        
        snapshots = list(self.state_snapshots.values())
        checksums = [s.checksum for s in snapshots]
        
        # Calculate drift index
        unique_checksums = len(set(checksums))
        total_checksums = len(checksums)
        
        drift_ratio = unique_checksums / total_checksums if total_checksums > 0 else 0
        self.metrics['cluster_drift_index'] = drift_ratio
        
        return drift_ratio > 0.5  # More than 50% divergence

                
     async def resolve_drift(self) -> Optional[StateSnapshot]:
        """Resolve state drift using consensus"""
        if not self.detect_drift():
            return None
        
        snapshots = list(self.state_snapshots.values())
        
        try:
            # Use StateDiffer to resolve conflicts
            resolved_state = self.state_differ.resolve_conflicts(snapshots)
            
            # Create checkpoint before applying resolution
            checkpoint_id = f"pre_resolve_{int(time.time())}"
            self.recovery_manager.create_checkpoint(checkpoint_id, snapshots[0])
            
            # Initiate quorum vote for the resolution
            proposal_id = f"drift_resolve_{int(time.time())}"
            self.quorum_checker.initiate_vote(proposal_id, {
                'action': 'resolve_drift',
                'resolved_state': asdict(resolved_state)
            })
            
            # Broadcast resolution proposal
            await self.broadcast_channel.broadcast("SYNC-DELTA", {
                'type': 'drift_resolution',
                'proposal_id': proposal_id,
                'resolved_state': asdict(resolved_state)
            })
            
            self.logger.info(f"Initiated drift resolution proposal {proposal_id}")
            self.metrics['rollback_events'] += 1
            
            return resolved_state
            
        except Exception as e:
            self.logger.error(f"Failed to resolve drift: {e}")
            return None
    
    async def rollback_to_checkpoint(self, checkpoint_id: str) -> bool:
        """Rollback system to a previous checkpoint"""
        try:
            if checkpoint_id not in self.recovery_manager.checkpoints:
                self.logger.error(f"Checkpoint {checkpoint_id} not found")
                return False
            
            checkpoint = self.recovery_manager.checkpoints[checkpoint_id]
            
            # Clear current state snapshots
            self.state_snapshots.clear()
            
            # Restore from checkpoint
            self.state_snapshots[checkpoint.node_id] = checkpoint
            
            # Log rollback operation
            self.recovery_manager.log_commit(
                operation=f"rollback_to_{checkpoint_id}",
                state_hash=checkpoint.checksum,
                affected_nodes=[checkpoint.node_id],
                vector_clock=self.clock_syncer.vector_clock
            )
            
            # Broadcast rollback notification
            await self.broadcast_channel.broadcast("SYNC-ROLLBACK", {
                'checkpoint_id': checkpoint_id,
                'timestamp': checkpoint.timestamp,
                'initiator': self.agent_id
            })
            
            self.logger.info(f"Successfully rolled back to checkpoint {checkpoint_id}")
            return True
            
        except Exception as e:
            self.logger.error(f"Rollback failed: {e}")
            return False
    
    async def sync_with_peers(self, peer_agents: List[str]) -> None:
        """Synchronize with peer agents"""
        for peer in peer_agents:
            try:
                # Send sync request
                await self.broadcast_channel.send_targeted(peer, "SYNC-REQUEST", {
                    'requester': self.agent_id,
                    'vector_clock': asdict(self.clock_syncer.vector_clock),
                    'state_hash': self.state_differ.compute_state_hash(
                        {k: asdict(v) for k, v in self.state_snapshots.items()}
                    )
                })
                
            except Exception as e:
                self.logger.error(f"Failed to sync with peer {peer}: {e}")
    
    async def handle_protocol_messages(self) -> None:
        """Handle incoming protocol messages"""
        while self.running:
            try:
                if not self.broadcast_channel.message_queue.empty():
                    message = await self.broadcast_channel.message_queue.get()
                    await self._process_protocol_message(message)
                
                await asyncio.sleep(0.1)  # Small delay to prevent busy waiting
                
            except Exception as e:
                self.logger.error(f"Error handling protocol messages: {e}")
    
    async def _process_protocol_message(self, message: Dict[str, Any]) -> None:
        """Process a specific protocol message"""
        protocol = message.get('protocol')
        payload = message.get('payload', {})
        
        if protocol == "SYNC-REQUEST":
            await self._handle_sync_request(message)
        elif protocol == "FPR-SYNC":
            await self._handle_fingerprint_sync(message)
        elif protocol == "SYNC-DELTA":()
            await self._handle_delta_sync(message)
        elif protocol == "RES-USAGE-SYNC":
            await self._handle_resource_sync(message)
        elif protocol == "MORAL-SYNC":
            await self._handle_moral_sync(message)
        else:
            self.logger.warning(f"Unknown protocol: {protocol}")
    
    async def _handle_sync_request(self, message: Dict[str, Any]) -> None:
        """Handle synchronization request"""
        requester = message['payload']['requester']
        peer_clock = VectorClock(message['payload']['vector_clock']['clocks'])
        
        # Update our clock with peer's clock
        self.clock_syncer.sync_with_peer(peer_clock)
        
        # Send our current state
        await self.broadcast_channel.send_targeted(requester, "SYNC-RESPONSE", {
            'responder': self.agent_id,
            'vector_clock': asdict(self.clock_syncer.vector_clock),
            'state_snapshots': {k: asdict(v) for k, v in self.state_snapshots.items()}
        })
    
    async def _handle_fingerprint_sync(self, message: Dict[str, Any]) -> None:
        """Handle fingerprint synchronization from Hasher agents"""
        fingerprints = message['payload'].get('fingerprints', {})
        self.logger.info(f"Received {len(fingerprints)} fingerprints for sync")
        # Implementation would integrate with Hasher agent data
    
    async def _handle_delta_sync(self, message: Dict[str, Any]) -> None:
        """Handle delta synchronization updates"""
        delta_type = message['payload'].get('type')
        
        if delta_type == 'drift_resolution':
            proposal_id = message['payload']['proposal_id']
            # Auto-approve for demonstration (in production, this would be more complex)
            self.quorum_checker.cast_vote(proposal_id, self.agent_id, True, 
                                        "Automated drift resolution approval")
    
    async def _handle_resource_sync(self, message: Dict[str, Any]) -> None:
        """Handle resource usage synchronization"""
        resource_data = message['payload']
        self.logger.info(f"Received resource sync data: {resource_data}")
    
    async def _handle_moral_sync(self, message: Dict[str, Any]) -> None:
        """Handle moral/ethical synchronization"""
        moral_data = message['payload']
        self.logger.info(f"Received moral sync data for ethical oversight")
    
    async def start_heartbeat_loop(self, interval: float = 1.0) -> None:
        """Start the heartbeat broadcasting loop"""
        while self.running:
            try:
                beat = self.generate_beat()
                
                # Broadcast heartbeat
                await self.broadcast_channel.broadcast("SYNC-BEAT", beat.to_dict())
                
                # Update metrics
                self.metrics['heartbeat_frequency'] += 1
                
                await asyncio.sleep(interval)
                
            except Exception as e:
                self.logger.error(f"Heartbeat error: {e}")
                await asyncio.sleep(interval)
    
    async def start(self) -> None:
        """Start the synchroniser agent"""
        self.running = True
        self.status = AgentStatus.ALIVE
        
        # Start background tasks
        self.tasks = [
            asyncio.create_task(self.start_heartbeat_loop()),
            asyncio.create_task(self.handle_protocol_messages())
        ]
        
        self.logger.info(f"Synchroniser Agent {self.agent_id} started")
        
        # Wait for all tasks
        await asyncio.gather(*self.tasks)
    
    async def stop(self) -> None:
        """Stop the synchroniser agent"""
        self.running = False
        self.status = AgentStatus.OFFLINE
        
        # Cancel all tasks
        for task in self.tasks:
            task.cancel()
        
        # Wait for tasks to complete cancellation
        await asyncio.gather(*self.tasks, return_exceptions=True)
        
        self.logger.info(f"Synchroniser Agent {self.agent_id} stopped")
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get current synchronization metrics"""
        avg_latency = sum(self.metrics['sync_latency']) / len(self.metrics['sync_latency']) \
                     if self.metrics['sync_latency'] else 0
        
        return {
            'agent_id': self.agent_id,
            'status': self.status.value,
            'sync_mode': self.sync_mode.value,
            'average_sync_latency': avg_latency,
            'heartbeat_frequency': self.metrics['heartbeat_frequency'],
            'rollback_events': self.metrics['rollback_events'],
            'cluster_drift_index': self.metrics['cluster_drift_index'],
            'commit_integrity_score': self.metrics['commit_integrity_score'],
            'active_snapshots': len(self.state_snapshots),
            'vector_clock': asdict(self.clock_syncer.vector_clock)
        }


# Usage Example and Testing
async def demo_synchroniser_agent():
    """Demonstration of the Synchroniser Agent"""
    
    # Create multiple sync agents for testing
    agents = [
        SynchroniserAgent("SYNC-ALPHA-001", "ALPHA", "001"),
        SynchroniserAgent("SYNC-BETA-002", "BETA", "002"),
        SynchroniserAgent("SYNC-GAMMA-003", "GAMMA", "003")
    ]
    
    # Start all agents
    print("Starting Synchroniser Agents...")
    agent_tasks = []
    
    for agent in agents:
        # Add some test state data
        agent.receive_state(f"node_{agent.serial}", {
            'data': f"test_data_{agent.serial}",
            'value': int(agent.serial),
            'timestamp': time.time()
        })
        
        # Start the agent
        task = asyncio.create_task(agent.start())
        agent_tasks.append(task)
    
    # Let them run for a bit

    await asyncio.sleep(5)