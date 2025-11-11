#!/usr/bin/env python3
"""
DEFENDER Agent - Complete Technical Implementation
Codename: DEF-OBSIDIAN Core System
Role: Active threat prevention, mitigation, system integrity enforcement
"""

import time
import json
import threading
import hashlib
from typing import Dict, List, Set, Optional, Tuple, Any
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict, deque
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('DEFENDER')

class ThreatLevel(Enum):
    BENIGN = 0
    SUSPICIOUS = 1
    MODERATE = 2
    HIGH = 3
    CRITICAL = 4

class DefenseMode(Enum):
    SILENT_MONITOR = "silent_monitor"
    REACTIVE_DEFENSE = "reactive_defense"
    ENGAGED_COMBAT = "engaged_combat"
    ETHICAL_WAIT = "ethical_wait"
    RECOVERY_SYNC = "recovery_sync"

class ActionType(Enum):
    QUARANTINE = "quarantine"
    BLOCK = "block"
    ISOLATE = "isolate"
    PURGE = "purge"
    MONITOR = "monitor"
    ALERT = "alert"

@dataclass
class ThreatSignature:
    """Represents a behavioral pattern that indicates potential threat"""
    signature_id: str
    pattern: Dict[str, Any]
    severity: ThreatLevel
    confidence: float
    created_at: float = field(default_factory=time.time)

@dataclass
class AgentBehavior:
    """Captures agent behavioral metrics for threat assessment"""
    agent_id: str
    timestamp: float
    actions: List[str]
    resource_usage: Dict[str, float]
    communication_patterns: Dict[str, int]
    anomaly_indicators: Dict[str, float]
    trust_score: float = 1.0
    malicious_score: float = 0.0

@dataclass
class DefenseAction:
    """Represents a defensive action taken by the system"""
    action_id: str
    action_type: ActionType
    target_agent: str
    justification: str
    ethical_approval: bool
    timestamp: float = field(default_factory=time.time)
    success: bool = False

class EthicsModule:
    """LUMEN Ethics Module - evaluates defensive actions for ethical compliance"""
    
    def __init__(self):
        self.ethical_rules = {
            "minimize_harm": 0.9,
            "preserve_system_integrity": 0.8,
            "respect_agent_autonomy": 0.6,
            "transparency": 0.7,
            "proportional_response": 0.8
        }
        self.action_history = deque(maxlen=1000)
    
    def review_action(self, action_type: ActionType, target_agent: str, 
                     justification: str, threat_level: ThreatLevel) -> Tuple[bool, str]:
        """
        Evaluate whether a defensive action is ethically justified
        Returns (approval, reasoning)
        """
        ethical_score = 0.0
        reasoning = []
        
        # Proportionality check
        if threat_level == ThreatLevel.CRITICAL and action_type in [ActionType.QUARANTINE, ActionType.ISOLATE]:
            ethical_score += 0.3
            reasoning.append("High threat justifies containment")
        elif threat_level == ThreatLevel.BENIGN and action_type == ActionType.PURGE:
            ethical_score -= 0.5
            reasoning.append("Excessive response to benign threat")
        else:
            ethical_score += 0.2
            reasoning.append("Proportional response")
        
        # System integrity preservation
        if "system_critical" in justification.lower():
            ethical_score += 0.3
            reasoning.append("System integrity at risk")
        
        # Minimize harm principle
        if action_type in [ActionType.MONITOR, ActionType.ALERT]:
            ethical_score += 0.2
            reasoning.append("Non-destructive action preferred")
        elif action_type == ActionType.PURGE:
            ethical_score -= 0.1
            reasoning.append("Destructive action requires high justification")
        
        # Historical behavior consideration
        recent_actions = [a for a in self.action_history if a.target_agent == target_agent]
        if len(recent_actions) > 3:
            ethical_score -= 0.2
            reasoning.append("Repeated targeting may indicate bias")
        
        approval = ethical_score > 0.5
        return approval, "; ".join(reasoning)
    
    def log_action(self, action: DefenseAction):
        """Log action for historical analysis"""
        self.action_history.append(action)

class ThreatDetectionEngine:
    """Advanced threat detection using behavioral analysis and ML-inspired techniques"""
    
    def __init__(self):
        self.signatures = {}
        self.behavioral_baselines = {}
        self.anomaly_threshold = 0.7
        self.initialize_signatures()
    
    def initialize_signatures(self):
        """Initialize known threat signatures"""
        self.signatures = {
            "data_exfiltration": ThreatSignature(
                "data_exfil_001",
                {
                    "high_network_output": lambda x: x.get("network_output", 0) > 1000,
                    "unusual_data_access": lambda x: x.get("data_access_rate", 0) > 50,
                    "encryption_activity": lambda x: x.get("crypto_operations", 0) > 100
                },
                ThreatLevel.HIGH,
                0.85
            ),
            "system_infiltration": ThreatSignature(
                "sys_infil_001",
                {
                    "privilege_escalation": lambda x: x.get("privilege_requests", 0) > 5,
                    "system_file_access": lambda x: x.get("system_access", 0) > 10,
                    "process_injection": lambda x: x.get("process_creation", 0) > 20
                },
                ThreatLevel.CRITICAL,
                0.9
            ),
            "resource_abuse": ThreatSignature(
                "resource_abuse_001",
                {
                    "cpu_spike": lambda x: x.get("cpu_usage", 0) > 0.8,
                    "memory_leak": lambda x: x.get("memory_growth", 0) > 0.5,
                    "network_flood": lambda x: x.get("connection_count", 0) > 1000
                },
                ThreatLevel.MODERATE,
                0.75
            )
        }
    
    def analyze_behavior(self, behavior: AgentBehavior) -> Tuple[ThreatLevel, float, List[str]]:
        """
        Analyze agent behavior for threat indicators
        Returns (threat_level, confidence, matched_signatures)
        """
        max_threat = ThreatLevel.BENIGN
        max_confidence = 0.0
        matched_signatures = []
        
        # Check against known signatures
        for sig_name, signature in self.signatures.items():
            matches = 0
            total_patterns = len(signature.pattern)
            
            for pattern_name, pattern_func in signature.pattern.items():
                if pattern_func(behavior.anomaly_indicators):
                    matches += 1
            
            match_ratio = matches / total_patterns if total_patterns > 0 else 0
            
            if match_ratio >= 0.6:  # 60% pattern match threshold
                if signature.severity.value > max_threat.value:
                    max_threat = signature.severity
                    max_confidence = signature.confidence * match_ratio
                matched_signatures.append(sig_name)
        
        # Behavioral baseline analysis
        baseline_score = self._check_behavioral_baseline(behavior)
        if baseline_score > self.anomaly_threshold:
            if max_threat.value < ThreatLevel.SUSPICIOUS.value:
                max_threat = ThreatLevel.SUSPICIOUS
                max_confidence = max(max_confidence, baseline_score)
        
        return max_threat, max_confidence, matched_signatures
    
    def _check_behavioral_baseline(self, behavior: AgentBehavior) -> float:
        """Check behavior against established baselines"""
        agent_id = behavior.agent_id
        
        if agent_id not in self.behavioral_baselines:
            # Initialize baseline for new agent
            self.behavioral_baselines[agent_id] = {
                'cpu_avg': 0.1,
                'memory_avg': 0.1,
                'network_avg': 10.0
            }
            return 0.0
        
        baseline = self.behavioral_baselines[agent_id]
        anomaly_score = 0.0
        
        # Compare current behavior to baseline
        cpu_deviation = abs(behavior.anomaly_indicators.get('cpu_usage', 0) - baseline['cpu_avg'])
        memory_deviation = abs(behavior.anomaly_indicators.get('memory_usage', 0) - baseline['memory_avg'])
        network_deviation = abs(behavior.anomaly_indicators.get('network_activity', 0) - baseline['network_avg'])
        
        anomaly_score = min(1.0, (cpu_deviation + memory_deviation + network_deviation) / 3)
        
        return anomaly_score

class QuarantineManager:
    """Manages quarantined agents and their isolation"""
    
    def __init__(self):
        self.quarantined_agents: Set[str] = set()
        self.quarantine_policies: Dict[str, Dict] = {}
        self.isolation_network = {}
    
    def quarantine_agent(self, agent_id: str, policy: Dict) -> bool:
        """Place agent in quarantine with specified policy"""
        try:
            self.quarantined_agents.add(agent_id)
            self.quarantine_policies[agent_id] = {
                'timestamp': time.time(),
                'policy': policy,
                'violations': []
            }
            logger.info(f"Agent {agent_id} quarantined with policy: {policy}")
            return True
        except Exception as e:
            logger.error(f"Failed to quarantine agent {agent_id}: {e}")
            return False
    
    def release_agent(self, agent_id: str) -> bool:
        """Release agent from quarantine"""
        try:
            self.quarantined_agents.discard(agent_id)
            self.quarantine_policies.pop(agent_id, None)
            logger.info(f"Agent {agent_id} released from quarantine")
            return True
        except Exception as e:
            logger.error(f"Failed to release agent {agent_id}: {e}")
            return False
    
    def is_quarantined(self, agent_id: str) -> bool:
        """Check if agent is currently quarantined"""
        return agent_id in self.quarantined_agents
    
    def get_quarantine_status(self) -> Dict:
        """Get current quarantine status"""
        return {
            'quarantined_count': len(self.quarantined_agents),
            'quarantined_agents': list(self.quarantined_agents),
            'policies': self.quarantine_policies
        }

class DefenderAgent:
    """
    Main Defender Agent - The Iron Wall and Intelligent Sentry
    Codename: DEF-OBSIDIAN-XXXX
    """
    
    def __init__(self, agent_id: str):
        self.id = f"DEF-OBSIDIAN-{agent_id}"
        self.mode = DefenseMode.SILENT_MONITOR
        self.active = True
        
        # Core modules
        self.ethics = EthicsModule()
        self.threat_engine = ThreatDetectionEngine()
        self.quarantine_manager = QuarantineManager()
        
        # State tracking
        self.trust_scores: Dict[str, float] = defaultdict(lambda: 1.0)
        self.behavioral_history: Dict[str, List[AgentBehavior]] = defaultdict(list)
        self.active_threats: Dict[str, ThreatLevel] = {}
        self.defense_actions: List[DefenseAction] = []
        
        # Collaboration interfaces
        self.watcher_feed = deque(maxlen=1000)
        self.analyzer_reports = deque(maxlen=500)
        self.commander_alerts = deque(maxlen=100)
        
        # Monitoring thread
        self.monitor_thread = threading.Thread(target=self._continuous_monitor, daemon=True)
        self.monitor_thread.start()
        
        logger.info(f"Defender Agent {self.id} initialized and active")
    
    def receive_watcher_signal(self, signal: Dict):
        """Receive real-time threat signals from Watcher"""
        self.watcher_feed.append({
            'timestamp': time.time(),
            'signal': signal
        })
        
        # Switch to reactive mode if threat detected
        if signal.get('threat_level', 0) > 2:
            self.mode = DefenseMode.REACTIVE_DEFENSE
            logger.warning(f"Switching to REACTIVE_DEFENSE mode due to Watcher signal")
    
    def receive_analyzer_report(self, report: Dict):
        """Receive risk assessment from Analyzer"""
        self.analyzer_reports.append({
            'timestamp': time.time(),
            'report': report
        })
        
        # Update trust scores based on analyzer findings
        agent_id = report.get('agent_id')
        if agent_id:
            risk_score = report.get('risk_score', 0)
            self.trust_scores[agent_id] = max(0.0, self.trust_scores[agent_id] - risk_score * 0.1)
    
    def assess_threat(self, agent_behavior: AgentBehavior) -> Tuple[ThreatLevel, float, str]:
        """
        Comprehensive threat assessment combining multiple analysis methods
        """
        # Behavioral analysis
        threat_level, confidence, signatures = self.threat_engine.analyze_behavior(agent_behavior)
        
        # Trust score consideration
        trust_factor = self.trust_scores[agent_behavior.agent_id]
        if trust_factor < 0.3:
            threat_level = ThreatLevel(min(ThreatLevel.CRITICAL.value, threat_level.value + 1))
            confidence = min(1.0, confidence + 0.2)
        
        # Historical behavior analysis
        history = self.behavioral_history[agent_behavior.agent_id]
        if len(history) > 5:
            recent_anomalies = sum(1 for b in history[-5:] if b.malicious_score > 0.5)
            if recent_anomalies >= 3:
                threat_level = ThreatLevel(min(ThreatLevel.CRITICAL.value, threat_level.value + 1))
        
        justification = f"Threat signatures: {signatures}, Trust: {trust_factor:.2f}, History anomalies: {len(history)}"
        
        return threat_level, confidence, justification
    
    def execute_defense_action(self, action_type: ActionType, target_agent: str, 
                             threat_level: ThreatLevel, justification: str) -> DefenseAction:
        """Execute defensive action with ethical approval"""
        action_id = hashlib.md5(f"{target_agent}:{action_type.value}:{time.time()}".encode()).hexdigest()[:8]
        
        # Request ethical approval
        if self.mode != DefenseMode.ENGAGED_COMBAT:
            self.mode = DefenseMode.ETHICAL_WAIT
            ethical_approval, ethical_reasoning = self.ethics.review_action(
                action_type, target_agent, justification, threat_level
            )
        else:
            # In combat mode, assume emergency approval for critical threats
            ethical_approval = threat_level.value >= ThreatLevel.HIGH.value
            ethical_reasoning = "Emergency combat mode - immediate action required"
        
        action = DefenseAction(
            action_id=action_id,
            action_type=action_type,
            target_agent=target_agent,
            justification=f"{justification} | Ethics: {ethical_reasoning}",
            ethical_approval=ethical_approval
        )
        
        if ethical_approval:
            success = self._execute_action(action)
            action.success = success
            
            if success:
                logger.info(f"[{self.id}] Successfully executed {action_type.value} on {target_agent}")
            else:
                logger.error(f"[{self.id}] Failed to execute {action_type.value} on {target_agent}")
        else:
            logger.warning(f"[{self.id}] Action {action_type.value} on {target_agent} denied by LUMEN ethics")
        
        self.defense_actions.append(action)
        self.ethics.log_action(action)
        
        return action
    
    def _execute_action(self, action: DefenseAction) -> bool:
        """Execute the actual defensive action"""
        try:
            if action.action_type == ActionType.QUARANTINE:
                policy = {
                    'network_isolation': True,
                    'resource_limit': 0.1,
                    'monitoring_level': 'high'
                }
                return self.quarantine_manager.quarantine_agent(action.target_agent, policy)
            
            elif action.action_type == ActionType.ISOLATE:
                policy = {
                    'network_isolation': True,
                    'resource_limit': 0.05,
                    'monitoring_level': 'maximum'
                }
                return self.quarantine_manager.quarantine_agent(action.target_agent, policy)
            
            elif action.action_type == ActionType.BLOCK:
                # Implement blocking logic (network/resource access)
                logger.info(f"Blocking access for agent {action.target_agent}")
                return True
            
            elif action.action_type == ActionType.MONITOR:
                # Increase monitoring intensity
                logger.info(f"Enhanced monitoring activated for agent {action.target_agent}")
                return True
            
            elif action.action_type == ActionType.ALERT:
                # Send alert to command structure
                self.commander_alerts.append({
                    'timestamp': time.time(),
                    'agent': action.target_agent,
                    'action': action.action_type.value,
                    'justification': action.justification
                })
                return True
            
            elif action.action_type == ActionType.PURGE:
                # Extreme measure - complete removal
                logger.critical(f"PURGE action executed on agent {action.target_agent}")
                return self.quarantine_manager.quarantine_agent(action.target_agent, {'status': 'purged'})
            
            return False
            
        except Exception as e:
            logger.error(f"Action execution failed: {e}")
            return False
    
    def act(self, agent_behavior: AgentBehavior) -> Optional[DefenseAction]:
        """Main action decision method"""
        # Store behavioral history
        self.behavioral_history[agent_behavior.agent_id].append(agent_behavior)
        
        # Assess threat
        threat_level, confidence, justification = self.assess_threat(agent_behavior)
        
        # Update active threats tracking
        if threat_level.value > ThreatLevel.BENIGN.value:
            self.active_threats[agent_behavior.agent_id] = threat_level
        else:
            self.active_threats.pop(agent_behavior.agent_id, None)
        
        # Determine appropriate action
        action_type = self._determine_action(threat_level, confidence, agent_behavior.agent_id)
        
        if action_type:
            return self.execute_defense_action(action_type, agent_behavior.agent_id, threat_level, justification)
        
        return None
    
    def _determine_action(self, threat_level: ThreatLevel, confidence: float, agent_id: str) -> Optional[ActionType]:
        """Determine appropriate defensive action based on threat assessment"""
        # Check if already quarantined
        if self.quarantine_manager.is_quarantined(agent_id):
            if threat_level == ThreatLevel.CRITICAL and confidence > 0.9:
                return ActionType.PURGE
            return None
        
        # Action decision matrix
        if threat_level == ThreatLevel.CRITICAL:
            return ActionType.ISOLATE if confidence > 0.8 else ActionType.QUARANTINE
        elif threat_level == ThreatLevel.HIGH:
            return ActionType.QUARANTINE if confidence > 0.7 else ActionType.BLOCK
        elif threat_level == ThreatLevel.MODERATE:
            return ActionType.BLOCK if confidence > 0.6 else ActionType.MONITOR
        elif threat_level == ThreatLevel.SUSPICIOUS:
            return ActionType.MONITOR if confidence > 0.5 else ActionType.ALERT
        
        return None
    
   def _continuous_monitor(self):
        """Continuous monitoring thread for proactive defense"""
        while self.active:
            try:
                # Check for escalating threats
                escalated_threats = []
                for agent_id, threat_level in self.active_threats.items():
                    history = self.behavioral_history.get(agent_id, [])
                    if len(history) >= 3:
                        recent_scores = [b.malicious_score for b in history[-3:]]
                        if all(score > 0.6 for score in recent_scores):
                            escalated_threats.append(agent_id)
                
                # Handle escalated threats
                for agent_id in escalated_threats:
                    if not self.quarantine_manager.is_quarantined(agent_id):
                        logger.warning(f"Escalated threat detected for {agent_id} - initiating containment")
                        self.execute_defense_action(
                            ActionType.QUARANTINE, 
                            agent_id, 
                            ThreatLevel.HIGH,
                            "Escalated threat pattern detected"
                        )
                
                # Switch back to monitoring mode if no active threats
                if not self.active_threats and self.mode == DefenseMode.REACTIVE_DEFENSE:
                    self.mode = DefenseMode.SILENT_MONITOR
                    logger.info("Switching back to SILENT_MONITOR mode")
                
                time.sleep(5)  # Monitor every 5 seconds
                
            except Exception as e:
                logger.error(f"Monitoring thread error: {e}")
                time.sleep(10)
    
    def get_system_status(self) -> Dict:
        """Get comprehensive system status"""
        return {
            'agent_id': self.id,
            'mode': self.mode.value,
            'active_threats': len(self.active_threats),
            'quarantined_agents': len(self.quarantine_manager.quarantined_agents),
            'total_actions': len(self.defense_actions),
            'recent_actions': [
                {
                    'action': a.action_type.value,
                    'target': a.target_agent,
                    'success': a.success,
                    'timestamp': a.timestamp
                } for a in self.defense_actions[-10:]
            ],
            'trust_scores_summary': {
                'avg_trust': sum(self.trust_scores.values()) / len(self.trust_scores) if self.trust_scores else 1.0,
                'low_trust_agents': [k for k, v in self.trust_scores.items() if v < 0.3],
                'high_trust_agents': [k for k, v in self.trust_scores.items() if v > 0.9]
            },
            'quarantine_status': self.quarantine_manager.get_quarantine_status()
        }
    
    def shutdown(self):
        """Graceful shutdown of the defender agent"""
        self.active = False
        logger.info(f"Defender Agent {self.id} shutting down gracefully")

# Example usage and testing
if __name__ == "__main__":
    # Initialize Defender Agent
    defender = DefenderAgent("001")
    
    # Simulate agent behaviors for testing
    test_behaviors = [
        AgentBehavior(
            agent_id="AGENT-001",
            timestamp=time.time(),
            actions=["file_access", "network_request"],
            resource_usage={"cpu": 0.2, "memory": 0.1},
            communication_patterns={"external": 5, "internal": 10},
            anomaly_indicators={"cpu_usage": 0.2, "network_output": 50, "data_access_rate": 5}
        ),
        AgentBehavior(
            agent_id="AGENT-002",
            timestamp=time.time(),
            actions=["data_extraction", "encryption", "network_flood"],
            resource_usage={"cpu": 0.9, "memory": 0.8},
            communication_patterns={"external": 500, "internal": 2},
            anomaly_indicators={"cpu_usage": 0.9, "network_output": 2000, "data_access_rate": 100}
        )
    ]
    
    # Test threat detection and response
    for behavior in test_behaviors:
        print(f"\n--- Analyzing {behavior.agent_id} ---")
        action = defender.act(behavior)
        if action:
            print(f"Action taken: {action.action_type.value}")
            print(f"Ethical approval: {action.ethical_approval}")
            print(f"Success: {action.success}")
        else:
            print("No action required")
    
    # Display system status
    print("\n--- System Status ---")
    status = defender.get_system_status()
    print(json.dumps(status, indent=2, default=str))
    
    # Cleanup
    time.sleep(2)
    defender.shutdown()
