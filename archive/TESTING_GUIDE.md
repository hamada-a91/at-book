# 🧪 Testing Guide: Accounting Automation Features

## Prerequisites
1. Laravel Sail is running
2. Migrations are run
3. VAT accounts are seeded

Run the setup script:
```bash
bash setup-accounting-automation.sh
```

---

## Test 1: Automatic Account Creation

### Scenario: Create a new Customer

1. **Navigate** to Contacts page
2. **Click** "Neuen Kontakt erstellen"
3. **Fill in:**
   - Name: "Test Customer GmbH"
   - Type: "Kunde" (Customer)
   - Email: test@customer.de
   - Phone: 030 12345678
4. **Submit** the form
5. **Verify:**
   - Contact is created
   - Check the response JSON - should include `account` object
   - Account code should be `10001` (or next available)
   - Account name should be "Test Customer GmbH"
   - Account type should be "asset"

### Scenario: Create a new Vendor

1. **Repeat** above steps but select Type: "Lieferant" (Vendor)
2. **Verify:**
   - Account code should be `70001` (or next available)
   - Account type should be "liability"

---

## Test 2: Quick Entry Feature

### Scenario: Customer Sale with 19% VAT

1. **Navigate** to "Neue Buchung"
2. **In Quick Entry section:**
   - **Contact:** Select "Test Customer GmbH"
   - **Gegenkonto:** Search and select "8400 - Erlöse 19% USt"
   - **MwSt-Satz:** 19%
   - **Bruttobetrag:** 119.00
3. **Click** "Ausfüllen" button
4. **Verify** that 3 booking lines are auto-generated:
   
   | Konto | Code | Name | Typ | Betrag |
   |-------|------|------|-----|--------|
   | 1 | 10001 | Test Customer GmbH | Soll (Debit) | 119.00 € |
   | 2 | 8400 | Erlöse 19% USt | Haben (Credit) | 100.00 € |
   | 3 | 1776 | Umsatzsteuer 19% | Haben (Credit) | 19.00 € |

5. **Verify** balance indicator shows "✓ Ausgeglichen"
6. **Verify** description is auto-filled: "Verkauf - Test Customer GmbH - Erlöse 19% USt"
7. **Click** "Buchung speichern (Entwurf)"
8. **Verify** booking is created successfully

### Scenario: Vendor Purchase with 7% VAT

1. **Navigate** to "Neue Buchung"
2. **In Quick Entry section:**
   - **Contact:** Select a Vendor (e.g., "Test Vendor GmbH")
   - **Gegenkonto:** Search and select "3400 - Wareneingang 19%" or any expense account
   - **MwSt-Satz:** 7%
   - **Bruttobetrag:** 107.00
3. **Click** "Ausfüllen" button
4. **Verify** that 3 booking lines are auto-generated:
   
   | Konto | Code | Name | Typ | Betrag |
   |-------|------|------|-----|--------|
   | 1 | 70001 | Test Vendor GmbH | Haben (Credit) | 107.00 € |
   | 2 | 3400 | Wareneingang | Soll (Debit) | 100.00 € |
   | 3 | 1571 | Vorsteuer 7% | Soll (Debit) | 7.00 € |

5. **Verify** balance and save

### Scenario: Tax-Free Transaction (0% VAT)

1. **Navigate** to "Neue Buchung"
2. **In Quick Entry section:**
   - **Contact:** Select any contact
   - **Gegenkonto:** Select "8100 - Steuerfreie Umsätze"
   - **MwSt-Satz:** 0% (Steuerfrei)
   - **Bruttobetrag:** 100.00
3. **Click** "Ausfüllen" button
4. **Verify** that only 2 booking lines are generated (no VAT line)

---

## Test 3: Account Search Functionality

### Scenario: Search for Accounts in Quick Entry

1. **Navigate** to "Neue Buchung"
2. **Click** on "Gegenkonto" dropdown
3. **Type** "erlös" in the search box
4. **Verify:** Only revenue accounts matching "erlös" are shown
5. **Try searching:**
   - By account code: "8400"
   - By partial name: "19%"
6. **Verify** search is case-insensitive and works on both code and name

---

## Test 4: Manual Override

### Scenario: User can still edit auto-filled lines

1. **Use Quick Entry** to auto-fill lines (any scenario)
2. **Manually edit** a booking line:
   - Change amount
   - Change account
   - Add new line
   - Delete a line
3. **Verify** manual edits are preserved
4. **Verify** balance indicator updates in real-time

---

## Expected Behavior Summary

✅ **Automatic Account Creation:**
- Customers get 10001+
- Vendors get 70001+
- Account name = Contact name
- Proper account type (asset/liability)

✅ **Quick Entry:**
- Auto-calculates net and tax
- Generates correct debit/credit lines
- Customer sale: Debit customer, Credit revenue+VAT
- Vendor purchase: Credit vendor, Debit expense+InputVAT
- Auto-fills contact and description

✅ **Search:**
- Works on account code and name
- Case-insensitive
- Filters by account type if specified

✅ **User Experience:**
- Real-time balance validation
- Clear visual feedback (green/red)
- Can override auto-filled values
- Smooth, intuitive workflow

---

## 🐛 Troubleshooting

**Issue:** VAT accounts not found
- **Solution:** Run `./vendor/bin/sail artisan db:seed --class=AccountSeeder`

**Issue:** Contact has no account_id
- **Solution:** Re-create the contact or manually assign an account

**Issue:** Booking lines don't auto-fill
- **Solution:** Check browser console for errors, verify all Quick Entry fields are filled

---

## 📸 Screenshots to Capture

1. Contacts list with new contact showing account code
2. Quick Entry section in Neue Buchung
3. Auto-filled booking lines after clicking "Ausfüllen"
4. Balance indicator showing "✓ Ausgeglichen"
5. Search functionality in Account Selector

---

**Happy Testing! 🎉**
