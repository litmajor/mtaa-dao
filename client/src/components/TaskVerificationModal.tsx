
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { toast } from './ui/use-toast';
import { CheckCircle, Upload, Link } from 'lucide-react';

interface TaskVerificationModalProps {
  open: boolean;
  onClose: () => void;
  taskId: string;
  taskTitle: string;
  onVerificationSubmitted: () => void;
}

export const TaskVerificationModal: React.FC<TaskVerificationModalProps> = ({
  open,
  onClose,
  taskId,
  taskTitle,
  onVerificationSubmitted
}) => {
  const [formData, setFormData] = useState({
    proofUrl: '',
    description: '',
    screenshots: ['']
  });
  const [loading, setLoading] = useState(false);

  const addScreenshotField = () => {
    setFormData(prev => ({
      ...prev,
      screenshots: [...prev.screenshots, '']
    }));
  };

  const updateScreenshot = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      screenshots: prev.screenshots.map((url, i) => i === index ? value : url)
    }));
  };

  const removeScreenshot = (index: number) => {
    setFormData(prev => ({
      ...prev,
      screenshots: prev.screenshots.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const screenshots = formData.screenshots.filter(url => url.trim() !== '');
      
      const response = await fetch(`/api/tasks/${taskId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proofUrl: formData.proofUrl,
          description: formData.description,
          screenshots: screenshots.length > 0 ? screenshots : undefined
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit verification');
      }

      toast({
        title: "Success",
        description: "Task verification submitted! Awaiting review.",
      });

      onVerificationSubmitted();
      onClose();
      setFormData({
        proofUrl: '',
        description: '',
        screenshots: ['']
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to submit verification',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Submit Task Completion
          </DialogTitle>
          <p className="text-sm text-gray-600">
            Task: {taskTitle}
          </p>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="proofUrl">Proof URL *</Label>
            <Input
              id="proofUrl"
              type="url"
              value={formData.proofUrl}
              onChange={(e) => setFormData(prev => ({ ...prev, proofUrl: e.target.value }))}
              placeholder="https://github.com/user/repo or deployment URL"
              required
            />
            <p className="text-xs text-gray-500">
              Link to your completed work (GitHub repo, deployed site, etc.)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Completion Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe what you completed and any important notes for the reviewer"
              rows={4}
              required
            />
          </div>

          <div className="space-y-3">
            <Label>Screenshots (Optional)</Label>
            {formData.screenshots.map((url, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  type="url"
                  value={url}
                  onChange={(e) => updateScreenshot(index, e.target.value)}
                  placeholder={`Screenshot ${index + 1} URL`}
                  className="flex-1"
                />
                {formData.screenshots.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeScreenshot(index)}
                  >
                    Remove
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={addScreenshotField}
              className="w-full"
            >
              <Upload className="w-4 h-4 mr-2" />
              Add Screenshot
            </Button>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Submission Guidelines</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Ensure your work meets all requirements in the task description</li>
              <li>• Provide clear documentation or instructions if needed</li>
              <li>• Test your work thoroughly before submission</li>
              <li>• Include any relevant credentials or access information</li>
            </ul>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit for Review'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
