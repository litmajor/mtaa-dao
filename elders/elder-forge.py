# File: elders/elder-forge.py
from elders.base import Elder
from messaging import ElderMessage, MessageType
from typing import Dict, Any
from datetime import datetime

class EldForgeElder(Elder):
    """ELD-FORGE (Builder) - Construction and creation Elder."""
    
    def __init__(self):
        super().__init__("ELD-FORGE")
        self.construction_projects = {}
        self.blueprints = {}
        self.built_items = []
        
    def tick(self) -> None:
        """Execute construction cycle."""
        self._manage_projects()
        self._verify_constructions()
        self._repair_damaged_systems()
        
    def _manage_projects(self):
        """Manage active construction projects."""
        for project_id, project in self.construction_projects.items():
            if project["status"] == "in_progress":
                self._advance_project(project_id)
    
    def _advance_project(self, project_id: str):
        """Advance a construction project."""
        project = self.construction_projects[project_id]
        project["progress"] += 10  # Arbitrary progress increment
        
        if project["progress"] >= 100:
            project["status"] = "completed"
            project["completed_at"] = datetime.now()
            self.built_items.append({
                "project_id": project_id,
                "item_type": project["type"],
                "completed_at": project["completed_at"],
                "specifications": project["specifications"]
            })
    
    def _verify_constructions(self):
        """Verify integrity of constructions using hasher."""
        if "hasher" in self.agents:
            for item in self.built_items:
                if not item.get("verified", False):
                    # Hash the item specifications for verification
                    message = ElderMessage(
                        message_type=MessageType.DIRECTIVE,
                        sender=self.name,
                        recipient="hasher",
                        payload={
                            "action": "hash",
                            "data": item["specifications"],
                            "algorithm": "sha256"
                        },
                        timestamp=datetime.now()
                    )
                    self.agents["hasher"].receive_message(message)
                    item["verified"] = True
    
    def _repair_damaged_systems(self):
        """Coordinate repair operations."""
        if "repair" in self.agents:
            # Check for systems needing repair
            for system in self._identify_damaged_systems():
                message = ElderMessage(
                    message_type=MessageType.REPAIR_REQUEST,
                    sender=self.name,
                    recipient="repair",
                    payload={
                        "target": system["name"],
                        "type": system["damage_type"],
                        "parameters": system.get("repair_params", {})
                    },
                    timestamp=datetime.now()
                )
                self.agents["repair"].receive_message(message)
    
    def _identify_damaged_systems(self) -> list:
        """Identify systems that need repair."""
        # Placeholder for damage detection logic
        return []
    
    def start_construction(self, project_type: str, specifications: Dict[str, Any]) -> str:
        """Start a new construction project."""
        project_id = f"forge_{datetime.now().timestamp()}"
        project = {
            "id": project_id,
            "type": project_type,
            "specifications": specifications,
            "status": "in_progress",
            "progress": 0,
            "started_at": datetime.now()
        }
        self.construction_projects[project_id] = project
        return project_id
    
    def create_blueprint(self, blueprint_name: str, design: Dict[str, Any]):
        """Create a construction blueprint."""
        self.blueprints[blueprint_name] = {
            "name": blueprint_name,
            "design": design,
            "created_at": datetime.now(),
            "version": "1.0"
        }
    
    def handle_message(self, message: ElderMessage) -> None:
        """Handle construction-related messages."""
        if message.message_type == MessageType.DIRECTIVE:
            action = message.payload.get("action")
            if action == "build":
                item_type = message.payload.get("type")
                specs = message.payload.get("specifications", {})
                self.start_construction(item_type, specs)
            elif action == "create_blueprint":
                name = message.payload.get("name")
                design = message.payload.get("design", {})
                if name is not None:
                    self.create_blueprint(name, design)
                else:
                    # Optionally, handle the error or log a warning here
                    pass
        elif message.message_type == MessageType.REPAIR_REQUEST:
            # Forward to repair agent
            if "repair" in self.agents:
                self.agents["repair"].receive_message(message)
    
    def register_connected_agents(self, agents: Dict[str, Any]) -> None:
        """Register repair, infiltrator, and hasher agents."""
        self.agents = {
            "repair": agents.get("repair"),
            "infiltrator": agents.get("infiltrator"),
            "hasher": agents.get("hasher")
        }
    
    def report_status(self) -> Dict[str, Any]:
        """Return builder status."""
        return {
            "name": self.name,
            "role": "Builder",
            "active_projects": len([p for p in self.construction_projects.values() if p["status"] == "in_progress"]),
            "completed_projects": len([p for p in self.construction_projects.values() if p["status"] == "completed"]),
            "blueprints": len(self.blueprints),
            "built_items": len(self.built_items),
            "connected_agents": list(self.agents.keys())
        }
    
    def get_supported_message_types(self) -> list:
        """Return supported message types."""
        return [
            MessageType.DIRECTIVE,
            MessageType.REPAIR_REQUEST,
            MessageType.STATUS_REQUEST,
            MessageType.BUILD_REQUEST,
            MessageType.BLUEPRINT_REQUEST,
            MessageType.CONSTRUCTION_STATUS,
            MessageType.REPAIR_STATUS,
            MessageType.HASH_REQUEST,
            MessageType.HASH_RESPONSE,
            MessageType.VERIFICATION_REQUEST,
            MessageType.VERIFICATION_RESPONSE,
            MessageType.CONSTRUCTION_ALERT,
            MessageType.REPAIR_ALERT,
            MessageType.BLUEPRINT_ALERT,
            MessageType.BUILD_ALERT,
            MessageType.DIRECTIVE_RESPONSE,
            MessageType.STATUS_RESPONSE,
            MessageType.AGENT_CONNECTION_REQUEST,
            MessageType.AGENT_CONNECTION_RESPONSE,
            MessageType.AGENT_DISCONNECTION_REQUEST,
            MessageType.AGENT_DISCONNECTION_RESPONSE,
            MessageType.AGENT_STATUS_REQUEST,
            MessageType.AGENT_STATUS_RESPONSE,
            MessageType.AGENT_ALERT,
            MessageType.AGENT_NOTIFICATION,
            MessageType.AGENT_DIRECTIVE,
            MessageType.AGENT_RESPONSE,
            MessageType.AGENT_STATUS_UPDATE,
            MessageType.AGENT_STATUS_NOTIFICATION,
            MessageType.AGENT_STATUS_ALERT,
            MessageType.AGENT_STATUS_REPORT,    
        ]
