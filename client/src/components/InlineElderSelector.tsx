
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Mail, User, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Elder {
  id: string;
  name: string;
  email?: string;
  isNew?: boolean;
}

interface InlineElderSelectorProps {
  selectedElders: Elder[];
  onEldersChange: (elders: Elder[]) => void;
  minElders?: number;
  maxElders?: number;
}

/**
 * Elder selector with inline member invitation
 * Allows adding new members by email during DAO creation
 */
export function InlineElderSelector({
  selectedElders,
  onEldersChange,
  minElders = 2,
  maxElders = 10
}: InlineElderSelectorProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newElderEmail, setNewElderEmail] = useState('');
  const [newElderName, setNewElderName] = useState('');
  const [error, setError] = useState('');

  const handleAddElder = () => {
    setError('');
    
    // Validation
    if (!newElderEmail || !newElderName) {
      setError('Please provide both name and email');
      return;
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newElderEmail)) {
      setError('Please enter a valid email address');
      return;
    }
    
    if (selectedElders.some(e => e.email === newElderEmail)) {
      setError('This person is already added as an elder');
      return;
    }
    
    if (selectedElders.length >= maxElders) {
      setError(`Maximum ${maxElders} elders allowed`);
      return;
    }
    
    // Add new elder
    const newElder: Elder = {
      id: `temp_${Date.now()}`,
      name: newElderName,
      email: newElderEmail,
      isNew: true
    };
    
    onEldersChange([...selectedElders, newElder]);
    
    // Reset form
    setNewElderEmail('');
    setNewElderName('');
    setShowAddForm(false);
  };

  const handleRemoveElder = (elderId: string) => {
    onEldersChange(selectedElders.filter(e => e.id !== elderId));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">
          Select Trusted Elders ({selectedElders.length}/{minElders} minimum)
        </Label>
        {selectedElders.length < maxElders && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            <Plus className="h-4 w-4 mr-1" />
            {showAddForm ? 'Cancel' : 'Invite Someone New'}
          </Button>
        )}
      </div>

      {/* Info Box */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-sm">
          <strong>What are elders?</strong> Like bank signatories or chama table banking leaders.
          They help approve withdrawals and major decisions. Need at least {minElders} for security.
        </AlertDescription>
      </Alert>

      {/* Add New Elder Form */}
      {showAddForm && (
        <div className="bg-blue-50 p-4 rounded-lg space-y-3 border-2 border-blue-200">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Invite Someone to be an Elder
          </h4>
          <p className="text-xs text-gray-600">
            They'll receive an email invitation to join as an elder when you create the DAO.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="elder-name" className="text-sm">Full Name</Label>
              <Input
                id="elder-name"
                placeholder="e.g., John Mwangi"
                value={newElderName}
                onChange={(e) => setNewElderName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="elder-email" className="text-sm">Email Address</Label>
              <Input
                id="elder-email"
                type="email"
                placeholder="e.g., john@example.com"
                value={newElderEmail}
                onChange={(e) => setNewElderEmail(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          
          {error && (
            <Alert variant="destructive" className="py-2">
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}
          
          <Button
            type="button"
            onClick={handleAddElder}
            size="sm"
            className="w-full"
          >
            Add as Elder
          </Button>
        </div>
      )}

      {/* Selected Elders List */}
      <div className="space-y-2">
        {selectedElders.length === 0 ? (
          <div className="text-center p-8 bg-gray-50 rounded-lg border-2 border-dashed">
            <User className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-gray-600">No elders selected yet</p>
            <p className="text-xs text-gray-500 mt-1">
              Add at least {minElders} trusted members to continue
            </p>
          </div>
        ) : (
          selectedElders.map((elder) => (
            <div
              key={elder.id}
              className="flex items-center justify-between p-3 bg-white border rounded-lg hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">{elder.name}</p>
                  {elder.email && (
                    <p className="text-xs text-gray-500">{elder.email}</p>
                  )}
                  {elder.isNew && (
                    <Badge variant="outline" className="text-xs mt-1">
                      Will receive invitation
                    </Badge>
                  )}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveElder(elder.id)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>

      {/* Validation Warning */}
      {selectedElders.length > 0 && selectedElders.length < minElders && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            You need at least {minElders - selectedElders.length} more elder(s) for security purposes
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
