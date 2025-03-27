# Auto Answer System

An automated response system that uses AI and RAG (Retrieval Augmented Generation) to generate draft responses to customer inquiries.

## Project Overview

This system automates the handling of customer inquiries by:

1. Receiving webhook notifications from Channelio with customer inquiries
2. Using Supabase's pgvector to find relevant documents from a knowledge base
3. Generating AI-powered response drafts with OpenAI using the RAG approach
4. Sending both the original inquiry and AI-generated draft to Slack for operator review
5. Implementing robust error handling with Slack notifications

## Technology Stack

- **Framework**: Next.js with App Router
- **Language**: TypeScript
- **Hosting**: Vercel
- **Database**: Supabase (PostgreSQL with pgvector extension)
- **AI Model**: OpenAI GPT-3.5 Turbo API
- **Notification**: Slack API
- **Styling**: Tailwind CSS

## Getting Started

### Prerequisites

- Node.js 18.x or later
- A Supabase account and project with pgvector extension enabled
- OpenAI API account and key
- Slack workspace with appropriate permissions to create a bot

### Environment Setup

Copy `.env.local.example` to `.env.local` and fill in your credentials:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI
OPENAI_API_KEY=your-openai-api-key
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Slack
SLACK_BOT_TOKEN=your-slack-bot-token
SLACK_CHANNEL_ID=your-operator-channel-id
SLACK_ERROR_CHANNEL_ID=your-error-channel-id

# Webhook Security (optional)
CHANNELIO_WEBHOOK_SECRET=your-webhook-secret
```

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Supabase Setup

1. Enable pgvector extension in your Supabase project
2. Create a `documents` table with:
   - `id` (uuid, primary key)
   - `content` (text)
   - `metadata` (jsonb)
   - `embedding` (vector)
3. Create a stored procedure for similarity search:

```sql
CREATE OR REPLACE FUNCTION match_documents (
  query_embedding vector,
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.content,
    d.metadata,
    1 - (d.embedding <=> query_embedding) AS similarity
  FROM documents d
  WHERE 1 - (d.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
```

### Webhook Setup

Configure Channelio to send webhook notifications to your deployed endpoint:

```
https://your-deployed-app.vercel.app/api/webhook/channelio
```

## License

[MIT](LICENSE)
