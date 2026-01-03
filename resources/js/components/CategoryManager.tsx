import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '@/lib/axios';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Edit2, Save, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Category {
    id: number;
    name: string;
    description: string | null;
    color: string | null;
}

interface CategoryManagerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CategoryManager({ open, onOpenChange }: CategoryManagerProps) {
    const queryClient = useQueryClient();
    const [editingId, setEditingId] = useState<number | null>(null);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryColor, setNewCategoryColor] = useState('#3b82f6'); // Default blue
    const [error, setError] = useState<string | null>(null);

    const { data: categoriesData } = useQuery<Category[]>({
        queryKey: ['product-categories'],
        queryFn: async () => {
            const { data } = await axios.get('/api/product-categories');
            // Handle both array response and object with data property
            return Array.isArray(data) ? data : (data?.data || []);
        },
    });

    // Ensure categories is always an array
    const categories = Array.isArray(categoriesData) ? categoriesData : [];

    const createMutation = useMutation({
        mutationFn: async (category: { name: string; color: string }) => {
            const { data } = await axios.post('/api/product-categories', category);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['product-categories'] });
            setNewCategoryName('');
            setError(null);
        },
        onError: (err: any) => {
            setError(err.response?.data?.message || 'Fehler beim Erstellen');
        }
    });

    const updateMutation = useMutation({
        mutationFn: async (category: Category) => {
            const { data } = await axios.put(`/api/product-categories/${category.id}`, category);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['product-categories'] });
            setEditingId(null);
            setError(null);
        },
        onError: (err: any) => {
            setError(err.response?.data?.message || 'Fehler beim Aktualisieren');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            await axios.delete(`/api/product-categories/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['product-categories'] });
            setError(null);
        },
        onError: (err: any) => {
            setError(err.response?.data?.error || err.response?.data?.message || 'Fehler beim Löschen');
        },
    });

    const handleCreate = () => {
        if (!newCategoryName.trim()) return;
        createMutation.mutate({ name: newCategoryName, color: newCategoryColor });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Kategorien verwalten</DialogTitle>
                    <DialogDescription>
                        Erstellen, bearbeiten oder löschen Sie Produktkategorien.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {/* Create New */}
                    <div className="flex items-end gap-2 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border">
                        <div className="flex-1 space-y-1">
                            <Label htmlFor="new-cat">Neue Kategorie</Label>
                            <Input
                                id="new-cat"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                placeholder="Name..."
                                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>Farbe</Label>
                            <input
                                type="color"
                                value={newCategoryColor}
                                onChange={(e) => setNewCategoryColor(e.target.value)}
                                className="h-10 w-10 p-1 block bg-white border border-gray-200 cursor-pointer rounded-md disabled:opacity-50 disabled:pointer-events-none dark:bg-neutral-900 dark:border-neutral-700"
                            />
                        </div>
                        <Button onClick={handleCreate} disabled={!newCategoryName.trim() || createMutation.isPending}>
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* List */}
                    <div className="h-[300px] pr-4 overflow-y-auto">
                        <div className="space-y-2">
                            {categories.map((category) => (
                                <div
                                    key={category.id}
                                    className="flex items-center justify-between p-2 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                                >
                                    {editingId === category.id ? (
                                        <div className="flex items-center gap-2 flex-1">
                                            <Input
                                                defaultValue={category.name}
                                                id={`edit-name-${category.id}`}
                                                className="h-8"
                                            />
                                            <input
                                                type="color"
                                                defaultValue={category.color || '#3b82f6'}
                                                id={`edit-color-${category.id}`}
                                                className="h-8 w-8 p-1 block bg-white border border-gray-200 cursor-pointer rounded-md"
                                            />
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8 text-green-600"
                                                onClick={() => {
                                                    const nameInput = document.getElementById(`edit-name-${category.id}`) as HTMLInputElement;
                                                    const colorInput = document.getElementById(`edit-color-${category.id}`) as HTMLInputElement;
                                                    if (nameInput.value.trim()) {
                                                        updateMutation.mutate({
                                                            ...category,
                                                            name: nameInput.value,
                                                            color: colorInput.value
                                                        });
                                                    }
                                                }}
                                            >
                                                <Save className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8"
                                                onClick={() => setEditingId(null)}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-4 h-4 rounded-full"
                                                    style={{ backgroundColor: category.color || '#3b82f6' }}
                                                />
                                                <span className="font-medium">{category.name}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-8 w-8"
                                                    onClick={() => setEditingId(category.id)}
                                                >
                                                    <Edit2 className="h-4 w-4 text-slate-500" />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-8 w-8 hover:text-red-600"
                                                    onClick={() => {
                                                        if (confirm('Möchten Sie diese Kategorie wirklich löschen?')) {
                                                            deleteMutation.mutate(category.id);
                                                        }
                                                    }}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
