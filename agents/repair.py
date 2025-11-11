#!/usr/bin/env python3
"""
REPAIR AGENT (REP-ALPHA) - Digital Organism Immune System
==========================================================

A comprehensive fault detection, patch deployment, and auto-healing system
that maintains the integrity and continuity of the digital organism.

Author: Digital Organism Architecture Team
Version: 2.1.0
Classification: CORE-SYSTEM
"""

import asyncio
import hashlib
import json
import logging
import pickle
import time
import uuid
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Optional, Any, Callable, Set
from dataclasses import dataclass, field
from abc import ABC, abstractmethod
import threading
from concurrent.futures import ThreadPoolExecutor
import copy

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

import asyncio
import logging
import copy
import json
import uuid
import hashlib

# Remove duplicate/old class definitions below, keep only one set of each class.
class RepairPriority(Enum):
    CRITICAL = 1    # System-threatening failures
    HIGH = 2        # Major functionality impacted
    MEDIUM = 3      # Minor functionality impacted
    LOW = 4         # Optimization/maintenance
    BACKGROUND = 5  # Proactive improvements

class RepairType(Enum):
    """Types of repair operations"""
    PATCH = "patch"
    RESTORE = "restore"
    REBUILD = "rebuild"
    QUARANTINE = "quarantine"
    ROLLBACK = "rollback"
    DEPENDENCY_FIX = "dependency_fix"
    MEMORY_REPAIR = "memory_repair"
    CONFIGURATION_FIX = "configuration_fix"

class NodeHealth(Enum):
    """Node health status enumeration"""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    CRITICAL = "critical"
    FAILED = "failed"
    QUARANTINED = "quarantined"
    REPAIRING = "repairing"

@dataclass
class RepairTicket:
    """Represents a repair request with all necessary context"""
    id: str = field(default_factory=lambda: f"RT-{uuid.uuid4().hex[:8]}")
    node_id: str = ""
    repair_type: RepairType = RepairType.PATCH
    priority: RepairPriority = RepairPriority.MEDIUM
    description: str = ""
    detected_at: datetime = field(default_factory=datetime.now)
    symptoms: List[str] = field(default_factory=list)
    root_cause: Optional[str] = None
    estimated_duration: int = 300  # seconds
    attempts: int = 0
    max_attempts: int = 3
    requires_approval: bool = False
    backup_required: bool = True
    rollback_plan: Optional[Dict] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class NodeSnapshot:
    """Complete state snapshot of a node for restoration"""
    node_id: str
    timestamp: datetime
    state_data: Dict[str, Any]
    configuration: Dict[str, Any]
    dependencies: List[str]
    health_metrics: Dict[str, float]
    checksum: str = ""
    
    def __post_init__(self):
        """Calculate checksum after initialization"""
        self.checksum = self._calculate_checksum()
    
    def _calculate_checksum(self) -> str:
        """Calculate SHA-256 checksum of snapshot data"""
        data_str = json.dumps({
            'state': self.state_data,
            'config': self.configuration,
            'deps': self.dependencies,
            'metrics': self.health_metrics
        }, sort_keys=True)
        return hashlib.sha256(data_str.encode()).hexdigest()

class RepairStrategy(ABC):
    """Abstract base class for repair strategies"""
    
    @abstractmethod
    async def can_handle(self, ticket: RepairTicket) -> bool:
        """Check if this strategy can handle the repair ticket"""
        pass
    
    @abstractmethod
    async def execute_repair(self, ticket: RepairTicket, context: Dict) -> bool:
        """Execute the repair operation"""
        pass
    
    @abstractmethod
    def get_estimated_time(self, ticket: RepairTicket) -> int:
        """Get estimated repair time in seconds"""
        pass

class PatchRepairStrategy(RepairStrategy):
    """Strategy for applying software patches"""
    
    async def can_handle(self, ticket: RepairTicket) -> bool:
        return ticket.repair_type == RepairType.PATCH
    
    async def execute_repair(self, ticket: RepairTicket, context: Dict) -> bool:
        logging.info(f"Applying patch to {ticket.node_id}")
        
        # Simulate patch application with validation
        await asyncio.sleep(2)  # Simulate patch download/apply time
        
        # Validate patch integrity
        if not self._validate_patch(ticket, context):
            logging.error(f"Patch validation failed for {ticket.node_id}")
            return False
        
        # Apply patch with rollback capability
        return await self._apply_patch_safely(ticket, context)
    
    def get_estimated_time(self, ticket: RepairTicket) -> int:
        return 120  # 2 minutes for typical patch
    
    def _validate_patch(self, ticket: RepairTicket, context: Dict) -> bool:
        """Validate patch before application"""
        # Simulate patch validation
        return True
    
    async def _apply_patch_safely(self, ticket: RepairTicket, context: Dict) -> bool:
        """Apply patch with rollback capability"""
        try:
            # Create backup point
            backup_id = f"pre-patch-{ticket.id}"
            logging.info(f"Creating backup {backup_id} before patch")
            
            # Simulate patch application
            await asyncio.sleep(1)
            
            # Verify patch success
            if self._verify_patch_application(ticket):
                logging.info(f"Patch successfully applied to {ticket.node_id}")
                return True
            else:
                logging.warning(f"Patch verification failed, rolling back {ticket.node_id}")
                await self._rollback_patch(ticket, backup_id)
                return False
                
        except Exception as e:
            logging.error(f"Patch application failed: {e}")
            return False
    
    def _verify_patch_application(self, ticket: RepairTicket) -> bool:
        """Verify that patch was applied correctly"""
        # Simulate verification
        return True
    
    async def _rollback_patch(self, ticket: RepairTicket, backup_id: str):
        """Rollback patch if verification fails"""
        logging.info(f"Rolling back patch for {ticket.node_id} using backup {backup_id}")
        await asyncio.sleep(1)

class RestoreRepairStrategy(RepairStrategy):
    """Strategy for restoring nodes from snapshots"""
    
    async def can_handle(self, ticket: RepairTicket) -> bool:
        return ticket.repair_type == RepairType.RESTORE
    
    async def execute_repair(self, ticket: RepairTicket, context: Dict) -> bool:
        logging.info(f"Restoring {ticket.node_id} from snapshot")
        
        # Find suitable snapshot
        snapshot = await self._find_best_snapshot(ticket.node_id, context)
        if not snapshot:
            logging.error(f"No suitable snapshot found for {ticket.node_id}")
            return False
        
        # Validate snapshot integrity
        if not self._validate_snapshot(snapshot):
            logging.error(f"Snapshot validation failed for {ticket.node_id}")
            return False
        
        # Perform restoration
        return await self._restore_from_snapshot(ticket, snapshot, context)
    
    def get_estimated_time(self, ticket: RepairTicket) -> int:
        return 300  # 5 minutes for restoration
    
    async def _find_best_snapshot(self, node_id: str, context: Dict) -> Optional[NodeSnapshot]:
        """Find the most suitable snapshot for restoration"""
        snapshots = context.get('snapshots', {}).get(node_id, [])
        if not snapshots:
            return None
        
        # Return most recent healthy snapshot
        healthy_snapshots = [s for s in snapshots if s.health_metrics.get('status') == 'healthy']
        return max(healthy_snapshots, key=lambda x: x.timestamp) if healthy_snapshots else None
    
    def _validate_snapshot(self, snapshot: NodeSnapshot) -> bool:
        """Validate snapshot integrity using checksum"""
        current_checksum = snapshot._calculate_checksum()
        return current_checksum == snapshot.checksum
    
    async def _restore_from_snapshot(self, ticket: RepairTicket, snapshot: NodeSnapshot, context: Dict) -> bool:
        """Restore node from validated snapshot"""
        try:
            logging.info(f"Restoring {ticket.node_id} from snapshot {snapshot.timestamp}")
            
            # Simulate restoration process
            await asyncio.sleep(2)
            
            # Update node registry with restored state
            node_registry = context.get('node_registry', {})
            if ticket.node_id in node_registry:
                node_registry[ticket.node_id].update({
                    'state': snapshot.state_data,
                    'configuration': snapshot.configuration,
                    'dependencies': snapshot.dependencies,
                    'health': NodeHealth.HEALTHY,
                    'last_restored': datetime.now()
                })
            
            logging.info(f"Successfully restored {ticket.node_id}")
            return True
            
        except Exception as e:
            logging.error(f"Restoration failed for {ticket.node_id}: {e}")
            return False

class DependencyRepairStrategy(RepairStrategy):
    """Strategy for fixing broken dependencies"""
    
    async def can_handle(self, ticket: RepairTicket) -> bool:
        return ticket.repair_type == RepairType.DEPENDENCY_FIX
    
    async def execute_repair(self, ticket: RepairTicket, context: Dict) -> bool:
        logging.info(f"Repairing dependencies for {ticket.node_id}")
        
        # Analyze and repair broken dependencies
        broken_deps = await self._identify_broken_dependencies(ticket.node_id, context)
        
        success = True
        for dep in broken_deps:
            if not await self._repair_dependency(ticket.node_id, dep, context):
                success = False
                logging.error(f"Failed to repair dependency {dep} for {ticket.node_id}")
        
        return success
    
    def get_estimated_time(self, ticket: RepairTicket) -> int:
        return 180  # 3 minutes for dependency repair
    
    async def _identify_broken_dependencies(self, node_id: str, context: Dict) -> List[str]:
        """Identify broken dependencies for a node"""
        node_registry = context.get('node_registry', {})
        if node_id not in node_registry:
            return []
        
        node = node_registry[node_id]
        broken_deps = []
        
        for dep_id in node.get('dependencies', []):
            if dep_id not in node_registry or node_registry[dep_id].get('health') == NodeHealth.FAILED:
                broken_deps.append(dep_id)
        
        return broken_deps
    
    async def _repair_dependency(self, node_id: str, dep_id: str, context: Dict) -> bool:
        """Repair a specific dependency"""
        logging.info(f"Repairing dependency {dep_id} for {node_id}")
        
        # Simulate dependency repair
        await asyncio.sleep(1)
        
        # Check if dependency can be restored or needs replacement
        node_registry = context.get('node_registry', {})
        if dep_id in node_registry:
            # Try to restore the dependency
            dep_node = node_registry[dep_id]
            if dep_node.get('health') != NodeHealth.FAILED:
                dep_node['health'] = NodeHealth.HEALTHY
                return True
        
        # If dependency cannot be restored, try to find alternative
        return await self._find_alternative_dependency(node_id, dep_id, context)
    
    async def _find_alternative_dependency(self, node_id: str, dep_id: str, context: Dict) -> bool:
        """Find and configure alternative dependency"""
        logging.info(f"Searching for alternative to {dep_id} for {node_id}")
        
        # Simulate finding alternative
        await asyncio.sleep(1)
        
        # In a real implementation, this would search for compatible alternatives
        # For now, simulate successful alternative found
        return True

class RepairAgent:
    """
    Main Repair Agent class - Digital Organism's Immune System
    
    Handles fault detection, patch deployment, structural recovery, and auto-healing
    across the entire digital organism network.
    """
    
    def __init__(self, agent_id: str, node_registry: Dict[str, Any]):
        # Use canonical AgentID type if available
        try:
            from agent_core_anatomy import AgentID
            if isinstance(agent_id, AgentID):
                self.id = agent_id
            else:
                self.id = AgentID(f"REP-ALPHA-{str(agent_id)}")
        except ImportError:
            self.id = f"REP-ALPHA-{agent_id}"
        self.node_registry = node_registry
        self.repair_queue: List[RepairTicket] = []
        self.active_repairs: Dict[str, RepairTicket] = {}
        self.repair_history: List[Dict[str, Any]] = []
        self.snapshots: Dict[str, List[NodeSnapshot]] = {}
        self.repair_strategies: List[RepairStrategy] = []
        self.executor = ThreadPoolExecutor(max_workers=4)
        self.running = False
        self.health_check_interval = 30  # seconds
        self.snapshot_interval = 300     # 5 minutes
        self.last_health_check = datetime.now()
        self.last_snapshot = datetime.now()
        
        # Performance metrics
        self.metrics = {
            'repairs_completed': 0,
            'repairs_failed': 0,
            'uptime': datetime.now(),
            'avg_repair_time': 0,
            'nodes_under_care': len(node_registry)
        }
        
        # Elder approval system
        self.elder_approval_required = {
            RepairType.REBUILD: True,
            RepairType.QUARANTINE: True,
            RepairType.ROLLBACK: False,
            RepairType.RESTORE: False,
            RepairType.PATCH: False,
            RepairType.DEPENDENCY_FIX: False,
            RepairType.MEMORY_REPAIR: True,
            RepairType.CONFIGURATION_FIX: False
        }
        
        # Initialize repair strategies
        self._initialize_strategies()
        
        logging.info(f"Repair Agent {str(self.id)[:16]} initialized with {len(node_registry)} nodes under care")
    
    def _initialize_strategies(self):
        """Initialize all repair strategies"""
        self.repair_strategies = [
            PatchRepairStrategy(),
            RestoreRepairStrategy(),
            DependencyRepairStrategy()
        ]
        logging.info(f"Initialized {len(self.repair_strategies)} repair strategies")
    
    async def start(self):
        """Start the repair agent main loop"""
        self.running = True
        logging.info(f"Starting Repair Agent {str(self.id)[:16]}")
        
        # Start background tasks
        tasks = [
            asyncio.create_task(self._repair_loop()),
            asyncio.create_task(self._health_monitor_loop()),
            asyncio.create_task(self._snapshot_loop()),
            asyncio.create_task(self._self_healing_loop())
        ]
        
        await asyncio.gather(*tasks, return_exceptions=True)
    
    async def stop(self):
        """Stop the repair agent"""
        self.running = False
        self.executor.shutdown(wait=True)
        logging.info(f"Repair Agent {str(self.id)[:16]} stopped")
    
    async def _repair_loop(self):
        """Main repair processing loop"""
        while self.running:
            try:
                await self._process_repair_queue()
                await asyncio.sleep(1)  # Process repairs every second
            except Exception as e:
                logging.error(f"Error in repair loop: {e}")
                await asyncio.sleep(5)
    
    async def _health_monitor_loop(self):
        """Proactive health monitoring loop"""
        while self.running:
            try:
                if datetime.now() - self.last_health_check > timedelta(seconds=self.health_check_interval):
                    await self._perform_health_check()
                    self.last_health_check = datetime.now()
                await asyncio.sleep(10)
            except Exception as e:
                logging.error(f"Error in health monitor: {e}")
                await asyncio.sleep(30)
    
    async def _snapshot_loop(self):
        """Periodic snapshot creation loop"""
        while self.running:
            try:
                if datetime.now() - self.last_snapshot > timedelta(seconds=self.snapshot_interval):
                    await self._create_snapshots()
                    self.last_snapshot = datetime.now()
                await asyncio.sleep(60)  # Check every minute
            except Exception as e:
                logging.error(f"Error in snapshot loop: {e}")
                await asyncio.sleep(120)
    
    async def _self_healing_loop(self):
        """Self-healing and optimization loop"""
        while self.running:
            try:
                await self._perform_self_healing()
                await asyncio.sleep(300)  # Self-heal every 5 minutes
            except Exception as e:
                logging.error(f"Error in self-healing: {e}")
                await asyncio.sleep(600)
    
    async def submit_repair_ticket(self, ticket: RepairTicket) -> str:
        """Submit a repair ticket for processing"""
        # Validate ticket
        if not self._validate_ticket(ticket):
            raise ValueError(f"Invalid repair ticket: {ticket}")
        
        # Check if elder approval is required
        if self.elder_approval_required.get(ticket.repair_type, False):
            ticket.requires_approval = True
            logging.info(f"Repair ticket {ticket.id} requires elder approval")
        
        # Add to queue with priority sorting
        self.repair_queue.append(ticket)
        self.repair_queue.sort(key=lambda x: (x.priority.value, x.detected_at))
        
        logging.info(f"Repair ticket {ticket.id} submitted for {ticket.node_id}")
        return ticket.id
    
    def _validate_ticket(self, ticket: RepairTicket) -> bool:
        """Validate repair ticket before processing"""
        if not ticket.node_id:
            return False
        if ticket.node_id not in self.node_registry:
            logging.warning(f"Node {ticket.node_id} not found in registry")
            return False
        return True
    
    async def _process_repair_queue(self):
        """Process pending repair tickets"""
        if not self.repair_queue:
            return
        
        # Process highest priority tickets first
        tickets_to_process = []
        for ticket in self.repair_queue[:]:
            if ticket.requires_approval and not await self._get_elder_approval(ticket):
                continue
            
            if len(self.active_repairs) < 4:  # Max concurrent repairs
                tickets_to_process.append(ticket)
                self.repair_queue.remove(ticket)
        
        # Start repair tasks
        for ticket in tickets_to_process:
            task = asyncio.create_task(self._execute_repair(ticket))
            self.active_repairs[ticket.id] = ticket
    
    async def _get_elder_approval(self, ticket: RepairTicket) -> bool:
        """Request elder approval for critical repairs"""
        logging.info(f"Requesting elder approval for ticket {ticket.id}")
        
        # Simulate elder approval process
        await asyncio.sleep(2)
        
        # For demo purposes, approve all but critical system repairs
        if ticket.priority == RepairPriority.CRITICAL and ticket.repair_type == RepairType.REBUILD:
            logging.warning(f"Elder approval denied for critical rebuild: {ticket.id}")
            return False
        
        logging.info(f"Elder approval granted for ticket {ticket.id}")
        return True
    async def _execute_repair(self, ticket: RepairTicket):
        """Execute a repair ticket"""
        start_time = datetime.now()
        success = False
        
        try:
            logging.info(f"Starting repair {ticket.id} for {ticket.node_id}")
            
            # Mark node as repairing
            if ticket.node_id in self.node_registry:
                self.node_registry[ticket.node_id]['health'] = NodeHealth.REPAIRING
            
            # Create backup if required
            if ticket.backup_required:
                await self._create_node_backup(ticket.node_id)
            
            # Find and execute appropriate strategy
            strategy = await self._find_repair_strategy(ticket)
            if not strategy:
                logging.error(f"No suitable repair strategy found for ticket {ticket.id}")
                return
            
            # Execute repair with timeout
            context = {
                'node_registry': self.node_registry,
                'snapshots': self.snapshots,
                'repair_agent': self
            }
            
            success = await asyncio.wait_for(
                strategy.execute_repair(ticket, context),
                timeout=ticket.estimated_duration * 2
            )
            
            if success:
                logging.info(f"Repair {ticket.id} completed successfully")
                self.metrics['repairs_completed'] += 1
                
                # Update node health
                if ticket.node_id in self.node_registry:
                    self.node_registry[ticket.node_id]['health'] = NodeHealth.HEALTHY
                    self.node_registry[ticket.node_id]['last_repaired'] = datetime.now()
            else:
                logging.error(f"Repair {ticket.id} failed")
                ticket.attempts += 1
                
                if ticket.attempts < ticket.max_attempts:
                    # Retry repair
                    logging.info(f"Retrying repair {ticket.id} (attempt {ticket.attempts + 1})")
                    self.repair_queue.append(ticket)
                else:
                    logging.error(f"Repair {ticket.id} failed after {ticket.max_attempts} attempts")
                    self.metrics['repairs_failed'] += 1
                    
                    # Mark node as failed if repair cannot be completed
                    if ticket.node_id in self.node_registry:
                        self.node_registry[ticket.node_id]['health'] = NodeHealth.FAILED
        
        except asyncio.TimeoutError:
            logging.error(f"Repair {ticket.id} timed out")
            ticket.attempts += 1
            if ticket.attempts < ticket.max_attempts:
                self.repair_queue.append(ticket)
            
        except Exception as e:
            logging.error(f"Unexpected error during repair {ticket.id}: {e}")
            
        finally:
            # Clean up
            if ticket.id in self.active_repairs:
                del self.active_repairs[ticket.id]
            
            # Record repair history
            duration = (datetime.now() - start_time).total_seconds()
            self.repair_history.append({
                'ticket_id': ticket.id,
                'node_id': ticket.node_id,
                'repair_type': ticket.repair_type.value,
                'success': success,
                'duration': duration,
                'attempts': ticket.attempts,
                'completed_at': datetime.now()
            })
            
            # Update average repair time
            # Update average repair time
            completed = self.metrics.get('repairs_completed', 0)
            prev_avg = self.metrics.get('avg_repair_time', 0)
            if completed > 0:
                self.metrics['avg_repair_time'] = (prev_avg * (completed - 1) + duration) / completed
    
    async def _find_repair_strategy(self, ticket: RepairTicket) -> Optional[RepairStrategy]:
        """Find appropriate repair strategy for ticket"""
        for strategy in self.repair_strategies:
            if await strategy.can_handle(ticket):
                return strategy
        return None
    
    async def _perform_health_check(self):
        """Perform proactive health check on all nodes"""
        logging.info("Performing proactive health check")
        
        for node_id, node in self.node_registry.items():
            try:
                health_issues = await self._check_node_health(node_id, node)
                
                if health_issues:
                    # Create repair tickets for identified issues
                    for issue in health_issues:
                        ticket = RepairTicket(
                            node_id=node_id,
                            repair_type=issue['type'],
                            priority=issue['priority'],
                            description=issue['description'],
                            symptoms=issue.get('symptoms', [])
                        )
                        await self.submit_repair_ticket(ticket)
            
            except Exception as e:
                logging.error(f"Health check failed for {node_id}: {e}")
    
    async def _check_node_health(self, node_id: str, node: Dict) -> List[Dict]:
        """Check health of individual node"""
        issues = []
        
        # Check basic health status
        current_health = node.get('health', NodeHealth.HEALTHY)
        if current_health in [NodeHealth.CRITICAL, NodeHealth.FAILED]:
            issues.append({
                'type': RepairType.RESTORE,
                'priority': RepairPriority.HIGH,
                'description': f"Node {node_id} is in {current_health.value} state",
                'symptoms': ['node_failure', 'unresponsive']
            })
        
        # Check dependencies
        broken_deps = []
        for dep_id in node.get('dependencies', []):
            if dep_id not in self.node_registry or self.node_registry[dep_id].get('health') == NodeHealth.FAILED:
                broken_deps.append(dep_id)
        
        if broken_deps:
            issues.append({
                'type': RepairType.DEPENDENCY_FIX,
                'priority': RepairPriority.MEDIUM,
                'description': f"Node {node_id} has broken dependencies: {broken_deps}",
                'symptoms': ['dependency_failure']
            })
        
        # Check for memory issues (simulated)
        memory_usage = node.get('metrics', {}).get('memory_usage', 0)
        if memory_usage > 0.9:  # 90% memory usage
            issues.append({
                'type': RepairType.MEMORY_REPAIR,
                'priority': RepairPriority.HIGH,
                'description': f"Node {node_id} has high memory usage: {memory_usage:.2%}",
                'symptoms': ['high_memory_usage', 'performance_degradation']
            })
        
        return issues
    
    async def _create_snapshots(self):
        """Create snapshots of all healthy nodes"""
        logging.info("Creating node snapshots")
        
        for node_id, node in self.node_registry.items():
            if node.get('health') == NodeHealth.HEALTHY:
                try:
                    snapshot = await self._create_node_snapshot(node_id, node)
                    
                    # Store snapshot
                    if node_id not in self.snapshots:
                        self.snapshots[node_id] = []
                    
                    self.snapshots[node_id].append(snapshot)
                    
                    # Keep only last 10 snapshots per node
                    self.snapshots[node_id] = self.snapshots[node_id][-10:]
                    
                except Exception as e:
                    logging.error(f"Failed to create snapshot for {node_id}: {e}")
    
    async def _create_node_snapshot(self, node_id: str, node: Dict) -> NodeSnapshot:
        """Create a snapshot of a node's current state"""
        snapshot = NodeSnapshot(
            node_id=node_id,
            timestamp=datetime.now(),
            state_data=copy.deepcopy(node.get('state', {})),
            configuration=copy.deepcopy(node.get('configuration', {})),
            dependencies=node.get('dependencies', []).copy(),
            health_metrics=copy.deepcopy(node.get('metrics', {}))
        )
        
        logging.debug(f"Created snapshot for {node_id}: {snapshot.checksum[:8]}")
        return snapshot
    
    async def _create_node_backup(self, node_id: str):
        """Create emergency backup before repair"""
        if node_id in self.node_registry:
            node = self.node_registry[node_id]
            backup = await self._create_node_snapshot(node_id, node)
            
            # Store as emergency backup
            if node_id not in self.snapshots:
                self.snapshots[node_id] = []
            self.snapshots[node_id].insert(0, backup)  # Insert at beginning
            
            logging.info(f"Emergency backup created for {node_id}")
    
    async def _perform_self_healing(self):
        """Perform self-healing operations on the repair agent itself"""
        try:
            # Check own health
            if not self._check_self_health():
                logging.warning("Repair agent self-health check failed, initiating self-repair")
                await self._self_repair()
            
            # Optimize repair queue
            self._optimize_repair_queue()
            
            # Clean up old history
            self._cleanup_old_data()
            
            logging.debug("Self-healing operations completed")
            
        except Exception as e:
            logging.error(f"Self-healing failed: {e}")
    
    def _check_self_health(self) -> bool:
        """Check repair agent's own health"""
        # Check if queues are too large
        if len(self.repair_queue) > 100:
            return False
        
        # Check if too many active repairs
        if len(self.active_repairs) > 10:
            return False
        
        # Check memory usage (simulated)
        if len(self.repair_history) > 1000:
            return False
        
        return True
    
    async def _self_repair(self):
        """Repair agent self-repair operations"""
        logging.info("Performing self-repair operations")
        
        # Clear excessive queue items
        if len(self.repair_queue) > 100:
            self.repair_queue = self.repair_queue[:50]  # Keep only top 50
            logging.info("Trimmed repair queue")
        
        # Reset stuck repairs
        stuck_repairs = []
        for ticket_id, ticket in self.active_repairs.items():
            if (datetime.now() - ticket.detected_at).total_seconds() > 3600:  # 1 hour
                stuck_repairs.append(ticket_id)
        
        for ticket_id in stuck_repairs:
            del self.active_repairs[ticket_id]
            logging.info(f"Removed stuck repair: {ticket_id}")
    
    def _optimize_repair_queue(self):
        """Optimize repair queue for better performance"""
        # Remove duplicate tickets for same node
        seen_nodes = set()
        optimized_queue = []
        
        for ticket in self.repair_queue:
            if ticket.node_id not in seen_nodes:
                optimized_queue.append(ticket)
                seen_nodes.add(ticket.node_id)
        
        if len(optimized_queue) < len(self.repair_queue):
            self.repair_queue = optimized_queue
            logging.info(f"Optimized repair queue, removed {len(self.repair_queue) - len(optimized_queue)} duplicates")
    
    def _cleanup_old_data(self):
        """Clean up old snapshots and history data"""
        # Clean up old snapshots (keep only last 30 days)
        cutoff_date = datetime.now() - timedelta(days=30)
        
        for node_id in self.snapshots:
            self.snapshots[node_id] = [
                s for s in self.snapshots[node_id] if s.timestamp > cutoff_date
            ]
            if not self.snapshots[node_id]:
                del self.snapshots[node_id]
        logging.info("Cleaned up old snapshots")
        # Clean up repair history (keep only last 100 entries)
        if len(self.repair_history) > 100:
            self.repair_history = self.repair_history[-100:]
            logging.info("Cleaned up old repair history")
        # Update performance metrics
        self.metrics['nodes_under_care'] = len(self.node_registry)

        self.metrics['uptime'] = datetime.now() - self.metrics['uptime']

    def get_metrics(self) -> Dict[str, Any]:
        """Get current performance metrics"""
        return {
            'repairs_completed': self.metrics['repairs_completed'],
            'repairs_failed': self.metrics['repairs_failed'],
            'avg_repair_time': self.metrics['avg_repair_time'],
            'uptime': str(self.metrics['uptime']),
            'nodes_under_care': self.metrics['nodes_under_care']
        }
        return f"{self.major}.{self.minor}.{self.patch}"
        return f"{self.major}.{self.minor}.{self.patch}"

if __name__ == "__main__":
    # Example usage
    agent = RepairAgent(agent_id="12345", node_registry={})
    asyncio.run(agent.start())
    # To stop the agent, you would call agent.stop() in a real application