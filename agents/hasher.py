#!/usr/bin/env python3
"""
HASHER AGENT - Identity Verifier & Anomaly Detection Sentinel
Agent ID: HASH-BETA-1479
Core Functions:
- Fingerprint extraction and verification
- Anomaly detection for spoofed/cloned identities
- Signature database synchronization
- Inter-agent identity resolution
"""

import hashlib
import hmac
import time
import json
import threading
from collections import defaultdict, deque
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Set
from datetime import datetime, timedelta
import logging


@dataclass
class IdentityFingerprint:
    """Represents a unique identity fingerprint"""
    entity_id: str
    primary_hash: str
    behavior_hash: str
    timestamp: float
    metadata: Dict = field(default_factory=dict)
    chain_depth: int = 0
    trust_score: float = 1.0
    
    def to_dict(self) -> Dict:
        return {
            'entity_id': self.entity_id,
            'primary_hash': self.primary_hash,
            'behavior_hash': self.behavior_hash,
            'timestamp': self.timestamp,
            'metadata': self.metadata,
            'chain_depth': self.chain_depth,
            'trust_score': self.trust_score
        }


@dataclass
class AnomalyReport:
    """Anomaly detection report"""
    entity_id: str
    anomaly_type: str
    severity: str
    expected_hash: str
    actual_hash: str
    timestamp: float
    details: Dict = field(default_factory=dict)


class FingerprintEngine:
    """Core fingerprinting and hashing engine"""
    
    def __init__(self, salt_key: bytes = None):
        self.salt_key = salt_key or b"HASHER_AGENT_SALT_2025"
        self.hash_cache = {}
        
    def generate_primary_hash(self, identity_data: str, timestamp: float = None) -> str:
        """Generate primary identity hash"""
        if timestamp is None:
            timestamp = time.time()
            
        combined = f"{identity_data}:{timestamp}"
        return hashlib.sha256(combined.encode()).hexdigest()
    
    def generate_behavior_hash(self, behavior_sequence: List[str]) -> str:
        """Generate hash from behavioral patterns"""
        behavior_string = "|".join(behavior_sequence)
        return hashlib.blake2b(behavior_string.encode(), 
                              key=self.salt_key, 
                              digest_size=32).hexdigest()
    
    def generate_chain_hash(self, previous_hash: str, current_data: str) -> str:
        """Generate chained hash for sequence verification"""
        combined = f"{previous_hash}:{current_data}"
        return hashlib.sha3_256(combined.encode()).hexdigest()
    
    def verify_hmac_signature(self, data: str, signature: str, key: bytes = None) -> bool:
        """Verify HMAC signature for tampering detection"""
        key = key or self.salt_key
        expected = hmac.new(key, data.encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)


class PatternAnalyzer:
    """Behavioral pattern analysis for anomaly detection"""
    
    def __init__(self, window_size: int = 100):
        self.window_size = window_size
        self.behavior_windows = defaultdict(lambda: deque(maxlen=window_size))
        self.baseline_patterns = {}
        
    def add_behavior_sample(self, entity_id: str, behavior_hash: str):
        """Add behavior sample to analysis window"""
        self.behavior_windows[entity_id].append(behavior_hash)
        
    def establish_baseline(self, entity_id: str) -> bool:
        """Establish behavioral baseline for entity"""
        if len(self.behavior_windows[entity_id]) < 10:
            return False
            
        patterns = list(self.behavior_windows[entity_id])
        self.baseline_patterns[entity_id] = {
            'pattern_hash': hashlib.md5(''.join(patterns).encode()).hexdigest(),
            'established_at': time.time(),
            'sample_count': len(patterns)
        }
        return True
    
    def detect_behavioral_drift(self, entity_id: str, threshold: float = 0.7) -> Optional[float]:
        """Detect significant behavioral pattern changes"""
        if entity_id not in self.baseline_patterns:
            return None
            
        current_patterns = list(self.behavior_windows[entity_id])
        if len(current_patterns) < 5:
            return None
            
        current_hash = hashlib.md5(''.join(current_patterns[-10:]).encode()).hexdigest()
        baseline_hash = self.baseline_patterns[entity_id]['pattern_hash']
        
        # Simple similarity calculation (Hamming distance approximation)
        similarity = sum(c1 == c2 for c1, c2 in zip(current_hash, baseline_hash)) / len(baseline_hash)
        
        if similarity < threshold:
            return 1.0 - similarity  # Return drift magnitude
        return None


class SpoofDetector:
    """Detection of spoofed, cloned, or mimic identities"""
    
    def __init__(self):
        self.known_fingerprints = {}
        self.similarity_index = defaultdict(list)
        self.spoof_patterns = set()
        
    def register_fingerprint(self, fingerprint: IdentityFingerprint):
        """Register a legitimate fingerprint"""
        self.known_fingerprints[fingerprint.entity_id] = fingerprint
        # Index by hash prefix for similarity detection
        prefix = fingerprint.primary_hash[:8]
        self.similarity_index[prefix].append(fingerprint.entity_id)
    
    def detect_hash_collision(self, fingerprint: IdentityFingerprint) -> List[str]:
        """Detect potential hash collisions or duplicates"""
        collisions = []
        for existing_id, existing_fp in self.known_fingerprints.items():
            if (existing_id != fingerprint.entity_id and 
                existing_fp.primary_hash == fingerprint.primary_hash):
                collisions.append(existing_id)
        return collisions
    
    def detect_similarity_spoof(self, fingerprint: IdentityFingerprint, threshold: int = 6) -> List[str]:
        """Detect similar fingerprints that might indicate spoofing"""
        suspects = []
        prefix = fingerprint.primary_hash[:8]
        
        for similar_prefix in self.similarity_index:
            if self._hamming_distance(prefix, similar_prefix) <= threshold:
                suspects.extend(self.similarity_index[similar_prefix])
                
        return [s for s in suspects if s != fingerprint.entity_id]
    
    def _hamming_distance(self, str1: str, str2: str) -> int:
        """Calculate Hamming distance between two strings"""
        if len(str1) != len(str2):
            return max(len(str1), len(str2))
        return sum(c1 != c2 for c1, c2 in zip(str1, str2))
    
    def mark_as_spoof(self, pattern: str):
        """Mark a pattern as known spoof"""
        self.spoof_patterns.add(pattern)
    
    def is_known_spoof(self, fingerprint: IdentityFingerprint) -> bool:
        """Check if fingerprint matches known spoof patterns"""
        return fingerprint.primary_hash in self.spoof_patterns


class SyncRelay:
    """Synchronization relay for hashbook updates"""
    
    def __init__(self, agent_id: str):
        self.agent_id = agent_id
        self.sync_queue = deque()
        self.last_sync = {}
        self.sync_lock = threading.Lock()
        
    def queue_sync_update(self, target_agent: str, fingerprint: IdentityFingerprint):
        """Queue fingerprint for synchronization"""
        with self.sync_lock:
            self.sync_queue.append({
                'target': target_agent,
                'fingerprint': fingerprint.to_dict(),
                'timestamp': time.time(),
                'source': self.agent_id
            })
    
    def process_sync_queue(self) -> List[Dict]:
        """Process pending synchronization updates"""
        updates = []
        with self.sync_lock:
            while self.sync_queue:
                updates.append(self.sync_queue.popleft())
        return updates
    
    def create_sync_message(self, target: str, update_type: str, data: Dict) -> Dict:
        """Create standardized sync message"""
        return {
            'message_type': 'HASH_SYNC_REQ',
            'source_agent': self.agent_id,
            'target_agent': target,
            'update_type': update_type,
            'timestamp': time.time(),
            'data': data,
            'signature': self._sign_message(data)
        }
    
    def _sign_message(self, data: Dict) -> str:
        """Sign message for integrity verification"""
        message_str = json.dumps(data, sort_keys=True)
        return hashlib.sha256(message_str.encode()).hexdigest()


class HasherAgent:
    """Main Hasher Agent - Identity Verifier & Anomaly Detection Sentinel"""
    
    def __init__(self, agent_id: str = "HASH-BETA-1479", config: Dict = None):
        self.agent_id = agent_id
        self.config = config or {}
        
        # Initialize subsystems
        self.fingerprint_engine = FingerprintEngine()
        self.pattern_analyzer = PatternAnalyzer()
        self.spoof_detector = SpoofDetector()
        self.sync_relay = SyncRelay(agent_id)
        
        # Core data structures
        self.signature_db = {}
        self.anomaly_reports = deque(maxlen=1000)
        self.trust_scores = defaultdict(float)
        self.quarantine_list = set()
        
        # Metrics
        self.metrics = {
            'fingerprints_processed': 0,
            'anomalies_detected': 0,
            'sync_operations': 0,
            'trust_updates': 0,
            'hash_collisions': 0
        }
        
        # Operational state
        self.active = True
        self.last_health_check = time.time()
        
        # Setup logging
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(f"HasherAgent-{agent_id}")
        self.logger.info(f"Hasher Agent {agent_id} initialized")
    
    def add_entity(self, entity_id: str, identity_data: str, 
                   behavior_sequence: List[str] = None, metadata: Dict = None) -> IdentityFingerprint:
        """Add new entity to signature database"""
        timestamp = time.time()
        metadata = metadata or {}
        
        # Generate fingerprints
        primary_hash = self.fingerprint_engine.generate_primary_hash(identity_data, timestamp)
        behavior_hash = ""
        if behavior_sequence:
            behavior_hash = self.fingerprint_engine.generate_behavior_hash(behavior_sequence)
            self.pattern_analyzer.add_behavior_sample(entity_id, behavior_hash)
        
        # Create fingerprint object
        fingerprint = IdentityFingerprint(
            entity_id=entity_id,
            primary_hash=primary_hash,
            behavior_hash=behavior_hash,
            timestamp=timestamp,
            metadata=metadata,
            trust_score=1.0
        )
        
        # Store in database
        self.signature_db[entity_id] = fingerprint
        self.spoof_detector.register_fingerprint(fingerprint)
        
        # Update metrics
        self.metrics['fingerprints_processed'] += 1
        
        # Queue for sync
        self.sync_relay.queue_sync_update("SYNCH-CORE", fingerprint)
        
        self.logger.info(f"Added entity {entity_id} with hash {primary_hash[:16]}...")
        return fingerprint
    
    def validate_identity(self, entity_id: str, provided_hash: str) -> Tuple[bool, Optional[str]]:
        """Validate entity identity against stored fingerprint"""
        if entity_id not in self.signature_db:
            return False, "Entity not found in signature database"
        
        stored_fingerprint = self.signature_db[entity_id]
        
        if stored_fingerprint.primary_hash == provided_hash:
            return True, None
        else:
            # Log potential anomaly
            anomaly = AnomalyReport(
                entity_id=entity_id,
                anomaly_type="HASH_MISMATCH",
                severity="HIGH",
                expected_hash=stored_fingerprint.primary_hash,
                actual_hash=provided_hash,
                timestamp=time.time()
            )
            self.report_anomaly(anomaly)
            return False, "Hash mismatch detected"
    
    def detect_anomalies(self, entity_id: str, new_fingerprint: IdentityFingerprint) -> List[AnomalyReport]:
        """Comprehensive anomaly detection"""
        anomalies = []
        
        # Check for hash collisions
        collisions = self.spoof_detector.detect_hash_collision(new_fingerprint)
        if collisions:
            anomalies.append(AnomalyReport(
                entity_id=entity_id,
                anomaly_type="HASH_COLLISION",
                severity="CRITICAL",
                expected_hash="",
                actual_hash=new_fingerprint.primary_hash,
                timestamp=time.time(),
                details={'colliding_entities': collisions}
            ))
            self.metrics['hash_collisions'] += 1
        
        # Check for similarity spoofing
        similar = self.spoof_detector.detect_similarity_spoof(new_fingerprint)
        if similar:
            anomalies.append(AnomalyReport(
                entity_id=entity_id,
                anomaly_type="SIMILARITY_SPOOF",
                severity="MEDIUM",
                expected_hash="",
                actual_hash=new_fingerprint.primary_hash,
                timestamp=time.time(),
                details={'similar_entities': similar}
            ))
        
        # Check for behavioral drift
        drift_magnitude = self.pattern_analyzer.detect_behavioral_drift(entity_id)
        if drift_magnitude is not None:
            severity = "HIGH" if drift_magnitude > 0.5 else "MEDIUM"
            anomalies.append(AnomalyReport(
                entity_id=entity_id,
                anomaly_type="BEHAVIORAL_DRIFT",
                severity=severity,
                expected_hash="",
                actual_hash=new_fingerprint.behavior_hash,
                timestamp=time.time(),
                details={'drift_magnitude': drift_magnitude}
            ))
        
        # Check against known spoof patterns
        if self.spoof_detector.is_known_spoof(new_fingerprint):
            anomalies.append(AnomalyReport(
                entity_id=entity_id,
                anomaly_type="KNOWN_SPOOF",
                severity="CRITICAL",
                expected_hash="",
                actual_hash=new_fingerprint.primary_hash,
                timestamp=time.time()
            ))
        
        return anomalies
    
    def report_anomaly(self, anomaly: AnomalyReport):
        """Report and handle detected anomaly"""
        self.anomaly_reports.append(anomaly)
        self.metrics['anomalies_detected'] += 1
        
        # Log anomaly
        self.logger.warning(f"Anomaly detected: {anomaly.anomaly_type} for {anomaly.entity_id}")
        
        # Handle critical anomalies
        if anomaly.severity == "CRITICAL":
            self.quarantine_entity(anomaly.entity_id)
            self.notify_elders(anomaly)
        
        # Update trust scores
        self.update_trust_score(anomaly.entity_id, -0.1 if anomaly.severity == "MEDIUM" else -0.3)
    
    def quarantine_entity(self, entity_id: str):
        """Quarantine suspicious entity"""
        self.quarantine_list.add(entity_id)
        if entity_id in self.trust_scores:
            self.trust_scores[entity_id] = 0.0
        self.logger.error(f"Entity {entity_id} quarantined due to critical anomaly")
    
    def update_trust_score(self, entity_id: str, delta: float):
        """Update trust score for entity"""
        current_score = self.trust_scores.get(entity_id, 1.0)
        new_score = max(0.0, min(1.0, current_score + delta))
        self.trust_scores[entity_id] = new_score
        self.metrics['trust_updates'] += 1
        
        if entity_id in self.signature_db:
            self.signature_db[entity_id].trust_score = new_score
    
    def notify_elders(self, anomaly: AnomalyReport):
        """Notify Elder agents of critical anomalies"""
        notification = {
            'message_type': 'FPR_ALERT',
            'source_agent': self.agent_id,
            'target_agent': 'ELD-SCRY',
            'anomaly': {
                'entity_id': anomaly.entity_id,
                'type': anomaly.anomaly_type,
                'severity': anomaly.severity,
                'timestamp': anomaly.timestamp,
                'details': anomaly.details
            }
        }
        
        # In a real implementation, this would send to the network
        self.logger.info(f"Notifying ELD-SCRY of critical anomaly: {anomaly.entity_id}")
    
    def sync_with_network(self) -> Dict:
        """Synchronize fingerprint database with network"""
        updates = self.sync_relay.process_sync_queue()
        sync_summary = {
            'updates_sent': len(updates),
            'timestamp': time.time(),
            'database_size': len(self.signature_db)
        }
        
        self.metrics['sync_operations'] += 1
        self.logger.info(f"Synchronized {len(updates)} updates with network")
        
        return sync_summary
    
    def generate_health_report(self) -> Dict:
        """Generate comprehensive health and status report"""
        current_time = time.time()
        uptime = current_time - (self.last_health_check or current_time)
        
        return {
            'agent_id': self.agent_id,
            'status': 'ACTIVE' if self.active else 'INACTIVE',
            'uptime_seconds': uptime,
            'metrics': self.metrics.copy(),
            'database_stats': {
                'total_entities': len(self.signature_db),
                'quarantined_entities': len(self.quarantine_list),
                'recent_anomalies': len([a for a in self.anomaly_reports 
                                       if current_time - a.timestamp < 3600])
            },
            'trust_distribution': {
                'high_trust': len([s for s in self.trust_scores.values() if s > 0.8]),
                'medium_trust': len([s for s in self.trust_scores.values() if 0.5 <= s <= 0.8]),
                'low_trust': len([s for s in self.trust_scores.values() if s < 0.5])
            },
            'last_health_check': current_time
        }
    
    def process_agent_stream(self, agent_network_stream):
        """Main processing loop for agent network stream"""
        for item in agent_network_stream:
            try:
                # Extract identity information
                entity_id = item.get('entity_id')
                identity_data = item.get('identity_data', '')
                behavior_sequence = item.get('behavior_sequence', [])
                
                if not entity_id:
                    continue
                
                # Check if entity exists
                if entity_id in self.signature_db:
                    # Validate existing entity
                    provided_hash = item.get('fingerprint')
                    if provided_hash:
                        valid, error = self.validate_identity(entity_id, provided_hash)
                        if not valid:
                            self.logger.warning(f"Validation failed for {entity_id}: {error}")
                else:
                    # Add new entity
                    self.add_entity(entity_id, identity_data, behavior_sequence, 
                                  item.get('metadata', {}))
                
            except Exception as e:
                self.logger.error(f"Error processing stream item: {e}")
    
    def shutdown(self):
        """Graceful shutdown procedure"""
        self.logger.info(f"Shutting down Hasher Agent {self.agent_id}")
        self.active = False
        
        # Final sync
        self.sync_with_network()
        
        # Generate final report
        final_report = self.generate_health_report()
        self.logger.info(f"Final metrics: {final_report['metrics']}")

    def run(self):
        """Main run loop for the agent"""
        self.logger.info(f"Hasher Agent {self.agent_id} is now running")
        
        try:
            while self.active:
                # Simulate processing agent network stream
                time.sleep(5)  # Replace with actual stream processing logic
                
                # Periodic health check
                if time.time() - self.last_health_check > 60:
                    health_report = self.generate_health_report()
                    self.logger.info(f"Health report: {health_report}")
                    self.last_health_check = time.time()
                    
        except KeyboardInterrupt:
            self.shutdown() 