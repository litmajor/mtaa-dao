# agents/base.py
from abc import ABC, abstractmethod
from typing import Dict, Any
from messaging import ElderMessage

class Elder(ABC):
    """Base class for all agents in the Elder Council system."""
    
    def __init__(self, name: str):
        self.name = name
        self.status = "idle"
        self.last_activity = None
        
    @abstractmethod
    def tick(self) -> None:
        """Core execution logic per loop."""
        pass
    
    @abstractmethod
    def receive_message(self, message: ElderMessage) -> None:
        """Handle incoming messages."""
        pass
    
    def get_status(self) -> Dict[str, Any]:
        """
        Return current agent status."""
        return {
            "name": self.name,
            "status": self.status,
            "last_activity": self.last_activity
        }
    def set_status(self, status: str) -> None:
        """Set the current status of the agent."""
        self.status = status
        self.last_activity = None   # Update last activity timestamp if needed  
    def update_last_activity(self, timestamp: Any) -> None:
        """Update the last activity timestamp."""
        self.last_activity = timestamp 
    def __str__(self) -> str:
        """String representation of the agent."""
        return f"Agent(name={self.name}, status={self.status})"
    def __repr__(self) -> str:
        """String representation for debugging."""
        return f"<BaseAgent name={self.name} status={self.status}>"
    def handle_message(self, message: ElderMessage) -> None:
        """Default message handler."""
        print(f"{self.name} received message: {message}")
        # Default behavior can be overridden by subclasses
        self.update_last_activity(message.timestamp)
    def send_message(self, recipient: str, payload: Dict[str, Any]) -> ElderMessage:
        """Send a message to another agent."""
        from datetime import datetime
        message = ElderMessage(
            message_type=payload.get("message_type", "DIRECTIVE"),
            sender=self.name,
            recipient=recipient,
            payload=payload,
            timestamp=self.last_activity if self.last_activity is not None else datetime.now()
        )
        # Here you would typically send the message to a messaging system
        print(f"{self.name} sending message to {recipient}: {payload}")
        return message
    def register_connected_agents(self, agents: Dict[str, Any]) -> None:
        """Register connected agents."""
        self.connected_agents = agents
        print(f"{self.name} registered connected agents: {list(agents.keys())}")
    def report_status(self) -> Dict[str, Any]:
        """Return current status of the agent."""
        return {
            "name": self.name,
            "status": self.status,
            "last_activity": self.last_activity,
            "connected_agents": list(self.connected_agents.keys()) if hasattr(self, 'connected_agents') else []
        }   
    def get_supported_message_types(self) -> list:
        """Return list of supported message types."""
        return [
            "DIRECTIVE",
            "STATUS_REQUEST",
            "STATUS_REPORT"
        ]   
    def get_description(self) -> str:
        """Return a description of the agent's role."""
        return f"{self.name} - Base agent class for Elder Council system."
    def get_name(self) -> str:
        """Return the name of the agent."""
        return self.name    