# 🧾 SplitIt - Smart Receipt Splitter

A modern web application that makes splitting receipts with friends, roommates, or colleagues effortless. Upload a PDF receipt, and SplitIt will parse the items, let everyone claim what they bought, and calculate exactly who owes what.

![SplitIt Demo](https://img.shields.io/badge/Status-Production%20Ready-green)
![Next.js](https://img.shields.io/badge/Next.js-13.4.7-blue)
![Supabase](https://img.shields.io/badge/Supabase-Backend-green)

## ✨ Features

### 📱 **Simple Group Management**
- Create groups with easy-to-share room codes
- Join groups instantly with a 6-character code
- Invite friends without complex signup flows

### 🔍 **Smart PDF Receipt Parsing**
- Upload PDF receipts from stores like Walmart
- Automatic text extraction and item parsing  
- Handles quantities and prices accurately
- Works with various receipt formats

### 🎯 **Flexible Item Claiming**
- **Quantity Claims**: Claim 2 out of 5 apples with +/- controls
- **Item Splitting**: Split a single item (like pizza) between multiple people
- **Fair Sharing**: Set custom share ratios (1:1, 2:1, etc.)
- **Real-time Updates**: See claims as they happen

### 💰 **Automatic Expense Calculation**
- Proportional tax and tip distribution
- Handles rounding to the penny
- Clear breakdown showing who pays what
- Export-ready expense summaries

### 👥 **User-Friendly Experience**
- Magic link authentication (no passwords!)
- Custom display names and profiles
- Mobile-responsive design
- Dark/light mode support

## 🚀 Quick Start

### 1. **Join or Create a Group**
```
→ Visit the app
→ Sign up with your email
→ Create a new group OR join with a room code
```

### 2. **Upload a Receipt**
```
→ Click "Upload Receipt" in your group
→ Select a PDF receipt from your phone/computer
→ Wait for automatic parsing
```

### 3. **Claim Your Items**
```
→ Use +/- buttons for quantity items
→ Click "Split Item" for shared items (pizza, etc.)
→ Add people and set share amounts
```

### 4. **Finalize & Pay**
```
→ Group creator clicks "Finalize"
→ Everyone sees exactly what they owe
→ Share payment details or settle up
```

## 🛠️ Tech Stack

- **Frontend**: Next.js 13, React 18, Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth)
- **PDF Processing**: PDF.js for text extraction
- **Deployment**: Netlify (recommended)
- **Authentication**: Email magic links via Supabase

## 📋 Self-Hosting Setup

Want to run your own instance? Here's how:

### Prerequisites
- Node.js 18+
- Supabase account
- Netlify account (for deployment)

### 1. **Clone & Install**
```bash
git clone https://github.com/abhinavdhakal/SplitIt.git
cd SplitIt
npm install
```

### 2. **Database Setup**
1. Create a new Supabase project
2. Run these SQL files in order:
   - `setup.sql` - Main tables
   - `user_profiles.sql` - User profiles  
   - `item_claims.sql` - Item splitting

### 3. **Environment Variables**
Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. **Development**
```bash
npm run dev
# App runs on http://localhost:3000
```

### 5. **Production Deployment**
```bash
npm run build
npm start
# Or deploy to Netlify
```

## 🗄️ Database Schema

### Core Tables
- **`groups`** - Group information and room codes
- **`group_members`** - User membership in groups
- **`receipts`** - Uploaded receipts and metadata
- **`items`** - Parsed receipt items with prices
- **`item_claims`** - User claims on items (quantities/splits)
- **`user_profiles`** - Display names and user info
- **`logs`** - Audit trail for all actions

## 🎮 Usage Examples

### Scenario 1: Grocery Run
```
🛒 Alice uploads Walmart receipt: $47.83
📦 Items: Milk, Bread, Apples (×5), Cheese
👥 Claims:
   - Alice: Milk, Bread, Apples (×3)
   - Bob: Cheese, Apples (×2)
💰 Result: Alice pays $32.15, Bob pays $15.68
```

### Scenario 2: Pizza Night
```
🍕 Bob uploads restaurant receipt: $35.60
📦 Items: 2 Pizzas, Drinks (×4), Salad
👥 Claims:
   - Pizza #1: Split between Alice (2 shares), Bob (1 share)
   - Pizza #2: Split equally between Carol & Dave
   - Drinks: Everyone claims 1 each
💰 Result: Fair split with tax/tip distributed proportionally
```

## 🔧 Configuration

### Supabase Settings
- **Authentication**: Enable email auth
- **RLS**: Disabled for MVP (enable for production)
- **Site URL**: Set to your domain
- **Redirect URLs**: Include your production URL

### Receipt Parsing
- **Supported formats**: PDF with selectable text
- **Store compatibility**: Walmart, most grocery stores
- **Languages**: English (extensible)

## 🐛 Troubleshooting

### PDF Not Parsing?
- Ensure PDF has selectable text (not just an image)
- Check browser console for parsing logs
- Try a different receipt format

### Items Missing Names?
- Parser extracts from receipt structure
- Some stores format differently
- Manual editing coming soon

### Claims Not Saving?
- Check internet connection
- Verify Supabase environment variables
- Look for browser console errors

### "Row Level Security Policy" Error
- Make sure you ran all SQL setup files in Supabase
- Check that your user is authenticated (signed in with email)
- The setup creates permissive policies for authenticated users

## 🤝 Contributing

We welcome contributions! Here's how:

1. **Fork the repo**
2. **Create a feature branch**: `git checkout -b my-new-feature`
3. **Make your changes** with tests
4. **Commit**: `git commit -am 'Add some feature'`
5. **Push**: `git push origin my-new-feature`
6. **Create Pull Request**

### Development Guidelines
- Use TypeScript for new features
- Follow existing code style
- Add tests for new functionality
- Update documentation

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **PDF.js** - Mozilla's PDF parsing library
- **Supabase** - Backend-as-a-Service platform
- **Next.js** - React framework
- **Tailwind CSS** - Utility-first CSS framework

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/abhinavdhakal/SplitIt/issues)
- **Discussions**: [GitHub Discussions](https://github.com/abhinavdhakal/SplitIt/discussions)
- **Email**: Create an issue for support

---

**Made with ❤️ for hassle-free expense splitting**

*No more mental math, awkward IOUs, or "I'll pay you back later" - just fair, transparent expense sharing.*

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
