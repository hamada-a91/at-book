# Quick Fix Guide: Implementing Requested Improvements

## Problem Summary
Based on the screenshot and user feedback, we need to fix:
1. ✅ **Rounding**: Amounts show too many decimals (84.03361344537815)
2. ✅ **VAT Auto-Mapping**: Correctly map to 1576/1776 based on customer/vendor
3. ✅ **Currency Formatting**: Display as "100,00 €" instead of raw decimals
4. ✅ **Direct Payment Option**: Add checkbox to include cash/bank payment line

## Files to Update

### 1. Created: `/resources/js/lib/currency.ts`
✅ Already created with utility functions:
- `roundToTwoDecimals(amount)` - Rounds to 2 decimals
- `formatCurrency(amount)` - Formats as "100,00 €"
- `calculateVAT(gross, rate)` - Calculates net, tax with rounding

### 2. Update: `/resources/js/pages/BookingCreate.tsx`

#### Changes Needed:

**A) Import the utilities (Line ~1-27):**
```typescript
import { Zap, Banknote } from 'lucide-react'; // Add Ban

knote
import { AccountSelector } from '@/components/AccountSelector';
import { roundToTwoDecimals, formatCurrency as formatEuro, calculateVAT } from '@/lib/currency';
import { Checkbox } from '@/components/ui/checkbox';
```

**B) Update interfaces (Line ~28-38):**
```typescript
interface Account {
    id: number;
    code: string;
    name: string;
    type: string; // Add type field
}

interface Contact {
    id: number;
    name: string;
    type: 'customer' | 'vendor';
    account_id?: number; // Add account_id field
}
```

**C) Add Quick Entry State (after Line ~66):**
```typescript
const [quickEntry, setQuickEntry] = useState({
    contact_id: '',
    contra_account_id: '',
    vat_rate: '19',
    gross_amount: '',
    is_paid: false,
    payment_account_id: '',  
});
```

**D) Update handleQuickEntry function** (replace the existing one):

```typescript
const handleQuickEntry = () => {
    const { contact_id, contra_account_id, vat_rate, gross_amount, is_paid, payment_account_id } = quickEntry;
    
    // Validation
    if (!contact_id || !contra_account_id || !gross_amount) {
        alert('Bitte füllen Sie alle Pflichtfelder aus.');
        return;
    }
    
    if (is_paid && !payment_account_id) {
        alert('Bitte wählen Sie ein Zahlungskonto (Kasse/Bank).');
        return;
    }
    
    const selectedContact = contacts?.find(c => String(c.id) === contact_id);
    if (!selectedContact || !selectedContact.account_id) {
        alert('Kontakt hat kein zugeordnetes Konto.');
        return;
    }
    
    const grossNum = parseFloat(gross_amount);
    if (isNaN(grossNum) || grossNum <= 0) {
        alert('Ungültiger Bruttobetrag.');
        return;
    }
    
    // Calculate VAT with proper rounding
    const { gross, net, tax } = calculateVAT(grossNum, parseFloat(vat_rate));
    
    // Find VAT account by CODE (more reliable than hardcoded IDs)
    let vatAccount: Account | undefined;
    if (parseFloat(vat_rate) > 0) {
        const vatCode = selectedContact.type === 'customer'
            ? (vat_rate === '19' ? '1776' : '1771') // Umsatzsteuer
            : (vat_rate === '19' ? '1576' : '1571'); // Vorsteuer
        vatAccount = accounts?.find(acc => acc.code === vatCode);
    }
    
    // Generate booking lines
    const newLines = [];
    
    if (is_paid) {
        // PAID VERSION: Include payment account
        if (selectedContact.type === 'customer') {
            // Customer Sale WITH Payment: Debit Cash/Bank, Credit Revenue, Credit VAT
            newLines.push({
                account_id: payment_account_id,
                type: 'debit' as const,
                amount: gross,
            });
            newLines.push({
                account_id: contra_account_id,
                type: 'credit' as const,
                amount: net,
            });
            if (vatAccount && tax > 0) {
                newLines.push({
                    account_id: String(vatAccount.id),
                    type: 'credit' as const,
                    amount: tax,
                });
            }
        } else {
            // Vendor Purchase WITH Payment: Credit Cash/Bank, Debit Expense, Debit Input VAT
            newLines.push({
                account_id: payment_account_id,
                type: 'credit' as const,
                amount: gross,
            });
            newLines.push({
                account_id: contra_account_id,
                type: 'debit' as const,
                amount: net,
            });
            if (vatAccount && tax > 0) {
                newLines.push({
                    account_id: String(vatAccount.id),
                    type: 'debit' as const,
                    amount: tax,
                });
            }
        }
    } else {
        // UNPAID VERSION: Contact account instead of cash/bank
        if (selectedContact.type === 'customer') {
            // Customer Sale: Debit Customer, Credit Revenue, Credit VAT
            newLines.push({
                account_id: String(selectedContact.account_id),
                type: 'debit' as const,
                amount: gross,
            });
            newLines.push({
                account_id: contra_account_id,
                type: 'credit' as const,
                amount: net,
            });
            if (vatAccount && tax > 0) {
                newLines.push({
                    account_id: String(vatAccount.id),
                    type: 'credit' as const,
                    amount: tax,
                });
            }
        } else {
            // Vendor Purchase: Credit Vendor, Debit Expense, Debit Input VAT
            newLines.push({
                account_id: String(selectedContact.account_id),
                type: 'credit' as const,
                amount: gross,
            });
            newLines.push({
                account_id: contra_account_id,
                type: 'debit' as const,
                amount: net,
            });
            if (vatAccount && tax > 0) {
                newLines.push({
                    account_id: String(vatAccount.id),
                    type: 'debit' as const,
                    amount: tax,
                });
            }
        }
    }
    
    // Update form
    form.setValue('lines', newLines);
    form.setValue('contact_id', contact_id);
    
    // Auto-generate description if empty
    if (!form.getValues('description')) {
        const accountName = accounts?.find(a => String(a.id) === contra_account_id)?.name || '';
        const paymentText = is_paid ? 'Bezahlt - ' : '';
        form.setValue('description', `${paymentText}${selectedContact.type === 'customer' ? 'Verkauf' : 'Einkauf'} - ${selectedContact.name} - ${accountName}`);
    }
};
```

**E) Update Amount Display in Lines (around line 401-403):**
Replace:
```typescript
<Input type="number" step="0.01" {...field} />
```

With:
```typescript
<Input 
    type="number" 
    step="0.01" 
    {...field}
    value={field.value ? roundToTwoDecimals(parseFloat(String(field.value))) : ''}
    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
/>
```

**F) Add Payment Option to Quick Entry UI** (after VAT and before Gross Amount):

```typescript
{/* Payment Option */}
<div className="col-span-2">
    <div className="flex items-center space-x-2 h-full">
        <Checkbox
            id="is_paid"
            checked={quickEntry.is_paid}
            onCheckedChange={(checked) => setQuickEntry(prev => ({ ...prev, is_paid: !!checked }))}
        />
        <label
            htmlFor="is_paid"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
            Direkt bezahlt?
        </label>
    </div>
    {quickEntry.is_paid && (
        <div className="mt-2">
            <AccountSelector
                accounts={accounts}
                value={quickEntry.payment_account_id}
                onChange={(value) => setQuickEntry(prev => ({ ...prev, payment_account_id: value }))}
                filterType={['asset']}
                placeholder="Kasse/Bank..."
            />
        </div>
    )}
</div>
```

**G) Update formatCurrency in Balance Display:**
Change line ~434-440 to use formatEuro:
```typescript
<span className="ml-2 font-bold">{formatEuro(debitSum)}</span>
...
<span className="ml-2 font-bold">{formatEuro(creditSum)}</span>
```

## Implementation Steps

1. ✅ The `currency.ts` file is already created
2. ⚠️ Update `BookingCreate.tsx` with the changes above
3. ✅ VAT accounts (1576, 1576, 1771, 1571) are already in AccountSeeder
4. ✅ Cash (1000) and Bank (1200) are already in AccountSeeder

## Testing After Implementation

1. **Test Rounding:**
   - Enter 100 as gross amount → Should show 84.03, 15.97 (not 84.03361...)

2. **Test VAT Auto-Mapping:**
   - Customer + 19% → Should use account 1776 (Umsatzsteuer)
   - Vendor + 19% → Should use account 1576 (Vorsteuer)

3. **Test Direct Payment:**
   - Check "Direkt bezahlt"
   - Select "1000 - Kasse"
   - Should generate: Debit Kasse, Credit Revenue, Credit VAT
   (instead of Debit Customer)

4. **Test Formatting:**
   - All amounts should display as "100,00 €" in the balance footer

## Summary

The key improvements:
1. ✅ Use `calculateVAT()` for proper rounding
2. ✅ Find VAT accounts by CODE ('1776', '1576', etc.) not hardcoded IDs
3. ✅ Add "Direkt bezahlt" checkbox with payment account selector
4. ✅ Use `formatEuro()` for displaying amounts
5. ✅ Round input values to 2 decimals

All required accounts are already in the seeder. Just need to update the BookingCreate component!
