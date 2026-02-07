import { useState } from 'react';
import { Plus, Check, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DynamicIcon from '@/components/ui/DynamicIcon';
import ColorPicker from './ColorPicker';
import IconPicker from './IconPicker';
import { useCreateCategory } from '@/hooks/useCategories';
import { cn } from '@/lib/utils';

interface SuggestedCategory {
  name: string;
  icon: string;
  color: string;
}

interface SuggestedCategoriesProps {
  suggestions: SuggestedCategory[];
  onDismiss: () => void;
}

export default function SuggestedCategories({ suggestions, onDismiss }: SuggestedCategoriesProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<SuggestedCategory | null>(null);
  const [createdNames, setCreatedNames] = useState<Set<string>>(new Set());
  
  const createCategory = useCreateCategory();

  const handleApprove = async (suggestion: SuggestedCategory) => {
    try {
      await createCategory.mutateAsync({
        name: suggestion.name,
        icon: suggestion.icon,
        color: suggestion.color,
        monthly_budget: null,
        budget_alert_threshold: 80,
        category_type: 'wants',
      });
      setCreatedNames(prev => new Set([...prev, suggestion.name]));
    } catch {
      // Error handled by mutation
    }
  };

  const handleEditStart = (index: number, suggestion: SuggestedCategory) => {
    setEditingIndex(index);
    setEditValues({ ...suggestion });
  };

  const handleEditSave = async () => {
    if (!editValues) return;
    await handleApprove(editValues);
    setEditingIndex(null);
    setEditValues(null);
  };

  const pendingSuggestions = suggestions.filter(s => !createdNames.has(s.name));

  if (pendingSuggestions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 p-4 bg-primary/5 rounded-xl border border-primary/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="font-medium text-sm">AI Suggested Categories</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
      
      <p className="text-xs text-muted-foreground">
        These categories were suggested based on your transactions. Approve to add them.
      </p>

      <div className="space-y-2">
        {suggestions.map((suggestion, index) => {
          const isCreated = createdNames.has(suggestion.name);
          const isEditing = editingIndex === index;

          if (isCreated) {
            return (
              <div
                key={suggestion.name}
                className="flex items-center gap-3 p-3 bg-success/10 rounded-lg border border-success/20"
              >
                <Check className="h-4 w-4 text-success" />
                <span className="text-sm text-success font-medium">
                  {suggestion.name} created
                </span>
              </div>
            );
          }

          if (isEditing && editValues) {
            return (
              <div key={suggestion.name} className="p-3 bg-card rounded-lg border space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs">Name</Label>
                  <Input
                    value={editValues.name}
                    onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Icon</Label>
                  <IconPicker
                    value={editValues.icon}
                    onChange={(icon) => setEditValues({ ...editValues, icon })}
                    color={editValues.color}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Color</Label>
                  <ColorPicker
                    value={editValues.color}
                    onChange={(color) => setEditValues({ ...editValues, color })}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={handleEditSave}
                    disabled={createCategory.isPending}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingIndex(null);
                      setEditValues(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={suggestion.name}
              className="flex items-center justify-between p-3 bg-card rounded-lg border"
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: suggestion.color + '20' }}
                >
                  <DynamicIcon
                    name={suggestion.icon}
                    className="h-5 w-5"
                    style={{ color: suggestion.color }}
                  />
                </div>
                <span className="font-medium text-sm">{suggestion.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEditStart(index, suggestion)}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleApprove(suggestion)}
                  disabled={createCategory.isPending}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
