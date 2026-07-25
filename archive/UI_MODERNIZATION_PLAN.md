# UI Modernization Plan - Create Pages

## Design System
Based on the successful redesign of Welcome, Login, and Register pages, we'll apply the following design principles:

### Color Palette
- **Primary Gradient**: `from-indigo-600 to-cyan-600`
- **Background**: `from-indigo-50 via-white to-cyan-50` (light) / `from-gray-900 via-gray-900 to-gray-800` (dark)
- **Text**: 
  - Primary: `text-gray-900 dark:text-white`
  - Secondary: `text-gray-600 dark:text-gray-400`
  - Labels: `text-gray-900 dark:text-gray-100`
- **Borders**: `border-gray-200 dark:border-gray-700`
- **Cards**: `bg-white dark:bg-gray-800`
- **Inputs**: `bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600`

### Component Styling
1. **Headers**: Clear, bold titles with descriptive subtitles
2. **Cards**: White background with subtle shadows
3. **Buttons**: Gradient primary buttons, outline secondary buttons
4. **Inputs**: Visible borders, clear placeholder text
5. **Icons**: Positioned inside inputs where appropriate

## Pages to Modernize

### 1. BookingCreate.tsx (Priority: HIGH)
**Current State**: 1417 lines, complex form with quick entry
**Changes Needed**:
- Update header section with new color scheme
- Modernize card backgrounds and borders
- Update button styles (primary gradient, secondary outline)
- Improve input field styling
- Update Beleg selection cards
- Modernize quick entry section
- Update color scheme for validation states

### 2. BelegCreate.tsx (Priority: HIGH)
**Changes Needed**:
- Apply new header styling
- Update form card design
- Modernize file upload section
- Update button styles
- Improve input field appearance

### 3. InvoiceCreate.tsx (Priority: MEDIUM)
**Changes Needed**:
- Update header and navigation
- Modernize invoice form layout
- Update line items table styling
- Improve button appearance
- Update color scheme throughout

### 4. AccountCreate.tsx (Priority: LOW)
**Changes Needed**:
- Simple form modernization
- Update card and input styling
- Modernize buttons

## Implementation Strategy

### Phase 1: Core Components (Immediate)
1. Update BookingCreate.tsx - most frequently used
2. Update BelegCreate.tsx - closely related to bookings

### Phase 2: Secondary Pages (Next)
3. Update InvoiceCreate.tsx
4. Update AccountCreate.tsx

### Phase 3: Consistency Check
- Review all pages for consistent styling
- Ensure dark mode works properly
- Test all forms for usability

## Key Changes Per File

### Common Updates for All Pages:
```tsx
// Header Section
<div className="space-y-6">
    <div className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Page Title</h1>
            <p className="text-gray-600 dark:text-gray-400">Description</p>
        </div>
        <Button 
            variant="ghost" 
            className="text-gray-700 dark:text-gray-300"
            onClick={() => navigate('back')}
        >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
        </Button>
    </div>

    // Main Card
    <Card className="border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="border-b border-gray-200 dark:border-gray-700">
            <CardTitle className="text-gray-900 dark:text-white">Section Title</CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">Description</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
            // Form content
        </CardContent>
    </Card>

    // Primary Button
    <Button 
        className="bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white shadow-lg shadow-indigo-500/30"
    >
        Submit
    </Button>

    // Secondary Button
    <Button 
        variant="outline"
        className="border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
    >
        Cancel
    </Button>

    // Input Fields
    <Label className="text-gray-900 dark:text-gray-100">Field Label</Label>
    <Input 
        className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
        placeholder="Placeholder text"
    />
```

## Testing Checklist
- [ ] Light mode appearance
- [ ] Dark mode appearance
- [ ] Form validation styling
- [ ] Button hover states
- [ ] Input focus states
- [ ] Mobile responsiveness
- [ ] Accessibility (contrast ratios)

## Notes
- Maintain all existing functionality
- Only update visual styling
- Ensure backward compatibility
- Test thoroughly before deployment
