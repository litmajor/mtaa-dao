
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { FileText, Plus, Edit, Trash2, Clock, Users } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';

interface ProposalTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  titleTemplate: string;
  descriptionTemplate: string;
  requiredFields: any[];
  votingPeriod: number;
  quorumOverride?: number;
  isGlobal: boolean;
}

interface ProposalTemplateSelectorProps {
  daoId: string;
  onTemplateSelect: (template: ProposalTemplate, filledData: any) => void;
  onCancel: () => void;
}

export default function ProposalTemplateSelector({ 
  daoId, 
  onTemplateSelect, 
  onCancel 
}: ProposalTemplateSelectorProps) {
  const [templates, setTemplates] = useState<ProposalTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ProposalTemplate | null>(null);
  const [templateData, setTemplateData] = useState<Record<string, any>>({});
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    category: '',
    description: '',
    titleTemplate: '',
    descriptionTemplate: '',
    votingPeriod: 72,
    requiredFields: []
  });

  useEffect(() => {
    fetchTemplates();
  }, [daoId]);

  const fetchTemplates = async () => {
    try {
      const response = await apiGet(`/api/governance/${daoId}/templates`);
      if (response.success) {
        setTemplates(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    }
  };

  const handleTemplateSelect = (template: ProposalTemplate) => {
    setSelectedTemplate(template);
    // Initialize template data with empty values
    const initialData: Record<string, any> = {};
    template.requiredFields.forEach((field: any) => {
      initialData[field.name] = field.defaultValue || '';
    });
    setTemplateData(initialData);
  };

  const handleFieldChange = (fieldName: string, value: any) => {
    setTemplateData(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const fillTemplate = (template: string, data: Record<string, any>) => {
    let filled = template;
    Object.entries(data).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      filled = filled.replace(new RegExp(placeholder, 'g'), value);
    });
    return filled;
  };

  const handleSubmitTemplate = () => {
    if (!selectedTemplate) return;

    const filledTitle = fillTemplate(selectedTemplate.titleTemplate, templateData);
    const filledDescription = fillTemplate(selectedTemplate.descriptionTemplate, templateData);

    onTemplateSelect(selectedTemplate, {
      title: filledTitle,
      description: filledDescription,
      templateData,
      votingPeriod: selectedTemplate.votingPeriod,
      quorumOverride: selectedTemplate.quorumOverride
    });
  };

  const handleCreateTemplate = async () => {
    try {
      const response = await apiPost(`/api/governance/${daoId}/templates`, newTemplate);
      if (response.success) {
        setTemplates(prev => [...prev, response.data]);
        setIsCreatingTemplate(false);
        setNewTemplate({
          name: '',
          category: '',
          description: '',
          titleTemplate: '',
          descriptionTemplate: '',
          votingPeriod: 72,
          requiredFields: []
        });
      }
    } catch (error) {
      console.error('Failed to create template:', error);
    }
  };

  const templateCategories = [
    'budget', 'governance', 'member', 'treasury', 'policy', 'emergency', 'general'
  ];

  if (isCreatingTemplate) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Create Proposal Template
          </h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Template Name</label>
              <Input
                value={newTemplate.name}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Budget Request"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <Select
                value={newTemplate.category}
                onValueChange={(value) => setNewTemplate(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {templateCategories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <Textarea
              value={newTemplate.description}
              onChange={(e) => setNewTemplate(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe when to use this template..."
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Title Template</label>
            <Input
              value={newTemplate.titleTemplate}
              onChange={(e) => setNewTemplate(prev => ({ ...prev, titleTemplate: e.target.value }))}
              placeholder="e.g., Budget Request: {{amount}} {{currency}} for {{purpose}}"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description Template</label>
            <Textarea
              value={newTemplate.descriptionTemplate}
              onChange={(e) => setNewTemplate(prev => ({ ...prev, descriptionTemplate: e.target.value }))}
              placeholder="Use {{fieldName}} for dynamic content..."
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Voting Period (hours)</label>
              <Input
                type="number"
                value={newTemplate.votingPeriod}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, votingPeriod: parseInt(e.target.value) }))}
                min="1"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={handleCreateTemplate} className="flex-1">
              Create Template
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setIsCreatingTemplate(false)}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (selectedTemplate) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Edit className="w-5 h-5" />
            Fill Template: {selectedTemplate.name}
          </h3>
          <p className="text-sm text-gray-600">{selectedTemplate.description}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedTemplate.requiredFields.map((field: any) => (
            <div key={field.name}>
              <label className="block text-sm font-medium mb-1">
                {field.label}
                {field.required && <span className="text-red-500">*</span>}
              </label>
              
              {field.type === 'text' && (
                <Input
                  value={templateData[field.name] || ''}
                  onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  placeholder={field.placeholder}
                  required={field.required}
                />
              )}
              
              {field.type === 'textarea' && (
                <Textarea
                  value={templateData[field.name] || ''}
                  onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  placeholder={field.placeholder}
                  required={field.required}
                  rows={3}
                />
              )}
              
              {field.type === 'number' && (
                <Input
                  type="number"
                  value={templateData[field.name] || ''}
                  onChange={(e) => handleFieldChange(field.name, parseFloat(e.target.value))}
                  placeholder={field.placeholder}
                  required={field.required}
                />
              )}
              
              {field.type === 'select' && (
                <Select
                  value={templateData[field.name] || ''}
                  onValueChange={(value) => handleFieldChange(field.name, value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={field.placeholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options?.map((option: any) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          ))}

          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Preview</h4>
            <div className="space-y-2">
              <p><strong>Title:</strong> {fillTemplate(selectedTemplate.titleTemplate, templateData)}</p>
              <p><strong>Description:</strong> {fillTemplate(selectedTemplate.descriptionTemplate, templateData)}</p>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={handleSubmitTemplate} className="flex-1">
              Use Template
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setSelectedTemplate(null)}
              className="flex-1"
            >
              Back
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Choose Proposal Template
          </h3>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsCreatingTemplate(true)}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Template
            </Button>
            <Button variant="outline" onClick={onCancel}>
              Skip Templates
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {templates.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">No templates available yet</p>
            <Button onClick={() => setIsCreatingTemplate(true)}>
              Create First Template
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((template) => (
              <Card 
                key={template.id} 
                className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-blue-200"
                onClick={() => handleTemplateSelect(template)}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold">{template.name}</h4>
                    <div className="flex gap-1">
                      <Badge variant="secondary">
                        {template.category}
                      </Badge>
                      {template.isGlobal && (
                        <Badge variant="outline">Global</Badge>
                      )}
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-3">
                    {template.description}
                  </p>
                  
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {template.votingPeriod}h voting
                    </div>
                    {template.quorumOverride && (
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {template.quorumOverride}% quorum
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
