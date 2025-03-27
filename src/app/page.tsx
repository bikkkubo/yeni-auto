export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-24">
      <div className="max-w-4xl w-full">
        <h1 className="text-4xl font-bold mb-8">
          Auto Answer System
        </h1>
        
        <div className="bg-gray-100 p-6 rounded-lg shadow-sm mb-8">
          <h2 className="text-2xl font-semibold mb-4">System Overview</h2>
          <p className="mb-4">
            This system automatically processes incoming customer inquiries from Channelio,
            generates AI-based response drafts using Retrieval Augmented Generation (RAG), 
            and posts them to Slack for operator review.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-blue-50 p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold mb-2">Key Features</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Webhook integration with Channelio</li>
              <li>Vector search on knowledge base using Supabase pgvector</li>
              <li>RAG-based response generation using OpenAI</li>
              <li>Operator review workflow via Slack</li>
              <li>Robust error handling with notifications</li>
            </ul>
          </div>
          
          <div className="bg-green-50 p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold mb-2">Technical Stack</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Next.js with App Router</li>
              <li>TypeScript</li>
              <li>Supabase (PostgreSQL with pgvector)</li>
              <li>OpenAI API</li>
              <li>Slack API</li>
              <li>Tailwind CSS</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 text-center text-gray-500 text-sm">
          API Endpoint: <code className="bg-gray-100 px-2 py-1 rounded">/api/webhook/channelio</code>
        </div>
      </div>
    </main>
  );
}
