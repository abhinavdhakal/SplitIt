# Receipt Splitter - Setup Instructions

## Quick Setup Steps

### 1. Database Setup

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Go to the SQL Editor in your Supabase dashboard
3. Copy and paste the contents of `database/simple-setup.sql` and run it
4. This will create all necessary tables with permissive RLS policies

### 2. Environment Variables

Create a `.env.local` file in your project root:

```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Install and Run

```bash
npm install
npm run dev
```

## Troubleshooting

### "Row Level Security Policy" Error

If you get RLS errors when uploading receipts:

1. Make sure you ran the `simple-setup.sql` script in Supabase
2. Check that your user is authenticated (signed in with email)
3. The setup script creates permissive policies for authenticated users

### PDF Parsing Issues

If receipts show "Items: 0":

1. Check browser console for debug logs
2. The parser works best with text-based PDFs (not scanned images)
3. Currently optimized for Walmart+ style receipts

### Room Code Not Working

- Room codes are just the group ID (UUID)
- Make sure the person joining is signed in
- The group must exist and be accessible

## Features

- **Simple Login**: Email magic link authentication
- **Groups**: Create groups and share room codes
- **Receipt Upload**: PDF parsing for Walmart+ receipts
- **Item Claiming**: Members can claim items from receipts
- **Auto Split**: Tax and tip split proportionally
- **Mobile Friendly**: Responsive design

## Database Tables Created

- `groups` - Group information
- `group_members` - Who belongs to which group
- `receipts` - Uploaded receipts with parsed data
- `items` - Individual items from receipts
- `logs` - Audit trail of actions
