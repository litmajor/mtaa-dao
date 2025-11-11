#!/usr/bin/env python3
"""
🛡️ GATEWAY Agent Implementation (AGT-GATEWAY)
Complete secure boundary controller for autonomous network ecosystem
"""

import asyncio
import json
import time
import hashlib
import hmac
import struct
import logging
import yaml
from typing import Dict, List, Optional, Tuple, Any, Set
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict, deque
import socket
import ssl
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
import secrets
import re
import ipaddress

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('GATEWAY')

class TrustLevel(Enum):
    UNKNOWN = 0
    SUSPICIOUS = 1
    NEUTRAL = 5
    TRUSTED = 8
    ELDER = 10

class ProtocolType(Enum):
    ECL = "ECL"  # Internal Elder Communication Language
    NODELINK = "NODELINK"
    HTTP = "HTTP"
    HTTPS = "HTTPS"
    MQTT = "MQTT"
    GRPC = "GRPC"
    WEBSOCKET = "WS"

class GatewayState(Enum):
    INITIALIZING = "INIT"
    ACTIVE = "ACTIVE"
    DEGRADED = "DEGRADED"
    FAILOVER = "FAILOVER"
    SHUTDOWN = "SHUTDOWN"

@dataclass
class TrafficMetrics:
    """Real-time traffic analysis metrics"""
    requests_per_second: float = 0.0
    failed_attempts: int = 0
    blocked_ips: Set[str] = field(default_factory=set)
    active_connections: int = 0
    bandwidth_usage: float = 0.0
    last_attack_time: Optional[float] = None

@dataclass
class SecurityToken:
    """Secure authentication token"""
    token_id: str
    issuer: str
    subject: str
    issued_at: float
    expires_at: float
    permissions: List[str]
    signature: str
    
    def is_valid(self) -> bool:
        return time.time() < self.expires_at
    
    def is_expired(self) -> bool:
        return time.time() >= self.expires_at

@dataclass
class ConnectionContext:
    """Context for each connection"""
    connection_id: str
    source_ip: str
    protocol: ProtocolType
    trust_level: TrustLevel
    established_at: float
    last_activity: float
    bytes_transferred: int = 0
    request_count: int = 0
    token: Optional[SecurityToken] = None

class RateLimiter:
    """Advanced rate limiting with multiple algorithms"""
    
    def __init__(self, max_rps: int = 500, burst_limit: int = 1000, window_size: int = 60):
        self.max_rps = max_rps
        self.burst_limit = burst_limit
        self.window_size = window_size
        self.requests = defaultdict(deque)
        self.violations = defaultdict(int)
        self.banned_ips = set()
        
    def is_allowed(self, client_ip: str) -> bool:
        """Check if request is allowed based on rate limits"""
        if client_ip in self.banned_ips:
            return False
            
        now = time.time()
        client_requests = self.requests[client_ip]
        
        # Clean old requests
        while client_requests and client_requests[0] < now - self.window_size:
            client_requests.popleft()
        
        # Check rate limits
        if len(client_requests) >= self.burst_limit:
            self.violations[client_ip] += 1
            if self.violations[client_ip] >= 3:
                self.banned_ips.add(client_ip)
                logger.warning(f"IP {client_ip} banned for rate limit violations")
            return False
        
        # Check RPS
        recent_requests = sum(1 for req_time in client_requests if req_time > now - 1)
        if recent_requests >= self.max_rps:
            return False
        
        client_requests.append(now)
        return True
    
    def unban_ip(self, client_ip: str):
        """Remove IP from ban list"""
        self.banned_ips.discard(client_ip)
        self.violations[client_ip] = 0

class TrustEngine:
    """Dynamic trust evaluation system"""
    
    def __init__(self):
        self.trust_scores = defaultdict(float)
        self.behavior_patterns = defaultdict(list)
        self.known_elders = set()
        self.trusted_networks = [
            ipaddress.IPv4Network('10.0.0.0/8'),
            ipaddress.IPv4Network('172.16.0.0/12'),
            ipaddress.IPv4Network('192.168.0.0/16')
        ]
    
    def evaluate_trust(self, ip: str, behavior_data: Dict) -> TrustLevel:
        """Evaluate trust level based on IP and behavior"""
        try:
            ip_obj = ipaddress.IPv4Address(ip)
            
            # Check if IP is in trusted networks
            for network in self.trusted_networks:
                if ip_obj in network:
                    return TrustLevel.TRUSTED
        except:
            pass
        
        # Check elder status
        if ip in self.known_elders:
            return TrustLevel.ELDER
        
        # Analyze behavior patterns
        base_score = self.trust_scores.get(ip, 5.0)
        
        # Adjust based on recent behavior
        if behavior_data.get('failed_auth_attempts', 0) > 3:
            base_score -= 2
        if behavior_data.get('malformed_requests', 0) > 5:
            base_score -= 3
        if behavior_data.get('successful_requests', 0) > 10:
            base_score += 1
        
        self.trust_scores[ip] = max(0, min(10, base_score))
        
        if base_score <= 2:
            return TrustLevel.SUSPICIOUS
        elif base_score <= 4:
            return TrustLevel.UNKNOWN
        elif base_score <= 7:
            return TrustLevel.NEUTRAL
        else:
            return TrustLevel.TRUSTED

class ProtocolTranslator:
    """Protocol translation and adaptation layer"""
    
    def __init__(self):
        self.translators = {
            (ProtocolType.HTTP, ProtocolType.ECL): self._http_to_ecl,
            (ProtocolType.ECL, ProtocolType.HTTP): self._ecl_to_http,
            (ProtocolType.MQTT, ProtocolType.NODELINK): self._mqtt_to_nodelink,
            (ProtocolType.GRPC, ProtocolType.ECL): self._grpc_to_ecl,
        }
    
    def translate(self, data: bytes, from_protocol: ProtocolType, to_protocol: ProtocolType) -> bytes:
        """Translate data between protocols"""
        translator = self.translators.get((from_protocol, to_protocol))
        if not translator:
            raise ValueError(f"No translator available for {from_protocol} -> {to_protocol}")
        
        return translator(data)
    
    def _http_to_ecl(self, data: bytes) -> bytes:
        """Convert HTTP request to ECL format"""
        try:
            http_data = data.decode('utf-8')
            lines = http_data.split('\r\n')
            method, path, version = lines[0].split(' ', 2)
            
            # Extract headers
            headers = {}
            body_start = 0
            for i, line in enumerate(lines[1:], 1):
                if line == '':
                    body_start = i + 1
                    break
                if ':' in line:
                    key, value = line.split(':', 1)
                    headers[key.strip()] = value.strip()
            
            # Extract body
            body = '\r\n'.join(lines[body_start:]) if body_start < len(lines) else ''
            
            # Convert to ECL format
            ecl_message = {
                'type': 'REQUEST',
                'method': method,
                'resource': path,
                'headers': headers,
                'payload': body,
                'timestamp': time.time()
            }
            
            return json.dumps(ecl_message).encode('utf-8')
        except Exception as e:
            logger.error(f"HTTP to ECL translation failed: {e}")
            raise
    
    def _ecl_to_http(self, data: bytes) -> bytes:
        """Convert ECL response to HTTP format"""
        try:
            ecl_data = json.loads(data.decode('utf-8'))
            
            status_code = ecl_data.get('status', 200)
            status_text = ecl_data.get('status_text', 'OK')
            headers = ecl_data.get('headers', {})
            payload = ecl_data.get('payload', '')
            
            # Build HTTP response
            response_lines = [f"HTTP/1.1 {status_code} {status_text}"]
            
            # Add headers
            for key, value in headers.items():
                response_lines.append(f"{key}: {value}")
            
            # Add content length
            if payload:
                response_lines.append(f"Content-Length: {len(payload)}")
            
            response_lines.append('')  # Empty line before body
            if payload:
                response_lines.append(payload)
            
            return '\r\n'.join(response_lines).encode('utf-8')
        except Exception as e:
            logger.error(f"ECL to HTTP translation failed: {e}")
            raise
    
    def _mqtt_to_nodelink(self, data: bytes) -> bytes:
        """Convert MQTT message to NodeLink format"""
        # Simplified MQTT to NodeLink conversion
        nodelink_msg = {
            'type': 'NODE_MESSAGE',
            'payload': data.hex(),
            'encoding': 'hex',
            'timestamp': time.time()
        }
        return json.dumps(nodelink_msg).encode('utf-8')
    
    def _grpc_to_ecl(self, data: bytes) -> bytes:
        """Convert gRPC message to ECL format"""
        # Simplified gRPC to ECL conversion
        ecl_msg = {
            'type': 'RPC_CALL',
            'payload': data.hex(),
            'encoding': 'hex',
            'timestamp': time.time()
        }
        return json.dumps(ecl_msg).encode('utf-8')

class CryptoEngine:
    """Cryptographic operations for secure channels"""
    
    def __init__(self):
        self.private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048
        )
        self.public_key = self.private_key.public_key()
        self.session_keys = {}
    
    def generate_session_key(self, connection_id: str) -> bytes:
        """Generate symmetric session key"""
        key = secrets.token_bytes(32)  # 256-bit key
        self.session_keys[connection_id] = key
        return key
    
    def encrypt_data(self, data: bytes, connection_id: str) -> bytes:
        """Encrypt data using session key"""
        if connection_id not in self.session_keys:
            raise ValueError(f"No session key for connection {connection_id}")
        
        key = self.session_keys[connection_id]
        iv = secrets.token_bytes(16)  # 128-bit IV
        
        cipher = Cipher(algorithms.AES(key), modes.CBC(iv))
        encryptor = cipher.encryptor()
        
        # Pad data to block size
        padding_length = 16 - (len(data) % 16)
        padded_data = data + bytes([padding_length] * padding_length)
        
        encrypted_data = encryptor.update(padded_data) + encryptor.finalize()
        
        return iv + encrypted_data
    
    def decrypt_data(self, encrypted_data: bytes, connection_id: str) -> bytes:
        """Decrypt data using session key"""
        if connection_id not in self.session_keys:
            raise ValueError(f"No session key for connection {connection_id}")
        
        key = self.session_keys[connection_id]
        iv = encrypted_data[:16]
        ciphertext = encrypted_data[16:]
        
        cipher = Cipher(algorithms.AES(key), modes.CBC(iv))
        decryptor = cipher.decryptor()
        
        padded_data = decryptor.update(ciphertext) + decryptor.finalize()
        
        # Remove padding
        padding_length = padded_data[-1]
        return padded_data[:-padding_length]
    
    def sign_token(self, token_data: Dict) -> str:
        """Sign authentication token"""
        token_json = json.dumps(token_data, sort_keys=True)
        signature = self.private_key.sign(
            token_json.encode('utf-8'),
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.MAX_LENGTH
            ),
            hashes.SHA256()
        )
        return signature.hex()
    
    def verify_token(self, token_data: Dict, signature: str) -> bool:
        """Verify authentication token signature"""
        try:
            token_json = json.dumps(token_data, sort_keys=True)
            signature_bytes = bytes.fromhex(signature)
            
            self.public_key.verify(
                signature_bytes,
                token_json.encode('utf-8'),
                padding.PSS(
                    mgf=padding.MGF1(hashes.SHA256()),
                    salt_length=padding.PSS.MAX_LENGTH
                ),
                hashes.SHA256()
            )
            return True
        except Exception:
            return False

class PacketInspector:
    """Deep packet inspection for anomaly detection"""
    
    def __init__(self):
        self.suspicious_patterns = [
            rb'<script',
            rb'SELECT.*FROM',
            rb'DROP TABLE',
            rb'../../../',
            rb'eval\(',
            rb'exec\(',
        ]
        self.max_packet_size = 1024 * 1024  # 1MB
    
    def inspect_packet(self, data: bytes, source_ip: str) -> Tuple[bool, List[str]]:
        """Inspect packet for malicious content"""
        issues = []
        
        # Size check
        if len(data) > self.max_packet_size:
            issues.append("Oversized packet")
        
        # Pattern matching
        for pattern in self.suspicious_patterns:
            if pattern in data.lower():
                issues.append(f"Suspicious pattern detected: {pattern.decode('utf-8', errors='ignore')}")
        
        # Protocol validation
        if not self._validate_protocol_structure(data):
            issues.append("Malformed protocol structure")
        
        # Rate of suspicious activity
        if len(issues) > 0:
            logger.warning(f"Packet inspection issues from {source_ip}: {issues}")
        
        return len(issues) == 0, issues
    
    def _validate_protocol_structure(self, data: bytes) -> bool:
        """Basic protocol structure validation"""
        try:
            # Try to decode as text protocols first
            text_data = data.decode('utf-8', errors='ignore')
            
            # Check for basic HTTP structure
            if text_data.startswith(('GET ', 'POST ', 'PUT ', 'DELETE ')):
                return '\r\n\r\n' in text_data or '\n\n' in text_data
            
            # Check for JSON structure
            if text_data.strip().startswith('{'):
                json.loads(text_data)
                return True
            
            # If not text-based, assume binary protocol is valid
            return True
        except:
            return False

class GatewayAgent:
    """Main Gateway Agent implementation"""
    
    def __init__(self, config_path: str = None):
        self.agent_id = f"GATEWAY-{secrets.token_hex(4).upper()}"
        self.state = GatewayState.INITIALIZING
        self.config = self._load_config(config_path)
        
        # Initialize components
        self.rate_limiter = RateLimiter(
            max_rps=self.config.get('rate_limit', {}).get('max_rps', 500),
            burst_limit=self.config.get('rate_limit', {}).get('burst_limit', 1000)
        )
        self.trust_engine = TrustEngine()
        self.protocol_translator = ProtocolTranslator()
        self.crypto_engine = CryptoEngine()
        self.packet_inspector = PacketInspector()
        
        # Runtime state
        self.active_connections = {}
        self.metrics = TrafficMetrics()
        self.failover_gateways = self.config.get('failover', {}).get('backups', [])
        
        logger.info(f"Gateway Agent {self.agent_id} initialized")
    
    def _load_config(self, config_path: str = None) -> Dict:
        """Load configuration from file or use defaults"""
        default_config = {
            'agent_id': self.agent_id,
            'roles': ['firewall', 'proxy', 'authenticator', 'translator'],
            'trust_model': 'decentralized',
            'token_policy': {
                'expiry': 30,
                'issuer': 'ELD-LUMEN',
                'verify_with': '/keys/public.pem'
            },
            'rate_limit': {
                'max_rps': 500,
                'burst_limit': 1000,
                'ban_threshold': 3
            },
            'failover': {
                'backups': ['GATEWAY-OMEGA-02', 'GATEWAY-BETA-01'],
                'auto_redirect': True
            },
            'protocols_supported': {
                'internal': ['ECL', 'NODELINK'],
                'external': ['HTTP', 'MQTT', 'GRPC']
            },
            'listen_port': 8080,
            'ssl_enabled': True
        }
        
        if config_path:
            try:
                with open(config_path, 'r') as f:
                    user_config = yaml.safe_load(f)
                    default_config.update(user_config)
            except Exception as e:
                logger.warning(f"Could not load config from {config_path}: {e}")
        
        return default_config
    
    async def start(self):
        """Start the Gateway Agent"""
        logger.info(f"Starting Gateway Agent {self.agent_id}")
        self.state = GatewayState.ACTIVE
        
        # Start the main server
        server = await asyncio.start_server(
            self._handle_connection,
            '0.0.0.0',
            self.config['listen_port']
        )
        
        # Start background tasks
        asyncio.create_task(self._metrics_collector())
        asyncio.create_task(self._health_monitor())
        asyncio.create_task(self._token_cleanup())
        
        logger.info(f"Gateway listening on port {self.config['listen_port']}")
        
        async with server:
            await server.serve_forever()
      async def _handle_connection(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        """Handle incoming connection"""
        client_addr = writer.get_extra_info('peername')
        client_ip = client_addr[0] if client_addr else 'unknown'
        connection_id = f"conn_{secrets.token_hex(8)}"
        
        logger.info(f"New connection from {client_ip} ({connection_id})")
        
        try:
            # Rate limiting check
            if not self.rate_limiter.is_allowed(client_ip):
                logger.warning(f"Rate limit exceeded for {client_ip}")
                writer.close()
                await writer.wait_closed()
                return
            
            # Create connection context
            context = ConnectionContext(
                connection_id=connection_id,
                source_ip=client_ip,
                protocol=ProtocolType.HTTP,  # Default, will be detected
                trust_level=self.trust_engine.evaluate_trust(client_ip, {}),
                established_at=time.time(),
                last_activity=time.time()
            )
            
            self.active_connections[connection_id] = context
            self.metrics.active_connections += 1
            
            # Generate session key
            session_key = self.crypto_engine.generate_session_key(connection_id)
            
            # Handle the connection
            await self._process_connection(reader, writer, context)
            
        except Exception as e:
            logger.error(f"Error handling connection {connection_id}: {e}")
        finally:
            # Cleanup
            if connection_id in self.active_connections:
                del self.active_connections[connection_id]
                self.metrics.active_connections -= 1
            
            try:
                writer.close()
                await writer.wait_closed()
            except:
                pass
    
   async def _process_connection(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter, context: ConnectionContext):
        """Process the actual connection data"""
        buffer = b''
        
        while True:
            try:
                # Read data with timeout
                data = await asyncio.wait_for(reader.read(4096), timeout=30.0)
                if not data:
                    break
                
                buffer += data
                context.last_activity = time.time()
                context.bytes_transferred += len(data)
                
                # Packet inspection
                is_clean, issues = self.packet_inspector.inspect_packet(data, context.source_ip)
                if not is_clean:
                    logger.warning(f"Blocked suspicious packet from {context.source_ip}: {issues}")
                    await self._send_error_response(writer, 403, "Forbidden")
                    break
                
                # Detect protocol
                detected_protocol = self._detect_protocol(buffer)
                if detected_protocol:
                    context.protocol = detected_protocol
                
                # Check if we have a complete message
                if self._is_complete_message(buffer, context.protocol):
                    # Process the message
                    response = await self._process_message(buffer, context)
                    
                    if response:
                        writer.write(response)
                        await writer.drain()
                    
                    buffer = b''
                    context.request_count += 1
                
            except asyncio.TimeoutError:
                logger.info(f"Connection {context.connection_id} timed out")
                break
            except Exception as e:
                logger.error(f"Error processing connection {context.connection_id}: {e}")
                break
    
    def _detect_protocol(self, data: bytes) -> Optional[ProtocolType]:
        """Detect protocol from data"""
        try:
            text_data = data.decode('utf-8', errors='ignore')
            
            if text_data.startswith(('GET ', 'POST ', 'PUT ', 'DELETE ', 'HEAD ', 'OPTIONS ')):
                return ProtocolType.HTTP
            elif text_data.strip().startswith('{"type":'):
                # Check for ECL format
                try:
                    parsed = json.loads(text_data.strip())
                    if 'type' in parsed and parsed['type'] in ['REQUEST', 'RESPONSE', 'NODE_MESSAGE']:
                        return ProtocolType.ECL
                except:
                    pass
            elif data.startswith(b'\x00\x00\x00'):
                # gRPC typically starts with length prefix
                return ProtocolType.GRPC
        except:
            pass
        
        return None
    
    def _is_complete_message(self, data: bytes, protocol: ProtocolType) -> bool:
        """Check if we have a complete message"""
        if protocol == ProtocolType.HTTP:
            return b'\r\n\r\n' in data
        elif protocol == ProtocolType.ECL:
            try:
                json.loads(data.decode('utf-8'))
                return True
            except:
                return False
        
        return len(data) > 0  # For other protocols, assume any data is complete
    
    async def _process_message(self, data: bytes, context: ConnectionContext) -> Optional[bytes]:
        """Process a complete message"""
        try:
            # Authentication check
            if context.trust_level in [TrustLevel.UNKNOWN, TrustLevel.SUSPICIOUS]:
                token = self._extract_token(data)
                if not token or not self._validate_token(token):
                    return await self._create_error_response(401, "Unauthorized")
            
            # Protocol translation if needed
            if context.protocol != ProtocolType.ECL:
                try:
                    translated_data = self.protocol_translator.translate(
                        data, context.protocol, ProtocolType.ECL
                    )
                except Exception as e:
                    logger.error(f"Protocol translation failed: {e}")
                    return await self._create_error_response(400, "Protocol Translation Failed")
            else:
                translated_data = data
            
            # Forward to internal system (simulation)
            response_data = await self._forward_to_internal_system(translated_data, context)
            
            # Translate response back if needed
            if context.protocol != ProtocolType.ECL:
                try:
                    response_data = self.protocol_translator.translate(
                        response_data, ProtocolType.ECL, context.protocol
                    )
                except Exception as e:
                    logger.error(f"Response translation failed: {e}")
                    return await self._create_error_response(500, "Response Translation Failed")
            
            return response_data
            
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            return await self._create_error_response(500, "Internal Server Error")
    
    def _extract_token(self, data: bytes) -> Optional[str]:
        """Extract authentication token from request"""
        try:
            if data.startswith(b'GET ') or data.startswith(b'POST '):
                # HTTP request - look for Authorization header
                text_data = data.decode('utf-8', errors='ignore')
                for line in text_data.split('\r\n'):
                    if line.lower().startswith('authorization:'):
                        return line.split(':', 1)[1].strip()
            else:
                # JSON format - look for token field
                try:
                    parsed = json.loads(data.decode('utf-8'))
                    return parsed.get('token')
                except:
                    pass
        except:
            pass
        
        return None
    
    def _validate_token(self, token_str: str) -> bool:
        """Validate authentication token"""
        try:
            # Parse token (simplified)
            parts = token_str.split('.')
            if len(parts) != 3:
                return False
            
            # In real implementation, would verify JWT or custom token format
            return True
        except:
            return False
    
    async def _forward_to_internal_system(self, data: bytes, context: ConnectionContext) -> bytes:
        """Forward request to internal system (simulated)"""
        # This would connect to actual internal agents/elders
        # For now, simulate a response
        
        try:
            request = json.loads(data.decode('utf-8'))
            
            response = {
                'type': 'RESPONSE',
                'status': 200,
                'status_text': 'OK',
                'headers': {
                    'Content-Type': 'application/json',
                    'X-Gateway-ID': self.agent_id,
                    'X-Connection-ID': context.connection_id
                },
                'payload': {
                    'message': 'Request processed successfully',
                    'echo': request,
                    'timestamp': time.time()
                }
            }
            
            return json.dumps(response).encode('utf-8')
            
        except Exception as e:
            error_response = {
                'type': 'RESPONSE',
                'status': 500,
                'status_text': 'Internal Server Error',
                'headers': {'Content-Type': 'application/json'},
                'payload': {'error': str(e)}
            }
            return json.dumps(error_response).encode('utf-8')
    
    async def _create_error_response(self, status_code: int, message: str) -> bytes:
        """Create error response"""
        response = {
            'type': 'RESPONSE',
            'status': status_code,
            'status_text': message,
            'headers': {'Content-Type': 'application/json'},
            'payload': {'error': message}
        }
        return json.dumps(response).encode('utf-8')
    
    async def _send_error_response(self, writer: asyncio.StreamWriter, status_code: int, message: str):
        """Send HTTP error response"""
        response = f"HTTP/1.1 {status_code} {message}\r\nContent-Length: 0\r\n\r\n"
        writer.write(response.encode('utf-8'))
        await writer.drain()
    
    async def _metrics_collector(self):
        """Collect and update metrics"""
        while self.state == GatewayState.ACTIVE:
            try:
                # Update RPS calculation
                current_time = time.time()
                total_requests = sum(len(deq) for deq in self.rate_limiter.requests.values())
                recent_requests = 0
                
                for deq in self.rate_limiter.requests.values():
                    recent_requests += sum(1 for req_time in deq if req_time > current_time - 1)
                
                self.metrics.requests_per_second = recent_requests
                
                # Log metrics
                logger.info(f"Metrics - RPS: {self.metrics.requests_per_second:.2f}, "
                          f"Active Connections: {self.metrics.active_connections}, "
                          f"Blocked IPs: {len(self.rate_limiter.banned_ips)}")
                
                await asyncio.sleep(10)  # Update every 10 seconds
                
            except Exception as e:
                logger.error(f"Metrics collection error: {e}")
                await asyncio.sleep(5)


    #!/usr/bin/env python3
"""
🛡️ GATEWAY Agent Implementation - Continuation
Health monitoring, failover, and operational components
"""

    async def _health_monitor(self):
        """Monitor system health and trigger failover if needed"""
        while self.state in [GatewayState.ACTIVE, GatewayState.DEGRADED]:
            try:
                # Check system health
                if self.metrics.requests_per_second > 1000:  # High load
                    if self.state == GatewayState.ACTIVE:
                        logger.warning("System under high load, switching to degraded mode")
                        self.state = GatewayState.DEGRADED
                
                # Check for sustained attacks
                banned_count = len(self.rate_limiter.banned_ips)
                if banned_count > 100:  # Too many banned IPs indicates attack
                    logger.critical(f"Potential DDoS attack detected - {banned_count} banned IPs")
                    await self._trigger_failover()
                
                # Memory and connection health
                if self.metrics.active_connections > 10000:
                    logger.warning("Connection limit approaching, may need load balancing")
                
                # Recovery check
                if (self.state == GatewayState.DEGRADED and 
                    self.metrics.requests_per_second < 500 and 
                    banned_count < 50):
                    logger.info("System recovered, returning to active mode")
                    self.state = GatewayState.ACTIVE
                
                await asyncio.sleep(30)  # Check every 30 seconds
                
            except Exception as e:
                logger.error(f"Health monitoring error: {e}")
                await asyncio.sleep(15)
    
    async def _token_cleanup(self):
        """Clean up expired tokens and session keys"""
        while self.state != GatewayState.SHUTDOWN:
            try:
                current_time = time.time()
                
                # Clean up old session keys for inactive connections
                expired_connections = []
                for conn_id, context in self.active_connections.items():
                    if current_time - context.last_activity > 300:  # 5 minutes inactive
                        expired_connections.append(conn_id)
                
                for conn_id in expired_connections:
                    if conn_id in self.crypto_engine.session_keys:
                        del self.crypto_engine.session_keys[conn_id]
                    logger.info(f"Cleaned up expired session for {conn_id}")
                
                # Clean up rate limiter data
                cutoff_time = current_time - 3600  # 1 hour ago
                for ip in list(self.rate_limiter.requests.keys()):
                    deq = self.rate_limiter.requests[ip]
                    while deq and deq[0] < cutoff_time:
                        deq.popleft()
                    if not deq:
                        del self.rate_limiter.requests[ip]
                
                await asyncio.sleep(60)  # Cleanup every minute
                
            except Exception as e:
                logger.error(f"Token cleanup error: {e}")
                await asyncio.sleep(30)
    
    async def _trigger_failover(self):
        """Trigger failover to backup gateway"""
        if not self.config.get('failover', {}).get('auto_redirect', False):
            logger.warning("Failover needed but auto_redirect disabled")
            return
        
        logger.critical("Triggering failover sequence")
        self.state = GatewayState.FAILOVER
        
        # In a real implementation, this would:
        # 1. Notify load balancer to redirect traffic
        # 2. Transfer state to backup gateway
        # 3. Gracefully close existing connections
        
        # Simulate notifying backup systems
        await self._notify_backup_gateways()
        
        # Graceful shutdown of new connections
        logger.info("Rejecting new connections during failover")
    
    async def _notify_backup_gateways(self):
        """Notify backup gateways to take over"""
        for backup_id in self.failover_gateways:
            try:
                # In real implementation, would send actual network message
                logger.info(f"Notifying backup gateway {backup_id} to take over")
                
                # Simulate backup notification
                notification = {
                    'type': 'FAILOVER_REQUEST',
                    'source_gateway': self.agent_id,
                    'timestamp': time.time(),
                    'active_connections': len(self.active_connections),
                    'metrics': {
                        'rps': self.metrics.requests_per_second,
                        'banned_ips': len(self.rate_limiter.banned_ips)
                    }
                }
                
                logger.info(f"Failover notification sent to {backup_id}: {notification}")
                
            except Exception as e:
                logger.error(f"Failed to notify backup {backup_id}: {e}")
    def get_status(self) -> Dict[str, Any]:
        """Get current gateway status"""
        return {
            'agent_id': self.agent_id,
            'state': self.state.value,
            'metrics': {
                'requests_per_second': self.metrics.requests_per_second,
                'active_connections': self.metrics.active_connections,
                'banned_ips': len(self.rate_limiter.banned_ips),
                'total_requests': sum(len(deq) for deq in self.rate_limiter.requests.values())
            },
            'uptime': time.time() - getattr(self, '_start_time', time.time()),
            'trust_scores': dict(list(self.trust_engine.trust_scores.items())[:10]),  # Top 10
            'config': {
                'max_rps': self.rate_limiter.max_rps,
                'burst_limit': self.rate_limiter.burst_limit,
                'protocols': self.config.get('protocols_supported', {}),
                'failover_enabled': self.config.get('failover', {}).get('auto_redirect', False)
            }
        }
    
    async def shutdown(self):
        """Graceful shutdown"""
        logger.info(f"Shutting down Gateway Agent {self.agent_id}")
        self.state = GatewayState.SHUTDOWN
        
        # Close all active connections
        for conn_id, context in list(self.active_connections.items()):
            logger.info(f"Closing connection {conn_id}")
            # In real implementation, would properly close connection
        
        self.active_connections.clear()
        self.crypto_engine.session_keys.clear()
        
        logger.info("Gateway Agent shutdown complete")


class GatewayCluster:
    """Manages multiple gateway instances for high availability"""
    
    def __init__(self, cluster_config: Dict):
        self.cluster_id = cluster_config.get('cluster_id', f"CLUSTER-{secrets.token_hex(4).upper()}")
        self.gateways = {}
        self.load_balancer = LoadBalancer()
        self.config = cluster_config
        
    async def start_cluster(self):
        """Start the gateway cluster"""
        logger.info(f"Starting Gateway Cluster {self.cluster_id}")
        
        # Start primary gateways
        for i in range(self.config.get('primary_gateways', 2)):
            gateway_config = self.config.copy()
            gateway_config['listen_port'] = 8080 + i
            
            gateway = GatewayAgent()
            gateway.config = gateway_config
            self.gateways[gateway.agent_id] = gateway
            
            # Start gateway in background
            asyncio.create_task(gateway.start())
        
        # Start load balancer
        await self.load_balancer.start(list(self.gateways.keys()))
        
        logger.info(f"Cluster {self.cluster_id} started with {len(self.gateways)} gateways")
    
    def get_cluster_status(self) -> Dict:
        """Get status of entire cluster"""
        return {
            'cluster_id': self.cluster_id,
            'active_gateways': len([g for g in self.gateways.values() if g.state == GatewayState.ACTIVE]),
            'total_gateways': len(self.gateways),
            'load_balancer_status': self.load_balancer.get_status(),
            'aggregate_metrics': self._calculate_aggregate_metrics()
        }
    
    def _calculate_aggregate_metrics(self) -> Dict:
        """Calculate cluster-wide metrics"""
        total_rps = sum(g.metrics.requests_per_second for g in self.gateways.values())
        total_connections = sum(g.metrics.active_connections for g in self.gateways.values())
        total_banned = sum(len(g.rate_limiter.banned_ips) for g in self.gateways.values())
        
        return {
            'total_rps': total_rps,
            'total_connections': total_connections,
            'total_banned_ips': total_banned,
            'average_rps_per_gateway': total_rps / len(self.gateways) if self.gateways else 0
        }


class LoadBalancer:
    """Simple load balancer for gateway cluster"""
    
    def __init__(self):
        self.gateways = []
        self.current_index = 0
        self.health_status = {}
    
    async def start(self, gateway_ids: List[str]):
        """Start load balancer with gateway list"""
        self.gateways = gateway_ids
        self.health_status = {gw_id: True for gw_id in gateway_ids}
        
        # Start health checking
        asyncio.create_task(self._health_check_loop())
        
        logger.info(f"Load balancer started with {len(gateway_ids)} gateways")
    
    def get_next_gateway(self) -> Optional[str]:
        """Get next available gateway using round-robin"""
        if not self.gateways:
            return None
        
        attempts = 0
        while attempts < len(self.gateways):
            gateway_id = self.gateways[self.current_index]
            self.current_index = (self.current_index + 1) % len(self.gateways)
            
            if self.health_status.get(gateway_id, False):
                return gateway_id
            
            attempts += 1
        
        return None  # No healthy gateways
    
    async def _health_check_loop(self):
        """Periodically check gateway health"""
        while True:
            try:
                for gateway_id in self.gateways:
                    # In real implementation, would ping the gateway
                    # For now, simulate health check
                    self.health_status[gateway_id] = True
                
                await asyncio.sleep(30)  # Check every 30 seconds
                
            except Exception as e:
                logger.error(f"Health check error: {e}")
                await asyncio.sleep(10)
    
    def get_status(self) -> Dict:
        """Get load balancer status"""
        healthy_count = sum(1 for status in self.health_status.values() if status)
        return {
            'total_gateways': len(self.gateways),
            'healthy_gateways': healthy_count,
            'current_gateway_index': self.current_index,
            'health_status': self.health_status
        }

8
class GatewayMonitor:
    """Monitoring and alerting system for gateways"""
    
    def __init__(self):
        self.alerts = []
        self.metrics_history = defaultdict(list)
        self.alert_thresholds = {
            'high_rps': 800,
            'high_connections': 8000,
            'high_banned_ips': 50,
            'low_trust_percentage': 0.3
        }
    
    def check_gateway(self, gateway: GatewayAgent) -> List[str]:
        """Check gateway and return any alerts"""
        alerts = []
        status = gateway.get_status()
        
        # Check RPS
        if status['metrics']['requests_per_second'] > self.alert_thresholds['high_rps']:
            alerts.append(f"HIGH_RPS: {status['metrics']['requests_per_second']:.2f} RPS")
        
        # Check connections
        if status['metrics']['active_connections'] > self.alert_thresholds['high_connections']:
            alerts.append(f"HIGH_CONNECTIONS: {status['metrics']['active_connections']}")
        
        # Check banned IPs
        if status['metrics']['banned_ips'] > self.alert_thresholds['high_banned_ips']:
            alerts.append(f"HIGH_BANNED_IPS: {status['metrics']['banned_ips']}")
        
        # Store metrics for trending
        timestamp = time.time()
        self.metrics_history[gateway.agent_id].append({
            'timestamp': timestamp,
            'rps': status['metrics']['requests_per_second'],
            'connections': status['metrics']['active_connections'],
            'banned_ips': status['metrics']['banned_ips']
        })
        
        # Keep only last 1000 entries
        if len(self.metrics_history[gateway.agent_id]) > 1000:
            self.metrics_history[gateway.agent_id] = self.metrics_history[gateway.agent_id][-1000:]
        
        return alerts
    
    def get_trends(self, gateway_id: str, window_minutes: int = 60) -> Dict:
        """Get trending data for a gateway"""
        if gateway_id not in self.metrics_history:
            return {}
        
        cutoff_time = time.time() - (window_minutes * 60)
        recent_metrics = [
            m for m in self.metrics_history[gateway_id] 
            if m['timestamp'] > cutoff_time
        ]
        
        if not recent_metrics:
            return {}
        
        return {
            'avg_rps': sum(m['rps'] for m in recent_metrics) / len(recent_metrics),
            'max_rps': max(m['rps'] for m in recent_metrics),
            'avg_connections': sum(m['connections'] for m in recent_metrics) / len(recent_metrics),
            'max_connections': max(m['connections'] for m in recent_metrics),
            'total_banned': sum(m['banned_ips'] for m in recent_metrics),
            'data_points': len(recent_metrics)
        }


# Example usage and configuration
async def main():
    """Main function to demonstrate Gateway Agent usage"""
    
    # Configuration
    config = {
        'agent_id': 'GATEWAY-ALPHA-01',
        'listen_port': 8080,
        'rate_limit': {
            'max_rps': 1000,
            'burst_limit': 2000,
            'ban_threshold': 3
        },
        'failover': {
            'backups': ['GATEWAY-BETA-01', 'GATEWAY-GAMMA-01'],
            'auto_redirect': True
        },
        'protocols_supported': {
            'internal': ['ECL', 'NODELINK'],
            'external': ['HTTP', 'HTTPS', 'MQTT', 'GRPC']
        },
        'ssl_enabled': True,
        'trust_model': 'decentralized'
    }
    
    # Create and start gateway
    gateway = GatewayAgent()
    gateway.config = config
    
    # Create monitor
    monitor = GatewayMonitor()
    
    try:
        # Start monitoring task
        async def monitoring_loop():
            while True:
                alerts = monitor.check_gateway(gateway)
                if alerts:
                    logger.warning(f"Gateway alerts: {', '.join(alerts)}")
                
                # Log status every 30 seconds
                status = gateway.get_status()
                logger.info(f"Gateway Status: {status['state']}, "
                          f"RPS: {status['metrics']['requests_per_second']:.2f}, "
                          f"Connections: {status['metrics']['active_connections']}")
                
                await asyncio.sleep(30)
        
        # Start monitoring in background
        asyncio.create_task(monitoring_loop())
        
        # Start the gateway (this will run forever)
        await gateway.start()
        
    except KeyboardInterrupt:
        logger.info("Shutdown requested")
        await gateway.shutdown()
    except Exception as e:
        logger.error(f"Gateway error: {e}")
        await gateway.shutdown()


# Gateway Agent CLI interface
class GatewayCLI:
    """Command line interface for Gateway Agent management"""
    
    def __init__(self):
        self.gateway = None
        self.monitor = GatewayMonitor()
    
    async def start_gateway(self, config_file: str = None):
        """Start gateway with optional config file"""
        self.gateway = GatewayAgent(config_file)
        print(f"Starting Gateway Agent {self.gateway.agent_id}...")
        
        # Start monitoring
        asyncio.create_task(self._monitoring_task())
        
        await self.gateway.start()
    
    async def _monitoring_task(self):
        """Background monitoring task"""
        while self.gateway and self.gateway.state != GatewayState.SHUTDOWN:
            try:
                alerts = self.monitor.check_gateway(self.gateway)
                if alerts:
                    print(f"⚠️  ALERTS: {', '.join(alerts)}")
                
                await asyncio.sleep(30)
            except Exception as e:
                print(f"Monitoring error: {e}")
                await asyncio.sleep(10)
    
    def status(self):
        """Print current gateway status"""
        if not self.gateway:
            print("No gateway running")
            return
        
        status = self.gateway.get_status()
        print("\n🛡️ Gateway Status Report")
        print("=" * 50)
        print(f"Agent ID: {status['agent_id']}")
        print(f"State: {status['state']}")
        print(f"Uptime: {status['uptime']:.2f} seconds")
        
        print(f"\n📊 Metrics:")
        print(f"  RPS: {status['metrics']['requests_per_second']:.2f}")
        print(f"  Active Connections: {status['metrics']['active_connections']}")
        print(f"  Banned IPs: {status['metrics']['banned_ips']}")
        print(f"  Total Requests: {status['metrics']['total_requests']}")
        
        print(f"\n⚙️ Configuration:")
        print(f"  Max RPS: {status['config']['max_rps']}")
        print(f"  Burst Limit: {status['config']['burst_limit']}")
        print(f"  Failover Enabled: {status['config']['failover_enabled']}")
        
        if status['trust_scores']:
            print(f"\n🔒 Top Trust Scores:")
            for ip, score in status['trust_scores'].items():
                print(f"  {ip}: {score:.2f}")
    
    async def shutdown(self):
        """Shutdown the gateway"""
        if self.gateway:
            print(f"Shutting down Gateway {self.gateway.agent_id}...")
            await self.gateway.shutdown()
            self.gateway = None
            print("Gateway shutdown complete")
        else:
            print("No gateway running")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        if sys.argv[1] == "status":
            # Quick status check
            gateway = GatewayAgent()
            print(gateway.get_status())
        elif sys.argv[1] == "config":
            # Print default config
            gateway = GatewayAgent()
            print(yaml.dump(gateway.config, default_flow_style=False))
        else:
            print("Usage: python gateway_agent.py [status|config]")
    else:
        # Start the gateway
        asyncio.run(main())
