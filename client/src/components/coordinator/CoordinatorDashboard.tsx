/**
 * Elder Coordinator Dashboard Component
 * 
 * Visualizes real-time communication and consensus decisions from the Elder Council
 */

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, CheckCircle2, XCircle, Clock, Activity } from 'lucide-react';
import io, { Socket } from 'socket.io-client';

interface ElderAssessment {
  confidence: number;
  status: 'approved' | 'rejected' | 'pending';
}

interface ConsensusData {
  decisionId: string;
  daoId: string;
  scryAssessment: {
    isSafe: boolean;
    threatLevel: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
  };
  kaizenAssessment: {
    isBeneficial: boolean;
    improvementPotential: number;
    confidence: number;
  };
  lumenAssessment: {
    isEthical: boolean;
    ethicalScore: number;
    confidence: number;
  };
  consensusDecision: {
    canApprove: boolean;
    overallConfidence: number;
    requiresReview: boolean;
  };
  timestamp: Date;
}

interface CoordinatorStatus {
  status: 'online' | 'offline' | 'degraded';
  uptime: number;
  eldersConnected: number;
  recentDecisions: {
    total: number;
    approved: number;
    rejected: number;
  };
}

interface MessageBusEvent {
  topic: string;
  from: string;
  data: any;
  timestamp: Date;
}

export function CoordinatorDashboard() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [coordinatorStatus, setCoordinatorStatus] = useState<CoordinatorStatus | null>(null);
  const [recentConsensus, setRecentConsensus] = useState<ConsensusData[]>([]);
  const [messageBusEvents, setMessageBusEvents] = useState<MessageBusEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [selectedConsensus, setSelectedConsensus] = useState<ConsensusData | null>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const newSocket = io(window.location.origin, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    // Connection events
    newSocket.on('coordinator:connected', (data) => {
      console.log('Connected to coordinator:', data);
      setIsConnected(true);
      
      // Subscribe to all events
      newSocket.emit('coordinator:subscribe', { topic: 'coordinator:consensus' });
      newSocket.emit('coordinator:subscribe', { topic: 'coordinator:scry-alert' });
      newSocket.emit('coordinator:subscribe', { topic: 'coordinator:kaizen-recommendation' });
      newSocket.emit('coordinator:subscribe', { topic: 'coordinator:lumen-review' });
    });

    newSocket.on('coordinator:status', (data) => {
      setCoordinatorStatus(data);
    });

    newSocket.on('coordinator:consensus-response', (response) => {
      if (response.success) {
        setRecentConsensus(prev => [response.data, ...prev].slice(0, 10));
      }
    });

    newSocket.on('coordinator:consensus', (event) => {
      const consensus = event.data;
      setRecentConsensus(prev => [consensus, ...prev].slice(0, 10));
    });

    newSocket.on('message-bus:message-published', (event) => {
      const msg: MessageBusEvent = {
        topic: event.data.topic,
        from: event.data.from,
        data: event.data,
        timestamp: new Date()
      };
      setMessageBusEvents(prev => [msg, ...prev].slice(0, 20));
    });

    newSocket.on('coordinator:error', (error) => {
      console.error('Coordinator error:', error);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const getThreatColor = (level: string) => {
    switch (level) {
      case 'critical': return 'text-red-600';
      case 'high': return 'text-orange-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const getThreatBadgeVariant = (level: string) => {
    switch (level) {
      case 'critical': return 'destructive';
      case 'high': return 'secondary';
      case 'medium': return 'outline';
      case 'low': return 'default';
      default: return 'secondary';
    }
  };

  const formatUptime = (ms: number) => {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Elder Coordinator</h1>
        <p className="text-gray-500">
          Real-time communication and consensus decisions from the Elder Council
        </p>
      </div>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Coordinator Status</span>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-500'}`} />
              <span className="text-sm">{isConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {coordinatorStatus && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <Badge variant={coordinatorStatus.status === 'online' ? 'default' : 'secondary'}>
                  {coordinatorStatus.status}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">Uptime</p>
                <p className="font-mono text-sm">{formatUptime(coordinatorStatus.uptime)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Elders Connected</p>
                <p className="text-2xl font-bold">{coordinatorStatus.eldersConnected}/3</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Decisions</p>
                <p className="text-2xl font-bold">{coordinatorStatus.recentDecisions?.total || 0}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Decision Stats */}
      {coordinatorStatus && (
        <Card>
          <CardHeader>
            <CardTitle>Decision Statistics</CardTitle>
            <CardDescription>Latest consensus decisions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Approved</span>
                <span className="text-sm font-bold">{coordinatorStatus.recentDecisions?.approved || 0}</span>
              </div>
              <Progress 
                value={(coordinatorStatus.recentDecisions?.approved || 0) / (coordinatorStatus.recentDecisions?.total || 1) * 100}
                className="h-2"
              />
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Rejected</span>
                <span className="text-sm font-bold">{coordinatorStatus.recentDecisions?.rejected || 0}</span>
              </div>
              <Progress 
                value={(coordinatorStatus.recentDecisions?.rejected || 0) / (coordinatorStatus.recentDecisions?.total || 1) * 100}
                className="h-2"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Consensus Decisions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Consensus Decisions</CardTitle>
          <CardDescription>Latest elder council consensus evaluations</CardDescription>
        </CardHeader>
        <CardContent>
          {recentConsensus.length === 0 ? (
            <p className="text-gray-500 text-sm">No consensus decisions yet</p>
          ) : (
            <div className="space-y-4">
              {recentConsensus.map((consensus, idx) => (
                <div
                  key={idx}
                  className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition"
                  onClick={() => setSelectedConsensus(consensus)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{consensus.daoId}</span>
                    <div className="flex items-center gap-2">
                      {consensus.consensusDecision.canApprove ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                      <span className="text-xs text-gray-500">
                        {new Date(consensus.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-sm">
                    {/* SCRY Assessment */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-xs text-gray-600">SCRY</span>
                        {consensus.scryAssessment.isSafe ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-600" />
                        )}
                      </div>
                      <Badge variant={getThreatBadgeVariant(consensus.scryAssessment.threatLevel)} className="text-xs">
                        {consensus.scryAssessment.threatLevel}
                      </Badge>
                      <div className="text-xs text-gray-500">
                        Conf: {(consensus.scryAssessment.confidence * 100).toFixed(0)}%
                      </div>
                    </div>

                    {/* KAIZEN Assessment */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-xs text-gray-600">KAIZEN</span>
                        {consensus.kaizenAssessment.isBeneficial ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                      <Progress 
                        value={consensus.kaizenAssessment.improvementPotential * 100}
                        className="h-1"
                      />
                      <div className="text-xs text-gray-500">
                        Conf: {(consensus.kaizenAssessment.confidence * 100).toFixed(0)}%
                      </div>
                    </div>

                    {/* LUMEN Assessment */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-xs text-gray-600">LUMEN</span>
                        {consensus.lumenAssessment.isEthical ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-orange-600" />
                        )}
                      </div>
                      <Progress 
                        value={consensus.lumenAssessment.ethicalScore * 100}
                        className="h-1"
                      />
                      <div className="text-xs text-gray-500">
                        Conf: {(consensus.lumenAssessment.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>

                  {/* Overall Consensus */}
                  <div className="mt-3 pt-3 border-t flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-medium">
                        Confidence: {(consensus.consensusDecision.overallConfidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    {consensus.consensusDecision.requiresReview && (
                      <Badge variant="outline" className="text-xs">Needs Review</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Message Bus Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Message Bus Activity</CardTitle>
          <CardDescription>Recent messages published to the elder bus</CardDescription>
        </CardHeader>
        <CardContent>
          {messageBusEvents.length === 0 ? (
            <p className="text-gray-500 text-sm">No messages yet</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {messageBusEvents.map((event, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs">
                  <div className="flex-1 space-y-1">
                    <div className="font-mono font-medium text-blue-600">{event.topic}</div>
                    <div className="text-gray-500">From: {event.from}</div>
                  </div>
                  <div className="text-gray-400">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Consensus View */}
      {selectedConsensus && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Consensus Details</span>
              <button
                onClick={() => setSelectedConsensus(null)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ✕ Close
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              {/* SCRY Details */}
              <div className="space-y-2 p-3 bg-white rounded border">
                <h4 className="font-semibold text-red-600">ELD-SCRY (Security)</h4>
                <div className="space-y-1 text-sm">
                  <p><strong>Safe:</strong> {selectedConsensus.scryAssessment.isSafe ? 'Yes' : 'No'}</p>
                  <p><strong>Threat Level:</strong> {selectedConsensus.scryAssessment.threatLevel}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">Confidence:</span>
                    <Progress 
                      value={selectedConsensus.scryAssessment.confidence * 100}
                      className="h-1 flex-1"
                    />
                  </div>
                </div>
              </div>

              {/* KAIZEN Details */}
              <div className="space-y-2 p-3 bg-white rounded border">
                <h4 className="font-semibold text-green-600">ELD-KAIZEN (Optimization)</h4>
                <div className="space-y-1 text-sm">
                  <p><strong>Beneficial:</strong> {selectedConsensus.kaizenAssessment.isBeneficial ? 'Yes' : 'No'}</p>
                  <p><strong>Improvement Potential:</strong> {(selectedConsensus.kaizenAssessment.improvementPotential * 100).toFixed(0)}%</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">Confidence:</span>
                    <Progress 
                      value={selectedConsensus.kaizenAssessment.confidence * 100}
                      className="h-1 flex-1"
                    />
                  </div>
                </div>
              </div>

              {/* LUMEN Details */}
              <div className="space-y-2 p-3 bg-white rounded border">
                <h4 className="font-semibold text-purple-600">ELD-LUMEN (Ethics)</h4>
                <div className="space-y-1 text-sm">
                  <p><strong>Ethical:</strong> {selectedConsensus.lumenAssessment.isEthical ? 'Yes' : 'No'}</p>
                  <p><strong>Ethical Score:</strong> {(selectedConsensus.lumenAssessment.ethicalScore * 100).toFixed(0)}%</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">Confidence:</span>
                    <Progress 
                      value={selectedConsensus.lumenAssessment.confidence * 100}
                      className="h-1 flex-1"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Overall Decision */}
            <div className="p-3 bg-white rounded border">
              <h4 className="font-semibold mb-2">Council Decision</h4>
              <div className="space-y-2 text-sm">
                <p>
                  <strong>Approved:</strong>{' '}
                  {selectedConsensus.consensusDecision.canApprove ? (
                    <span className="text-green-600">✓ Yes</span>
                  ) : (
                    <span className="text-red-600">✗ No</span>
                  )}
                </p>
                <p><strong>Consensus Confidence:</strong> {(selectedConsensus.consensusDecision.overallConfidence * 100).toFixed(0)}%</p>
                <p><strong>Requires Review:</strong> {selectedConsensus.consensusDecision.requiresReview ? 'Yes' : 'No'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default CoordinatorDashboard;
