#!/usr/bin/env python3
"""
ANALYZER AGENT (ANL-ORACLE) - Complete Technical Implementation
=====================================================

Advanced data analysis, threat pattern recognition, node profiling, 
anomaly detection, and intelligence extraction system.

Author: System Architecture Team
Version: 2.1.0
Classification: INTERNAL
"""

import asyncio
import json
import logging
import hashlib
import time
import statistics
import re
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any, Set
from dataclasses import dataclass, asdict
from collections import defaultdict, deque
from enum import Enum
import numpy as np
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding


# =====================================================
# CORE DATA STRUCTURES & ENUMS
# =====================================================

class ThreatLevel(Enum):
    MINIMAL = 1
    LOW = 2
    MEDIUM = 3
    HIGH = 4
    CRITICAL = 5

class NodeStatus(Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    SUSPICIOUS = "suspicious"
    COMPROMISED = "compromised"
    OFFLINE = "offline"

class AnalysisType(Enum):
    BEHAVIORAL = "behavioral"
    STATISTICAL = "statistical"
    PATTERN_MATCH = "pattern_match"
    ANOMALY_DETECTION = "anomaly_detection"
    TEMPORAL = "temporal"

@dataclass
class LogEntry:
    timestamp: datetime
    source_id: str
    event_type: str
    severity: str
    content: str
    metadata: Dict[str, Any]
    hash_signature: str

@dataclass
class ThreatPattern:
    pattern_id: str
    name: str
    description: str
    indicators: List[str]
    severity: ThreatLevel
    confidence: float
    first_seen: datetime
    last_seen: datetime
    occurrence_count: int

@dataclass
class NodeProfile:
    node_id: str
    trust_score: float
    behavior_baseline: Dict[str, float]
    anomaly_count: int
    last_assessment: datetime
    status: NodeStatus
    performance_metrics: Dict[str, List[float]]

@dataclass
class AnalysisReport:
    report_id: str
    analyzer_id: str
    timestamp: datetime
    analysis_type: AnalysisType
    findings: List[Dict[str, Any]]
    recommendations: List[str]
    threat_level: ThreatLevel
    confidence_score: float
    signature: str


# =====================================================
# CRYPTOGRAPHIC UTILITIES
# =====================================================

class CryptoManager:
    """Handles all cryptographic operations for secure communications"""
    
    def __init__(self):
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048
        )
        self.private_key = private_key
        self.public_key = private_key.public_key()
    
    def sign_data(self, data: str) -> str:
        """Cryptographically sign data for authenticity"""
        signature = self.private_key.sign(
            data.encode('utf-8'),
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.MAX_LENGTH
            ),
            hashes.SHA256()
        )
        return signature.hex()
    
    def verify_signature(self, data: str, signature: str) -> bool:
        """Verify data signature"""
        try:
            self.public_key.verify(
                bytes.fromhex(signature),
                data.encode('utf-8'),
                padding.PSS(
                    mgf=padding.MGF1(hashes.SHA256()),
                    salt_length=padding.PSS.MAX_LENGTH
                ),
                hashes.SHA256()
            )
            return True
        except Exception:
            return False


# =====================================================
# PATTERN DETECTION ENGINE
# =====================================================

class ThreatPatternEngine:
    """Advanced threat pattern detection and learning system"""
    
    def __init__(self):
        self.patterns: Dict[str, ThreatPattern] = {}
        self.sequence_patterns: Dict[str, List[str]] = {}
        self.behavioral_baselines: Dict[str, Dict[str, float]] = {}
        self.load_default_patterns()
    
    def load_default_patterns(self):
        """Initialize with common threat patterns"""
        default_patterns = [
            {
                "pattern_id": "BRUTE_FORCE",
                "name": "Brute Force Attack",
                "description": "Multiple failed authentication attempts",
                "indicators": ["failed_login", "authentication_error", "invalid_credentials"],
                "severity": ThreatLevel.HIGH,
                "confidence": 0.85
            },
            {
                "pattern_id": "DATA_EXFIL",
                "name": "Data Exfiltration",
                "description": "Unusual data transfer patterns",
                "indicators": ["large_transfer", "encrypted_channel", "unusual_destination"],
                "severity": ThreatLevel.CRITICAL,
                "confidence": 0.90
            },
            {
                "pattern_id": "PRIVILEGE_ESC",
                "name": "Privilege Escalation",
                "description": "Attempt to gain elevated privileges",
                "indicators": ["sudo_attempt", "privilege_change", "admin_access"],
                "severity": ThreatLevel.HIGH,
                "confidence": 0.80
            }
        ]
        
        for pattern_data in default_patterns:
            pattern = ThreatPattern(
                pattern_id=pattern_data["pattern_id"],
                name=pattern_data["name"],
                description=pattern_data["description"],
                indicators=pattern_data["indicators"],
                severity=pattern_data["severity"],
                confidence=pattern_data["confidence"],
                first_seen=datetime.now(),
                last_seen=datetime.now(),
                occurrence_count=0
            )
            self.patterns[pattern.pattern_id] = pattern
    
    def detect_patterns(self, log_entries: List[LogEntry]) -> List[Tuple[ThreatPattern, List[LogEntry]]]:
        """Detect threat patterns in log entries"""
        detected = []
        
        for pattern in self.patterns.values():
            matching_entries = []
            
            for entry in log_entries:
                if self._matches_pattern(entry, pattern):
                    matching_entries.append(entry)
            
            if len(matching_entries) >= self._get_threshold(pattern):
                pattern.last_seen = datetime.now()
                pattern.occurrence_count += 1
                detected.append((pattern, matching_entries))
        
        return detected
    
    def _matches_pattern(self, entry: LogEntry, pattern: ThreatPattern) -> bool:
        """Check if log entry matches threat pattern"""
        content_lower = entry.content.lower()
        type_lower = entry.event_type.lower()
        
        return any(
            indicator in content_lower or indicator in type_lower 
            for indicator in pattern.indicators
        )
    
    def _get_threshold(self, pattern: ThreatPattern) -> int:
        """Get detection threshold based on pattern severity"""
        thresholds = {
            ThreatLevel.MINIMAL: 10,
            ThreatLevel.LOW: 5,
            ThreatLevel.MEDIUM: 3,
            ThreatLevel.HIGH: 2,
            ThreatLevel.CRITICAL: 1
        }
        return thresholds.get(pattern.severity, 3)


# =====================================================
# ANOMALY DETECTION SYSTEM
# =====================================================

class AnomalyDetector:
    """Statistical anomaly detection using multiple algorithms"""
    
    def __init__(self, window_size: int = 100):
        self.window_size = window_size
        self.metric_history: Dict[str, deque] = defaultdict(lambda: deque(maxlen=window_size))
        self.baselines: Dict[str, Dict[str, float]] = {}
    
    def update_metrics(self, node_id: str, metrics: Dict[str, float]):
        """Update metric history for a node"""
        for metric_name, value in metrics.items():
            key = f"{node_id}_{metric_name}"
            self.metric_history[key].append(value)
            
            # Update baseline if we have enough data
            if len(self.metric_history[key]) >= 10:
                self._update_baseline(key)
    
    def detect_anomalies(self, node_id: str, current_metrics: Dict[str, float]) -> List[Dict[str, Any]]:
        """Detect anomalies in current metrics"""
        anomalies = []
        
        for metric_name, current_value in current_metrics.items():
            key = f"{node_id}_{metric_name}"
            
            if key in self.baselines:
                anomaly_score = self._calculate_anomaly_score(key, current_value)
                
                if anomaly_score > 2.0:  # 2 standard deviations
                    anomalies.append({
                        "node_id": node_id,
                        "metric": metric_name,
                        "current_value": current_value,
                        "expected_range": self.baselines[key],
                        "anomaly_score": anomaly_score,
                        "severity": self._score_to_severity(anomaly_score)
                    })
        
        return anomalies
    
    def _update_baseline(self, key: str):
        """Update statistical baseline for a metric"""
        values = list(self.metric_history[key])
        if len(values) < 5:
            return
        
        mean = statistics.mean(values)
        stdev = statistics.stdev(values) if len(values) > 1 else 0
        
        self.baselines[key] = {
            "mean": mean,
            "stdev": stdev,
            "min": min(values),
            "max": max(values),
            "median": statistics.median(values)
        }
    
    def _calculate_anomaly_score(self, key: str, value: float) -> float:
        """Calculate how anomalous a value is"""
        baseline = self.baselines[key]
        if baseline["stdev"] == 0:
            return 0.0
        
        z_score = abs(value - baseline["mean"]) / baseline["stdev"]
        return z_score
    
    def _score_to_severity(self, score: float) -> ThreatLevel:
        """Convert anomaly score to threat level"""
        if score >= 4.0:
            return ThreatLevel.CRITICAL
        elif score >= 3.0:
            return ThreatLevel.HIGH
        elif score >= 2.5:
            return ThreatLevel.MEDIUM
        elif score >= 2.0:
            return ThreatLevel.LOW
        else:
            return ThreatLevel.MINIMAL


# =====================================================
# NODE PROFILING SYSTEM
# =====================================================

class NodeProfiler:
    """Comprehensive node behavior profiling and trust scoring"""
    
    def __init__(self):
        self.profiles: Dict[str, NodeProfile] = {}
        self.trust_decay_rate = 0.95  # Daily trust decay
        self.last_decay_update = datetime.now()
    
    def get_or_create_profile(self, node_id: str) -> NodeProfile:
        """Get existing profile or create new one"""
        if node_id not in self.profiles:
            self.profiles[node_id] = NodeProfile(
                node_id=node_id,
                trust_score=50.0,  # Start neutral
                behavior_baseline={},
                anomaly_count=0,
                last_assessment=datetime.now(),
                status=NodeStatus.HEALTHY,
                performance_metrics=defaultdict(list)
            )
        return self.profiles[node_id]
    
    def update_profile(self, node_id: str, events: List[LogEntry], anomalies: List[Dict[str, Any]]):
        """Update node profile based on recent activity"""
        profile = self.get_or_create_profile(node_id)
        
        # Update anomaly count
        profile.anomaly_count += len(anomalies)
        
        # Adjust trust score based on events and anomalies
        trust_adjustment = self._calculate_trust_adjustment(events, anomalies)
        profile.trust_score = max(0, min(100, profile.trust_score + trust_adjustment))
        
        # Update status based on trust score and recent activity
        profile.status = self._determine_status(profile)
        profile.last_assessment = datetime.now()
    
    def _calculate_trust_adjustment(self, events: List[LogEntry], anomalies: List[Dict[str, Any]]) -> float:
        """Calculate trust score adjustment"""
        adjustment = 0.0
        
        # Penalty for anomalies
        for anomaly in anomalies:
            severity_penalty = {
                ThreatLevel.MINIMAL: -0.5,
                ThreatLevel.LOW: -1.0,
                ThreatLevel.MEDIUM: -2.0,
                ThreatLevel.HIGH: -5.0,
                ThreatLevel.CRITICAL: -10.0
            }
            adjustment += severity_penalty.get(anomaly["severity"], -1.0)
        
        # Reward for stable behavior
        if len(anomalies) == 0 and len(events) > 0:
            adjustment += 0.1 * len(events)
        
        return adjustment
    
    def _determine_status(self, profile: NodeProfile) -> NodeStatus:
        """Determine node status based on profile data"""
        if profile.trust_score >= 80:
            return NodeStatus.HEALTHY
        elif profile.trust_score >= 60:
            return NodeStatus.DEGRADED
        elif profile.trust_score >= 40:
            return NodeStatus.SUSPICIOUS
        else:
            return NodeStatus.COMPROMISED
    
    def decay_trust_scores(self):
        """Apply daily trust score decay"""
        now = datetime.now()
        days_since_update = (now - self.last_decay_update).days
        
        if days_since_update > 0:
            for profile in self.profiles.values():
                profile.trust_score *= (self.trust_decay_rate ** days_since_update)
            self.last_decay_update = now


# =====================================================
# MAIN ANALYZER AGENT CLASS
# =====================================================

class AnalyzerAgent:
    """Main Analyzer Agent implementation with full capabilities"""
    
    def __init__(self, agent_id: str):
        self.id = f"ANL-ORACLE-{agent_id}"
        self.crypto_manager = CryptoManager()
        self.pattern_engine = ThreatPatternEngine()
        self.anomaly_detector = AnomalyDetector()
        self.node_profiler = NodeProfiler()
        
        # Internal state
        self.observations: List[LogEntry] = []
        self.reports: List[AnalysisReport] = []
        self.active_investigations: Dict[str, Dict] = {}
        
        # Configuration
        self.max_observations = 10000
        self.analysis_interval = 300  # 5 minutes
        self.tamper_resistant = True
        
        # Setup logging
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(f"AnalyzerAgent-{agent_id}")
        
        self.logger.info(f"Analyzer Agent {self.id} initialized successfully")
    
    async def ingest_logs(self, logs: List[str], source_id: str = "unknown"):
        """Ingest and process raw log data"""
        processed_entries = []
        
        for log_line in logs:
            try:
                entry = self._parse_log_entry(log_line, source_id)
                if entry:
                    processed_entries.append(entry)
                    self.observations.append(entry)
            except Exception as e:
                self.logger.error(f"Failed to parse log entry: {e}")
        
        # Maintain observation window
        if len(self.observations) > self.max_observations:
            self.observations = self.observations[-self.max_observations:]
        
        # Trigger analysis if we have enough new data
        if len(processed_entries) > 10:
            await self._trigger_analysis(processed_entries)
        
        return len(processed_entries)
    
    def _parse_log_entry(self, log_line: str, source_id: str) -> Optional[LogEntry]:
        """Parse raw log line into structured LogEntry"""
        try:
            # Basic timestamp extraction
            timestamp_match = re.match(r'^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})', log_line)
            if timestamp_match:
                timestamp = datetime.fromisoformat(timestamp_match.group(1).replace(' ', 'T'))
            else:
                timestamp = datetime.now()
            
            # Extract severity
            severity = "INFO"
            for level in ["CRITICAL", "ERROR", "WARN", "INFO", "DEBUG"]:
                if level in log_line.upper():
                    severity = level
                    break
            
            # Determine event type
            event_type = self._classify_event_type(log_line)
            
            # Generate hash
            hash_signature = hashlib.sha256(
                f"{timestamp.isoformat()}{source_id}{log_line}".encode()
            ).hexdigest()[:16]
            
            return LogEntry(
                timestamp=timestamp,
                source_id=source_id,
                event_type=event_type,
                severity=severity,
                content=log_line,
                metadata={"parsed_at": datetime.now().isoformat()},
                hash_signature=hash_signature
            )
        
        except Exception as e:
            self.logger.error(f"Error parsing log entry: {e}")
            return None
    
    def _classify_event_type(self, log_line: str) -> str:
        """Classify log entry type based on content"""
        content_lower = log_line.lower()
        
        classifications = {
            "authentication": ["login", "auth", "credential", "password"],
            "network": ["connection", "tcp", "udp", "socket", "port"],
            "file_system": ["file", "directory", "read", "write", "delete"],
            "process": ["process", "pid", "exec", "fork", "kill"],
            "security": ["security", "breach", "unauthorized", "access denied"],
            "performance": ["cpu", "memory", "disk", "load", "performance"],
            "error": ["error", "exception", "fail", "crash", "abort"]
        }
        
        for event_type, keywords in classifications.items():
            if any(keyword in content_lower for keyword in keywords):
                return event_type
        
        return "general"
    
    async def _trigger_analysis(self, recent_entries: List[LogEntry]):
        """Trigger comprehensive analysis on recent log entries"""
        self.logger.info(f"Triggering analysis on {len(recent_entries)} entries")
        
        # Pattern detection
        threat_patterns = self.pattern_engine.detect_patterns(recent_entries)
        
        # Node-specific analysis
        node_analyses = await self._analyze_by_node(recent_entries)
        
        # Generate comprehensive report
        report = await self._generate_analysis_report(
            recent_entries, threat_patterns, node_analyses
        )
        
        self.reports.append(report)
        await self._send_to_synch(report)
    
    def _extract_node_metrics(self, entries: List[LogEntry]) -> Dict[str, float]:
        """Extract performance metrics from log entries"""
        metrics = {
            "error_rate": 0.0,
            "activity_level": len(entries),
            "security_events": 0.0,
            "performance_score": 100.0
        }
        
        if not entries:
            return metrics
        
        # Calculate error rate
        error_count = sum(1 for entry in entries if entry.severity in ["ERROR", "CRITICAL"])
        metrics["error_rate"] = (error_count / len(entries)) * 100
        
        # Count security events
        security_keywords = ["unauthorized", "breach", "attack", "intrusion", "malware"]
        security_count = sum(
            1 for entry in entries 
            if any(keyword in entry.content.lower() for keyword in security_keywords)
        )
        metrics["security_events"] = security_count
        
        # Calculate performance score (inverse of error rate)
        metrics["performance_score"] = max(0, 100 - metrics["error_rate"])
        
        return metrics
    
    async def _generate_analysis_report(
        self, 
        entries: List[LogEntry], 
        threat_patterns: List[Tuple[ThreatPattern, List[LogEntry]]],
        node_analyses: Dict[str, Dict]
    ) -> AnalysisReport:
        """Generate comprehensive analysis report"""
        
        findings = []
        recommendations = []
        max_threat_level = ThreatLevel.MINIMAL
        confidence_scores = []
        
        # Process threat patterns
        for pattern, matching_entries in threat_patterns:
            findings.append({
                "type": "threat_pattern",
                "pattern_name": pattern.name,
                "severity": pattern.severity.name,
                "confidence": pattern.confidence,
                "occurrences": len(matching_entries),
                "description": pattern.description
            })
            
            if pattern.severity.value > max_threat_level.value:
                max_threat_level = pattern.severity
            
            confidence_scores.append(pattern.confidence)
            
            # Generate recommendations
            if pattern.severity.value >= ThreatLevel.HIGH.value:
                recommendations.append(f"Immediate investigation required for {pattern.name}")
        
        # Process node analyses
        for node_id, analysis in node_analyses.items():
            profile = analysis["profile"]
            
            if profile.status != NodeStatus.HEALTHY:
                findings.append({
                    "type": "node_status",
                    "node_id": node_id,
                    "status": profile.status.value,
                    "trust_score": profile.trust_score,
                    "anomaly_count": len(analysis["anomalies"])
                })
                
                if profile.status == NodeStatus.COMPROMISED:
                    recommendations.append(f"Quarantine node {node_id} - compromised status")
                elif profile.status == NodeStatus.SUSPICIOUS:
                    recommendations.append(f"Enhanced monitoring for node {node_id}")
        
        # Calculate overall confidence
        overall_confidence = statistics.mean(confidence_scores) if confidence_scores else 0.5
        
        # Create report
        report = AnalysisReport(
            report_id=f"RPT-{int(time.time())}-{len(self.reports)}",
            analyzer_id=self.id,
            timestamp=datetime.now(),
            analysis_type=AnalysisType.BEHAVIORAL,
            findings=findings,
            recommendations=recommendations,
            threat_level=max_threat_level,
            confidence_score=overall_confidence,
            signature=""  # Will be set after signing
        )
        
        # Sign the report
        report_data = json.dumps(asdict(report), default=str, sort_keys=True)
        report.signature = self.crypto_manager.sign_data(report_data)
        
        return report
    
    async def _send_to_synch(self, report: AnalysisReport):
        """Send analysis report to SYNCH hub"""
        # In a real implementation, this would use actual network communication
        self.logger.info(f"Sending report {report.report_id} to SYNCH-CORE")
        self.logger.info(f"Report summary: {len(report.findings)} findings, "
                        f"threat level: {report.threat_level.name}")
        
        # Simulate sending to different components based on threat level
        if report.threat_level.value >= ThreatLevel.HIGH.value:
            self.logger.info("Alert sent to Commander - high threat detected")
        
        if any(f["type"] == "node_status" for f in report.findings):
            self.logger.info("Node status update sent to Builder")
    
    def get_node_profile(self, node_id: str) -> Optional[NodeProfile]:
        """Get current profile for a specific node"""
        return self.node_profiler.profiles.get(node_id)
    
    def get_system_status(self) -> Dict[str, Any]:
        """Get overall system status and statistics"""
        total_nodes = len(self.node_profiler.profiles)
        healthy_nodes = sum(
            1 for p in self.node_profiler.profiles.values() 
            if p.status == NodeStatus.HEALTHY
        )
        
        return {
            "analyzer_id": self.id,
            "uptime": "operational",
            "total_observations": len(self.observations),
            "total_reports": len(self.reports),
            "nodes_monitored": total_nodes,
            "healthy_nodes": healthy_nodes,
            "threat_patterns_known": len(self.pattern_engine.patterns),
            "last_analysis": self.reports[-1].timestamp.isoformat() if self.reports else None
        }
    
    async def replay_historical_events(self, start_time: datetime, end_time: datetime) -> Dict[str, Any]:
        """Replay and analyze historical events for forensic analysis"""
        relevant_entries = [
            entry for entry in self.observations
            if start_time <= entry.timestamp <= end_time
        ]
        
        if not relevant_entries:
            return {"status": "no_data", "message": "No entries found in specified time range"}
        
        # Perform comprehensive analysis on historical data
        threat_patterns = self.pattern_engine.detect_patterns(relevant_entries)
        node_analyses = await self._analyze_by_node(relevant_entries)
        
        return {
            "status": "success",
            "time_range": {
                "start": start_time.isoformat(),
                "end": end_time.isoformat()
            },
            "entries_analyzed": len(relevant_entries),
            "threats_detected": len(threat_patterns),
            "nodes_involved": len(node_analyses),
            "detailed_analysis": {
                "threat_patterns": [
                    {
                        "name": pattern.name,
                        "severity": pattern.severity.name,
                        "occurrences": len(entries)
                    }
                    for pattern, entries in threat_patterns
                ],
                "node_summaries": {
                    node_id: {
                        "status": analysis["profile"].status.value,
                        "anomalies": len(analysis["anomalies"]),
                        "trust_score": analysis["profile"].trust_score
                    }
                    for node_id, analysis in node_analyses.items()
                }
            }
        }

# =====================================================
# EXAMPLE USAGE & DEMONSTRATION
# =====================================================


    async def demonstrate_analyzer_agent():
    """Demonstrate the Analyzer Agent capabilities"""
    
            # Initialize agent
             analyzer = AnalyzerAgent("001")
    
            # Sample log data
            sample_logs = [
                      "2024-06-02T10:30:15 ERROR authentication failed for user admin from 192.168.1.100",
                      "2024-06-02T10:30:45 ERROR authentication failed for user admin from 192.168.1.100",
                      "2024-06-02T10:31:02 ERROR authentication failed for user admin from 192.168.1.100",
                      "2024-06-02T10:31:15 INFO user logged in successfully",
                      "2024-06-02T10:32:00 WARN large data transfer detected: 500MB to external.server.com",
                     "2024-06-02T10:33:30 ERROR unauthorized access attempt blocked",
                     "2024-06-02T10:35:00 INFO system performance normal",
                    "2024-06-02T10:40:00 CRITICAL security breach detected in file system"
                     ]
    
          # Ingest logs from multiple sources
          await analyzer.ingest_logs(sample_logs[:4], "web-server-01"
          await analyzer.ingest_logs(sample_logs[4:], "database-server-01")
    
           # Get system status
           status = analyzer.get_system_status()
           print("=== ANALYZER SYSTEM STATUS ===")
           print(json.dumps(status, indent=2))
    
          # Get node profiles
        print("\n=== NODE PROFILES ===")
        for node_id in ["web-server-01", "database-server-01"]:
               profile = analyzer.get_node_profile(node_id)
               if profile:
                    print(f"Node: {node_id}")
                    print(f"  Status: {profile.status.value}")
                    print(f"  Trust Score: {profile.trust_score:.2f}")
                    print(f"  Anomalies: {profile.anomaly_count}")
    
        # Historical replay
        print("\n=== HISTORICAL ANALYSIS ===")
        replay_result = await analyzer.replay_historical_events(
        datetime.now() - timedelta(hours=1),
        datetime.now()
    )
        print(json.dumps(replay_result, indent=2, default=str))


if __name__ == "__main__":
    # Run demonstration
    asyncio.run(demonstrate_analyzer_agent())
