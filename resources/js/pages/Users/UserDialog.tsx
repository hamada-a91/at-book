import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { userService, User, Role } from '@/services/userService';

const userSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    password: z.string().optional(),
    password_confirmation: z.string().optional(),
    role: z.string().min(1, 'Role is required'),
});

interface UserDialogProps {
    trigger?: React.ReactNode;
    user?: User | null;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    onSuccess: () => void;
}

export function UserDialog({ trigger, user, open, onOpenChange, onSuccess }: UserDialogProps) {
    const [roles, setRoles] = useState<Role[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    // Determine if we are editing
    const isEditing = !!user;

    const form = useForm<z.infer<typeof userSchema>>({
        resolver: zodResolver(userSchema),
        defaultValues: {
            name: '',
            email: '',
            password: '',
            password_confirmation: '',
            role: '',
        },
    });

    useEffect(() => {
        // Load roles
        userService.getRoles().then(setRoles).catch(console.error);
    }, []);

    useEffect(() => {
        if (open) {
            if (user) {
                form.reset({
                    name: user.name,
                    email: user.email,
                    role: user.roles[0]?.name || '',
                    password: '',
                    password_confirmation: '',
                });
            } else {
                form.reset({
                    name: '',
                    email: '',
                    role: 'manager', // Default to manager or something safe
                    password: '',
                    password_confirmation: '',
                });
            }
        }
    }, [user, open, form]);

    const onSubmit = async (values: z.infer<typeof userSchema>) => {
        setIsSubmitting(true);
        try {
            if (isEditing && user) {
                await userService.updateUser(user.id, values);
            } else {
                await userService.createUser({ ...values, password: values.password || 'password' }); // Fallback helpful? No, validation should catch
            }
            onSuccess();
            if (onOpenChange) onOpenChange(false);
        } catch (error: any) {
            console.error('Failed to save user', error);
            // Handle error (e.g. email taken)
            if (error.response?.data?.errors) {
                const errors = error.response.data.errors;
                Object.keys(errors).forEach((key: any) => {
                    form.setError(key, { message: errors[key][0] });
                });
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{isEditing ? 'Edit User' : 'Add New User'}</DialogTitle>
                    <DialogDescription>
                        {isEditing ? 'Update user details and role.' : 'Create a new user for your organization.'}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="John Doe" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email</FormLabel>
                                    <FormControl>
                                        <Input placeholder="john@example.com" type="email" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="role"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Role</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a role" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {roles.map((role) => (
                                                <SelectItem key={role.name} value={role.name}>
                                                    {role.name.charAt(0).toUpperCase() + role.name.slice(1)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />

                                    {/* Display Permissions for selected role */}
                                    {field.value && (
                                        <div className="mt-2 p-3 bg-muted rounded-md text-sm">
                                            <p className="font-semibold mb-1">Permissions:</p>
                                            <div className="flex flex-wrap gap-1">
                                                {roles.find(r => r.name === field.value)?.permissions.map(perm => (
                                                    <span key={perm} className="px-2 py-0.5 bg-background border rounded text-xs text-muted-foreground">
                                                        {perm}
                                                    </span>
                                                )) || <span className="text-muted-foreground italic">No permissions</span>}
                                            </div>
                                        </div>
                                    )}
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{isEditing ? 'New Password (Optional)' : 'Password'}</FormLabel>
                                        <FormControl>
                                            <Input type="password" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="password_confirmation"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Confirm</FormLabel>
                                        <FormControl>
                                            <Input type="password" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <DialogFooter>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Saving...' : 'Save'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
