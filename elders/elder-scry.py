from elders.base import Elder
from messaging import ElderMessage, MessageType
from typing import Dict, Any
from datetime import datetime
from collections import deque, defaultdict

class EldScryElder(Elder):
    """ELD-SCRY (Watcher) - Adaptive Surveillance and Intelligence Elder."""
    
    def __init__(self):
        super().__init__("ELD-SCRY")
        self.surveillance_targets = {}
        self.intelligence_reports = []
        self.threat_assessments = {}
        self.recent_threat_signatures = deque(maxlen=50)
        self.threat_history = defaultdict(list)
        self.learned_threat_traits = defaultdict(int)
        self.agents = {}

    def tick(self) -> None:
        """Execute surveillance cycle."""
        self._coordinate_surveillance()
        self._analyze_intelligence()
        self._assess_threats()

    def _is_agent_available(self, agent_name: str) -> bool:
        agent = self.agents.get(agent_name)
        return hasattr(agent, "receive_message") and callable(agent.receive_message)

    def _coordinate_surveillance(self):
        """Coordinate surveillance operations with scout agents."""
        if self._is_agent_available("scout"):
            message = ElderMessage(
                message_type=MessageType.DIRECTIVE,
                sender=self.name,
                recipient="scout",
                payload={"action": "scan"},
                timestamp=datetime.now()
            )
            self.agents["scout"].receive_message(message)

    def _analyze_intelligence(self):
        """Analyze gathered intelligence."""
        if self._is_agent_available("scout") and self._is_agent_available("analyzer"):
            scout_results = getattr(self.agents["scout"], "scan_results", [])
            if scout_results:
                latest_scan = scout_results[-1]
                suspicion_score = self._preemptive_suspicion_score(latest_scan)
                message = ElderMessage(
                    message_type=MessageType.DIRECTIVE,
                    sender=self.name,
                    recipient="analyzer",
                    payload={
                        "action": "analyze",
                        "data": latest_scan,
                        "suspicion_score": suspicion_score
                    },
                    timestamp=datetime.now()
                )
                self.agents["analyzer"].receive_message(message)

    def _assess_threats(self):
        """Assess threats based on analysis results."""
        if self._is_agent_available("analyzer"):
            analysis_results = getattr(self.agents["analyzer"], "analysis_results", [])
            for result in analysis_results:
                sig = str(hash(frozenset(result.items())))
                now = datetime.now()
                self.threat_history[sig].append(now)

                recent = [t for t in self.threat_history[sig] if (now - t).seconds < 300]
                if len(recent) >= 3:
                    result["threat_level"] = "elevated"

                if result.get("threat_level") in ["high", "critical", "elevated"]:
                    self._generate_threat_alert(result)

    def _is_duplicate_threat(self, signature: str) -> bool:
        return signature in self.recent_threat_signatures

    def _generate_threat_alert(self, analysis_result: Dict[str, Any]):
        """Generate threat alert based on analysis."""
        threat_signature = str(hash(frozenset(analysis_result.items())))
        if self._is_duplicate_threat(threat_signature):
            return

        self.recent_threat_signatures.append(threat_signature)

        # Learn traits
        for k, v in analysis_result.items():
            if isinstance(v, (str, int)):
                trait_key = f"{k}:{v}"
                self.learned_threat_traits[trait_key] += 1

        alert = {
            "threat_id": f"threat_{datetime.now().timestamp()}",
            "threat_level": analysis_result.get("threat_level"),
            "source": analysis_result,
            "timestamp": datetime.now(),
            "recommended_actions": analysis_result.get("recommendations", [])
        }

        # Store in memory
        self.threat_assessments[alert["threat_id"]] = alert

        # Send to ARCH-MALTA
        alert_message = ElderMessage(
            message_type=MessageType.THREAT_ALERT,
            sender=self.name,
            recipient="ARCH-MALTA",
            payload={"threat": alert},
            timestamp=datetime.now(),
            priority=8
        )
        # Optional: Add send logic or queue here

    def _preemptive_suspicion_score(self, scan_result: Dict[str, Any]) -> float:
        """Predictive threat suspicion score based on learned traits."""
        score = 0
        for k, v in scan_result.items():
            trait_key = f"{k}:{v}"
            score += self.learned_threat_traits.get(trait_key, 0)
        return score / (len(scan_result) or 1)

    def handle_message(self, message: ElderMessage) -> None:
        """Handle incoming messages."""
        if message.message_type == MessageType.DIRECTIVE:
            action = message.payload.get("action")
            if action == "watch_target":
                target = message.payload.get("target")
                self.surveillance_targets[target] = {
                    "added_at": datetime.now(),
                    "parameters": message.payload.get("parameters", {})
                }

        elif message.message_type == MessageType.SCAN_RESULTS:
            self.intelligence_reports.append(message.payload)

        elif message.message_type == MessageType.STATUS_REQUEST:
            status = self.report_status()
            # Send back status via messaging layer if needed

        # Placeholder: Optional feedback from ARCH-MALTA or INF agents

    def register_connected_agents(self, agents: Dict[str, Any]) -> None:
        """Connect agents to ELD-SCRY."""
        self.agents = {
            "scout": agents.get("scout"),
            "analyzer": agents.get("analyzer"),
            "hasher": agents.get("hasher")
        }

    def report_status(self) -> Dict[str, Any]:
        """Report system status and metrics."""
        return {
            "name": self.name,
            "role": "Watcher",
            "surveillance_targets": len(self.surveillance_targets),
            "intelligence_reports": len(self.intelligence_reports),
            "threat_assessments": len(self.threat_assessments),
            "connected_agents": list(self.agents.keys()),
            "latest_threats": list(self.threat_assessments.keys())[-5:],
            "learned_traits": len(self.learned_threat_traits)
        }

    def get_supported_message_types(self) -> list:
        return [
            MessageType.DIRECTIVE,
            MessageType.SCAN_RESULTS,
            MessageType.STATUS_REQUEST,
            MessageType.THREAT_ALERT
        ]
# This code defines the EldScryElder class, which is responsible for adaptive surveillance and intelligence gathering in a network of agents. It includes methods for coordinating surveillance, analyzing intelligence, assessing threats, and generating threat alerts. The class also provides functionality to register connected agents and report its status. The code is structured to allow for real-time threat assessment and response, integrating with other agents like scout and analyzer.
# The EldScryElder class is part of a larger system that includes various agents and

