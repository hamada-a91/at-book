import React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Plus } from 'lucide-react';

// Schema Validation
const bookingSchema = z.object({
  date: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid date"),
  description: z.string().min(3, "Description is required"),
  lines: z.array(z.object({
    accountId: z.string().min(1, "Account is required"),
    type: z.enum(["debit", "credit"]),
    amount: z.coerce.number().min(0.01, "Amount must be positive"),
  })).min(2, "At least 2 lines required")
    .refine((lines) => {
      const debit = lines.filter(l => l.type === 'debit').reduce((sum, l) => sum + l.amount, 0);
      const credit = lines.filter(l => l.type === 'credit').reduce((sum, l) => sum + l.amount, 0);
      return Math.abs(debit - credit) < 0.01;
    }, "Booking must be balanced (Debit = Credit)"),
});

type BookingFormValues = z.infer<typeof bookingSchema>;

export function BookingMask() {
  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      description: "",
      lines: [
        { accountId: "", type: "debit", amount: 0 },
        { accountId: "", type: "credit", amount: 0 },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  const onSubmit = (data: BookingFormValues) => {
    console.log("Submitting Booking:", data);
    // API call would go here
    // axios.post('/api/bookings', data);
  };

  // Mock Accounts
  const accounts = [
    { id: "1000", name: "Kasse", type: "asset" },
    { id: "1200", name: "Bank", type: "asset" },
    { id: "4400", name: "Erlöse 19%", type: "revenue" },
    { id: "8400", name: "Erlöse 19% (SKR03)", type: "revenue" },
  ];

  return (
    <Card className="w-full max-w-4xl mx-auto mt-8">
      <CardHeader>
        <CardTitle>New Booking (Buchungssatz)</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            {/* Header Data */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Office Supplies" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Lines */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Booking Lines</h3>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => append({ accountId: "", type: "debit", amount: 0 })}
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Line
                </Button>
              </div>

              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-4 items-end border p-4 rounded-md bg-slate-50">
                  
                  {/* Account Select */}
                  <FormField
                    control={form.control}
                    name={`lines.${index}.accountId`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>Account</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Account" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {accounts.map((acc) => (
                              <SelectItem key={acc.id} value={acc.id}>
                                {acc.id} - {acc.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Type (Soll/Haben) */}
                  <FormField
                    control={form.control}
                    name={`lines.${index}.type`}
                    render={({ field }) => (
                      <FormItem className="w-32">
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="debit">Soll (Debit)</SelectItem>
                            <SelectItem value="credit">Haben (Credit)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Amount */}
                  <FormField
                    control={form.control}
                    name={`lines.${index}.amount`}
                    render={({ field }) => (
                      <FormItem className="w-40">
                        <FormLabel>Amount (€)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => remove(index)}
                    className="mb-2"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              ))}
              
              {/* Global Error (Balance) */}
              {form.formState.errors.lines?.root && (
                <p className="text-red-500 text-sm font-medium">
                  {form.formState.errors.lines.root.message}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full">
              Save Booking (Draft)
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
