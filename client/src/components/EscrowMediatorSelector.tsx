import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiGet } from '@/lib/api';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface Mediator {
  id: string;
  username: string;
  avatarUrl: string;
  trustScore: string | number;
  role: string;
}

interface EscrowMediatorSelectorProps {
  daoId: string;
  excludeUserIds: string[];
  onSelectMediator: (mediatorId: string) => void;
  selectedMediatorId?: string;
}

export default function EscrowMediatorSelector({
  daoId,
  excludeUserIds,
  onSelectMediator,
  selectedMediatorId
}: EscrowMediatorSelectorProps) {
  const [mediators, setMediators] = useState<Mediator[]>([]);
  const [filteredMediators, setFilteredMediators] = useState<Mediator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchMediators = async () => {
      try {
        if (!daoId) {
          setIsLoading(false);
          return;
        }

        const excludeParam = excludeUserIds.length > 0 
          ? `?exclude=${excludeUserIds.join(',')}` 
          : '';

        const data = await apiGet(`/api/escrow/mediators/suggest/${daoId}${excludeParam}`);
        setMediators(data.mediators || []);
        setFilteredMediators(data.mediators || []);
      } catch (error) {
        console.error('Failed to load mediators:', error);
        toast({ 
          title: 'Error', 
          description: 'Failed to load mediators', 
          variant: 'destructive' 
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchMediators();
  }, [daoId, excludeUserIds, toast]);

  // Filter mediators based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredMediators(mediators);
    } else {
      const term = searchTerm.toLowerCase();
      setFilteredMediators(
        mediators.filter(m => 
          m.username.toLowerCase().includes(term) ||
          m.role.toLowerCase().includes(term)
        )
      );
    }
  }, [searchTerm, mediators]);

  const selected = mediators.find(m => m.id === selectedMediatorId);
  const trustScore = selected ? (typeof selected.trustScore === 'string' ? parseInt(selected.trustScore) : selected.trustScore) : 0;

  const handleSelect = (mediator: Mediator) => {
    onSelectMediator(mediator.id);
    setShowDropdown(false);
    setSearchTerm('');
  };

  const handleClear = () => {
    onSelectMediator('');
    setSearchTerm('');
  };

  if (!daoId) {
    return (
      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-center text-sm text-gray-600">
        Select a DAO first to choose a mediator
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">
        Select Mediator (Optional)
        <span className="text-xs text-gray-500 ml-2">
          DAO elder to help resolve disputes
        </span>
      </label>

      {selected && (
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {selected.avatarUrl && (
              <img 
                src={selected.avatarUrl} 
                alt={selected.username} 
                className="w-8 h-8 rounded-full object-cover" 
              />
            )}
            <div>
              <p className="font-medium text-sm">{selected.username}</p>
              <p className="text-xs text-gray-600 capitalize">{selected.role}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Trust: {trustScore}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-6 w-6 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {!selected && (
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search mediators by name..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              className="pl-10"
            />
          </div>

          {showDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
              {isLoading && (
                <div className="p-4 text-center text-sm text-gray-500">
                  Loading mediators...
                </div>
              )}

              {!isLoading && filteredMediators.length === 0 && (
                <div className="p-4 text-center text-sm text-gray-500">
                  {searchTerm ? 'No matching mediators found' : 'No mediators available'}
                </div>
              )}

              {!isLoading && filteredMediators.length > 0 && (
                <div className="divide-y">
                  {filteredMediators.map((mediator) => {
                    const mTrustScore = typeof mediator.trustScore === 'string' 
                      ? parseInt(mediator.trustScore) 
                      : mediator.trustScore;
                    
                    return (
                      <button
                        key={mediator.id}
                        onClick={() => handleSelect(mediator)}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {mediator.avatarUrl && (
                            <img 
                              src={mediator.avatarUrl} 
                              alt={mediator.username} 
                              className="w-8 h-8 rounded-full object-cover flex-shrink-0" 
                            />
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{mediator.username}</p>
                            <p className="text-xs text-gray-600 capitalize">{mediator.role}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs flex-shrink-0 ml-2">
                          {mTrustScore}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="border-t p-2">
                <button
                  onClick={() => setShowDropdown(false)}
                  className="w-full px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 rounded"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!selected && !isLoading && mediators.length > 0 && (
        <p className="text-xs text-gray-500">
          {mediators.length} mediator{mediators.length !== 1 ? 's' : ''} available
        </p>
      )}
    </div>
  );
}
