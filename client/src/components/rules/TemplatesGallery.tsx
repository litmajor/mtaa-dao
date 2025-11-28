import React, { useState, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string;
  default_config: any;
}

interface TemplatesGalleryProps {
  daoId: string;
  onSelect?: (template: Template) => void;
}

export default function TemplatesGallery({ daoId, onSelect }: TemplatesGalleryProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const categories = [
    { id: 'entry', label: '🎫 Entry Rules', icon: '🎫' },
    { id: 'withdrawal', label: '💳 Withdrawal Rules', icon: '💳' },
    { id: 'rotation', label: '🔄 Rotation Rules', icon: '🔄' },
    { id: 'financial', label: '📈 Financial Rules', icon: '📈' },
    { id: 'governance', label: '🗳️ Governance Rules', icon: '🗳️' }
  ];

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/rules/templates');
      const data = await response.json();
      setTemplates(data.data || data.templates || []);
      if (data.data && data.data.length > 0) {
        setSelectedCategory(data.data[0].category);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = selectedCategory
    ? templates.filter(t => t.category === selectedCategory)
    : templates;

  const handleCopyConfig = async (templateId: string, config: any) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(config, null, 2));
      setCopiedId(templateId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-600">Loading templates...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Rule Templates</h2>

      {/* Category Tabs */}
      <div className="mb-8 flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory('')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            selectedCategory === ''
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All Templates
        </button>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedCategory === cat.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <p className="text-gray-600">No templates found in this category</p>
          </div>
        ) : (
          filteredTemplates.map(template => (
            <div
              key={template.id}
              className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow hover:border-blue-300"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="text-3xl">{template.icon}</div>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  {template.category}
                </span>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {template.name}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {template.description}
              </p>

              <div className="bg-gray-50 p-3 rounded mb-4">
                <p className="text-xs text-gray-600 font-medium mb-2">
                  Default Configuration:
                </p>
                <pre className="text-xs overflow-auto max-h-32">
                  {JSON.stringify(template.default_config, null, 2)}
                </pre>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleCopyConfig(template.id, template.default_config)}
                  className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-sm font-medium flex items-center justify-center gap-1"
                >
                  {copiedId === template.id ? (
                    <>
                      <Check size={14} /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={14} /> Copy
                    </>
                  )}
                </button>
                {onSelect && (
                  <button
                    onClick={() => onSelect(template)}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    Use Template
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
