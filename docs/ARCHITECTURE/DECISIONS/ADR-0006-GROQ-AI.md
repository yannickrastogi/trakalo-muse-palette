# ADR-0006: Groq for AI Inference

> **Status:** Accepted  
> **Date:** August 11, 2026  
> **Author:** Ishan  
> **Supersedes:** None

---

## Context

Trakalog requires AI capabilities for two core features: Smart A&R (matching tracks to briefs) and lyric transcription. We needed a fast, cost-effective, and reliable AI inference provider that could handle both text generation (LLMs) and audio transcription workloads.

### Problem Statement

We evaluated AI providers for our inference needs:

1. **OpenAI:** GPT-4, Whisper
2. **Groq:** Llama models, Whisper
3. **Anthropic:** Claude models
4. **Google:** Vertex AI (Gemini, etc.)
5. **AWS:** Bedrock, Transcribe
6. **Local/On-Prem:** Self-hosted models

Our requirements:
- **Text Generation:** LLM for Smart A&R matching (analyzing catalogs and briefs)
- **Audio Transcription:** Whisper model for lyric extraction
- **Low Latency:** Sub-second response times for good UX
- **Cost-Effective:** Affordable at scale (thousands of queries/month)
- **Reliable:** High uptime, consistent performance
- **Easy Integration:** Simple API, good SDK support

### Constraints

- Limited AI budget (pre-revenue startup)
- Need for consistent, deterministic outputs (not creative generation)
- Must handle variable-length audio files (30s to 10+ minutes)
- Must process large context windows (1000+ tracks in catalog)
- Must integrate with Supabase Edge Functions

---

## Decision

**We chose Groq as our primary AI inference provider, using Llama 3.3 70B for Smart A&R and Whisper Large v3 for transcription.**

### Implementation

1. **Smart A&R:**
   - **Model:** `llama-3.3-70b-versatile`
   - **Context Window:** 128,000 tokens
   - **Use Case:** Analyzing track catalogs and matching against A&R briefs
   - **Typical Prompt:** 5,000-100,000 tokens (50-1000 tracks)
   - **Output:** JSON with matched track IDs and reasoning

2. **Lyric Transcription:**
   - **Model:** `whisper-large-v3`
   - **Use Case:** Extracting lyrics from audio files
   - **Typical Duration:** 30s-10min of audio
   - **Output:** Plain text with timestamps

3. **Integration Pattern:**
   - All AI calls routed through Supabase Edge Functions
   - Single Groq API key used across all services
   - Rate limiting at both IP and user level
   - Usage tracking per user for billing

4. **Error Handling:**
   - Automatic retry on rate limits (429)
   - Graceful degradation when AI unavailable
   - Circuit breakers to prevent cascading failures

---

## Alternatives Considered

### Option 1: OpenAI

**Pros:**
- **Best Models:** GPT-4 is state-of-the-art for text understanding
- **Whisper:** Industry-standard for transcription
- **Reliability:** Excellent uptime and performance
- **Ecosystem:** Large community, extensive documentation
- **Features:** Rich API with many capabilities

**Cons:**
- **Cost:** GPT-4 is expensive ($20-30/1M tokens input, $40-60/1M output)
- **Latency:** Higher latency than Groq (2-5s vs <1s)
- **No Context Window Advantage:** For our use case, Llama 3.3 70B context window is sufficient
- **Less Deterministic:** More creative, less predictable for structured outputs

**Why Not Chosen:** Cost was the primary factor. At our scale, Groq is 5-10x cheaper for the same capability. OpenAI's latency would also negatively impact UX.

### Option 2: Anthropic Claude

**Pros:**
- **Excellent at Following Instructions:** Great for structured outputs
- **Large Context Window:** Claude 3.5 Sonnet has 200K context
- **Reliability:** Very consistent performance
- **JSON Mode:** Native support for JSON outputs

**Cons:**
- **Cost:** More expensive than Groq ($3-15/1M tokens)
- **Latency:** Higher than Groq
- **Limited Model Options:** Fewer model choices
- **No Transcription:** Would need separate service for Whisper

**Why Not Chosen:** Cost and lack of transcription capability. Would have required two providers (Claude + another for transcription), adding complexity.

### Option 3: Google Vertex AI

**Pros:**
- **Enterprise Grade:** SOC2, HIPAA compliant
- **Integrated:** Part of Google Cloud ecosystem
- **Multiple Models:** Access to many model providers
- **Custom Models:** Can fine-tune models

**Cons:**
- **Complex Setup:** Requires Google Cloud project and configuration
- **Cost:** Similar to OpenAI
- **Latency:** Higher than specialized providers
- **No Native Whisper:** Would need custom integration
- **Cold Starts:** Can have latency spikes

**Why Not Chosen:** Overkill for our needs, and the setup complexity doesn't justify the benefits for a startup.

### Option 4: AWS Bedrock

**Pros:**
- **Enterprise Grade:** AWS reliability and security
- **Model Selection:** Access to many model providers
- **Integrated:** Works with other AWS services

**Cons:**
- **Complex:** Requires AWS expertise
- **Cost:** Similar to other enterprise providers
- **Setup Overhead:** Significant configuration required
- **No Native Whisper:** Would need separate transcription

**Why Not Chosen:** Similar to Google, the complexity and cost don't align with our needs as a startup.

### Option 5: Local/On-Prem Models

**Pros:**
- **No API Costs:** Only infrastructure costs
- **Full Control:** Can customize models, no rate limits
- **Privacy:** Data stays within our infrastructure
- **Customization:** Can fine-tune on our data

**Cons:**
- **Infrastructure Cost:** Requires GPU servers
- **Maintenance:** Model hosting, updates, scaling
- **Expertise:** Requires ML engineering knowledge
- **Latency:** Inference on CPU is slow without GPUs
- **Model Quality:** May not match commercial providers

**Why Not Chosen:** The infrastructure and maintenance costs outweigh the API savings. We don't have the ML expertise to maintain high-quality models.

---

## Consequences

### Positive

1. **Cost-Effective:** 5-10x cheaper than OpenAI for our workload
2. **Fast:** Sub-second latency for most queries
3. **Reliable:** Excellent uptime and consistent performance
4. **Simple:** Easy API with good TypeScript support
5. **Good Models:** Llama 3.3 70B performs well for our use case
6. **Whisper Support:** Native Whisper Large v3 for transcription
7. **SOC2 Compliant:** Enterprise-grade security
8. **Global:** Low-latency access worldwide

### Negative

1. **Limited Model Selection:** Fewer models than some providers
2. **Less Mature:** Smaller ecosystem than OpenAI
3. **No Fine-Tuning:** Can't fine-tune Groq models on our data
4. **Rate Limits:** Must manage rate limiting carefully
5. **Token Limits:** Context window limits our catalog size

### Mitigations

1. **Monitor Model Releases:** Track Groq's model updates and adopt new models
2. **Fallback Strategy:** Implement fallback to other providers if needed
3. **Rate Limiting:** Multi-level rate limiting (IP, user, global)
4. **Context Management:** Chunk large catalogs or use filtering to stay within context limits
5. **Performance Monitoring:** Track latency and error rates

---

## References

- [Groq Documentation](https://console.groq.com/docs)
- [Groq Pricing](https://console.groq.com/docs/pricing)
- [ARCHITECTURE/GROQ_USAGE_AND_COSTS.md](../GROQ_USAGE_AND_COSTS.md) - Detailed usage and cost analysis
- [05 - Service Architecture](../05-SERVICE_ARCHITECTURE.md) - AI service integration
- [FEATURES/SMART_AR.md](../../FEATURES/SMART_AR.md) - Smart A&R implementation

---

## Appendix: Implementation Notes

### Cost Analysis (as of August 2026)

| Model | Groq Price | OpenAI Equivalent | OpenAI Price | Groq Advantage |
|-------|------------|-------------------|---------------|----------------|
| llama-3.3-70b-versatile | $0.59/1M input, $0.79/1M output | GPT-4 | $20/1M input, $40/1M output | **34x cheaper** |
| whisper-large-v3 | $0.111/hour of audio | Whisper Large v3 | $0.06/min = $3.60/hour | **32x cheaper** |

### Example Costs

**Smart A&R:**
- 50 track catalog: ~5,750 input tokens = **$0.004**
- 500 track catalog: ~50,750 input tokens = **$0.030**
- 1000 track catalog: ~100,750 input tokens = **$0.060**

**Transcription:**
- 3 minute track: ~3 min audio = **$0.0056**
- 10 minute track: ~10 min audio = **$0.0185**

### Current Usage (August 2026)

| Feature | Model | Volume | Monthly Cost |
|---------|-------|--------|--------------|
| Smart A&R | llama-3.3-70b-versatile | ~50 queries | ~$0.50 |
| Transcription | whisper-large-v3 | ~200 tracks | ~$4.00 |
| **Total** | | | **~$4.50/month** |

### Edge Function Integration

```typescript
// supabase/functions/smart-ar/index.ts
import { Groq } from 'groq-sdk'

const groq = new Groq({ apiKey: Deno.env.get('GROQ_API_KEY') })

async function callGroq(prompt, model = 'llama-3.3-70b-versatile') {
  const response = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model,
    temperature: 0.1, // Low for deterministic outputs
    max_tokens: 4096,
    response_format: { type: 'json_object' }, // Force JSON output
  })
  
  return response.choices[0].message.content
}
```

### Rate Limiting Strategy

```typescript
// In smart-ar edge function
const ip = req.headers.get('x-forwarded-for') || 'unknown'

// IP rate limit: 20/hour
const { data: ipLimit } = await supabase.rpc('check_rate_limit', {
  _key: `groq-ip:${ip}`,
  _max_requests: 20,
  _window_seconds: 3600,
})

// User rate limit: 100/hour
const { data: userLimit } = await supabase.rpc('check_rate_limit', {
  _key: `groq-user:${user.id}`,
  _max_requests: 100,
  _window_seconds: 3600,
})

// Global rate limit: 3000/24h
const { data: globalLimit } = await supabase.rpc('check_rate_limit', {
  _key: 'groq-global',
  _max_requests: 3000,
  _window_seconds: 86400,
})
```

### Context Window Management

The `llama-3.3-70b-versatile` model has a 128,000 token context window. We manage this by:

1. **Track Representation:** ~100 tokens per track
2. **Catalog Limitation:** Max ~1,250 tracks per query
3. **Field Filtering:** Omit less important fields for large catalogs (>40 tracks)
4. **Chunking:** For very large catalogs, split into multiple queries

---

## Document Metadata

| Property | Value |
|----------|-------|
| **Created** | August 11, 2026 |
| **Version** | 1.0.0 |
| **Status** | Accepted |
| **Owner** | Ishan |
| **Last Review** | August 18, 2026 |
| **Next Review** | August 11, 2027 |

---

*This ADR is a living document and may be updated as our AI provider needs evolve.*
