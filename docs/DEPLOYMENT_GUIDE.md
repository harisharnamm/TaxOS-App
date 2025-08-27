# Edge Function Deployment Guide

## 🚀 Deploy to Supabase Dashboard

Since we can't use the Supabase CLI in this environment, follow these steps to deploy manually:

### 1. Access Supabase Dashboard
- Go to [Supabase Dashboard](https://supabase.com/dashboard)
- Select your project
- Navigate to **Edge Functions** in the sidebar

### 2. Create New Function
- Click **"New Function"**
- Function name: `process-document-ai`
- Copy the code from `supabase/functions/process-document-ai/index.ts`
- Click **"Deploy Function"**

### 3. Create Chat Function
- Click **"New Function"** again
- Function name: `chat`
- Copy the code from `supabase/functions/chat/index.ts`
- Click **"Deploy Function"**

### 4. Set Environment Variables
In your Supabase project settings, add:

```
OPENAI_API_KEY=your_openai_api_key_here
```

The following are auto-populated by Supabase:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### 5. Test the Functions
After deployment, test the functions:

#### Test process-document-ai:
```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/process-document-ai' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"document_id": "test-id", "user_id": "test-user"}'
```

#### Test chat:
```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/chat' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"message": "Hello, can you help me with tax deductions?"}'
```

## 🔧 Alternative: Using Supabase CLI (if available)

If you have the Supabase CLI installed locally:

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy functions
supabase functions deploy process-document-ai
supabase functions deploy chat

# Set secrets
supabase secrets set OPENAI_API_KEY=your_openai_api_key_here
```

## 🎯 What These Functions Do

### process-document-ai
- Analyzes uploaded IRS documents using OCR simulation and OpenAI
- Extracts key information (notice type, amounts, deadlines)
- Creates/updates IRS notice records in the database
- Provides AI-powered recommendations

### chat
- Handles AI-powered tax consultation chat
- Uses OpenAI Assistant API for professional tax advice
- Supports document context and client-specific conversations
- Saves chat history to the database

## ✅ Verification

After deployment, check:
1. Functions appear in your Supabase Edge Functions dashboard
2. No deployment errors in the logs
3. Environment variables are set correctly
4. Test API calls return expected responses

## 🔍 Troubleshooting

**Common Issues:**
- **401 Unauthorized**: Check your API keys and authentication
- **500 Internal Error**: Verify environment variables are set
- **Timeout**: OpenAI API calls may take time, this is normal
- **CORS Issues**: Functions include proper CORS headers

**Debug Steps:**
1. Check function logs in Supabase dashboard
2. Verify environment variables
3. Test with simple requests first
4. Check OpenAI API key validity

## 🎉 Ready to Use!

Once deployed, your IRS Notices page will have full AI-powered analysis capabilities!