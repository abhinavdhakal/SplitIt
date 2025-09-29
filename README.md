# SplitIt - Smart Receipt Splitter

Every time we did groceries as roommates, we waited weeks before splitting the receipt as it was a hassle. By then, nobody remembered who bought what. Arguments started over simple things like *“Whose milk was this?”* or *“Did I even buy cheese last month?”*.

SplitIt fixes that. Upload the Walmart PDF receipt after each order, let everyone claim their items, and get an instant, fair breakdown. No more confusion, no more guessing.


![Project Status](https://img.shields.io/badge/Status-Production%20Ready-green)

---

## What It Does

* Create or join groups with simple codes
* Upload Walmart PDF receipts (other formats coming later)
* Claim items individually or split them with others
* Tax and tip divided fairly and automatically
* Clear summary of who owes what

---

## Screenshots

![Login page](/images/1.png)  
The login page where users enter credentials to access the app.

![Home page](/images/2.png)  
Main dashboard showing groups and recent activity.

![Uploading a receipt](/images/3.png)  
Group interface for managing receipts.

![Claiming items](/images/4.png)  
Screen where users can select and claim items from a receipt.

![Final expense summary](/images/5.png)  
Overview of all expenses and balances within the group.


---

## Example

Total receipt: $47.83

Alice: Milk, Bread, 3 Apples
Bob: Cheese, 2 Apples

Result: Alice pays $32.15, Bob pays $15.68.

Weeks later, everyone can still see exactly what they claimed.

---
# Setup

### Requirements

* Node.js 18+
* Supabase account
* Netlify (for hosting)

---

### Database

1. Create a new project in Supabase
2. Open the SQL editor and run `complete-setup.sql` (this sets up all tables and creates the `receipts` storage bucket)
3. In Supabase, go to **Connect → App Frameworks → Next.js** and copy the provided `.env.local` variables

---

### Local Development

1. Create a `.env.local` file in the project root and paste your Supabase variables

   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
   ```

2. Install dependencies

   ```bash
   npm install
   ```

3. Run the app locally

   ```bash
   npm run dev
   # Open http://localhost:3000
   ```

---

### Deploying to Netlify

1. Push this project to your own GitHub repository
2. In Netlify, click **New site from Git** and select your repo
3. Under **Site settings → Environment variables**, add the Supabase variables from `.env.local`
4. Netlify will auto-detect Next.js and use:

   ```bash
   npm run build
   ```
5. After build, your app will be live at a Netlify URL (you can also set a custom domain)

---

### Connect Supabase and Netlify

1. Copy your Netlify site URL
2. In Supabase, go to **Authentication → URL Configuration**
3. Add the Netlify URL to the list of allowed redirect URLs
4. Save changes

You’re done — users can now log in and start splitting receipts.
 
---


## Tech

* Next.js + React + Tailwind
* Supabase (Postgres + Auth)
* PDF.js (currently only Walmart PDF receipts)

---

## Notes

* Works only with Walmart PDF receipts right now
* Support for scanning printed receipts and other stores is planned

---

## License

MIT License
