# ADR-0005: R2 Cloud Storage Over S3

> **Status:** Accepted  
> **Date:** August 11, 2026  
> **Author:** Ishan  
> **Supersedes:** None

---

## Context

Trakalog needs to store large quantities of audio files (WAV, MP3), cover art, stems, and documents. These files range from small images (<1MB) to large audio files (>100MB). The storage solution must be secure, scalable, reliable, and cost-effective while integrating well with our Supabase-based backend.

### Problem Statement

We evaluated cloud storage providers for our file storage needs:

1. **AWS S3:** The industry standard object storage
2. **Cloudflare R2:** Cloudflare's S3-compatible storage
3. **Supabase Storage:** Built-in Supabase file storage
4. **Google Cloud Storage:** Google's alternative to S3
5. **Backblaze B2:** Budget-friendly S3-compatible storage

Our requirements:
- Store millions of audio files (WAV, MP3, stems)
- Support files up to 500MB each
- High availability and durability
- Global CDN for fast access
- Secure access with signed URLs
- S3-compatible API for easy integration
- Cost-effective at scale
- No egress fees for downloads (important for shared links)

### Constraints

- Must integrate with Supabase (our primary backend)
- Must support signed URL generation for secure access
- Must have global CDN for performance
- Must be SOC2 compliant for music industry requirements
- Must support custom metadata and lifecycle policies
- Must allow direct uploads from client (browser)

---

## Decision

**We chose Cloudflare R2 as our primary object storage, with Supabase Storage as a secondary option for certain use cases.**

### Implementation

1. **Primary Storage: R2**
   - All production audio files (tracks, stems, watermarked)
   - All cover art and documents
   - Direct client uploads via pre-signed URLs
   - CDN distribution via Cloudflare

2. **Buckets Structure:**
   - `trakalog-tracks`: Original track audio (WAV, MP3)
   - `trakalog-watermarked`: Watermarked audio for shared links
   - `trakalog-stems`: Individual stem files
   - `trakalog-covers`: Track and album cover art
   - `trakalog-documents`: Contracts, PDFs, and other documents

3. **Integration Pattern:**
   - Supabase Edge Functions generate R2 pre-signed URLs
   - Frontend uploads/downloads directly to/from R2
   - All access mediated through edge functions (no direct public access)

4. **Supabase Storage Usage:**
   - Development and testing environments
   - Temporary files during processing
   - Fallback for certain operations

---

## Alternatives Considered

### Option 1: AWS S3

**Pros:**
- Industry standard, proven at massive scale
- Extensive feature set (versioning, lifecycle, analytics)
- Rich ecosystem and third-party integrations
- Regional buckets for compliance
- Mature and stable

**Cons:**
- **Egress Fees:** Expensive data transfer costs ($0.09/GB for first 10TB)
- **Complex Pricing:** Hard to predict costs with many variables
- **No Built-in CDN:** Requires CloudFront for CDN (additional cost)
- **Cold Starts:** First access to infrequently accessed files can be slow
- **Minimum Object Size:** Charges for small files (not ideal for metadata-heavy workloads)

**Why Not Chosen:** The egress fees are prohibitive for our use case where tracks are frequently shared and downloaded. A label with 100GB of monthly downloads would pay ~$9/month just in egress fees, which scales poorly.

### Option 2: Supabase Storage Only

**Pros:**
- **Integrated:** Native Supabase integration
- **Simple:** No additional service to manage
- **Consistent:** Same auth and permissions as database
- **S3-Compatible:** Can use S3 SDK for advanced features

**Cons:**
- **Limited Features:** Missing some S3 features (lifecycle policies, detailed analytics)
- **Cost:** More expensive than R2 at scale
- **Egress Fees:** Has data transfer costs similar to S3
- **Performance:** May not match R2's CDN performance
- **Vendor Lock-in:** Harder to migrate away from Supabase

**Why Not Chosen:** While Supabase Storage works well, R2 offers better pricing and performance for our specific use case. We use Supabase Storage selectively where it makes sense.

### Option 3: Google Cloud Storage

**Pros:**
- **Integrated with GCP:** Good if using other GCP services
- **Strong Features:** Versioning, lifecycle, analytics
- **Global Network:** Good CDN performance
- **S3-Compatible:** Interoperable via API

**Cons:**
- **Egress Fees:** Similar to S3 (though slightly better pricing)
- **Pricing Complexity:** Many variables affect cost
- **Less Common:** Smaller ecosystem than S3
- **Cold Storage:** Additional complexity for archival

**Why Not Chosen:** Similar egress fee concerns as S3, plus our stack is primarily on Cloudflare/Vercel rather than GCP.

### Option 4: Backblaze B2

**Pros:**
- **Low Cost:** Cheaper storage than S3
- **S3-Compatible:** Works with existing S3 tools
- **No Egress Fees to Cloudflare:** Free egress to Cloudflare CDN
- **Simple Pricing:** Easy to understand cost structure

**Cons:**
- **Smaller Ecosystem:** Less mature than S3/R2
- **Limited Features:** Fewer advanced features than S3
- **Performance:** May not match S3/R2 for high throughput
- **Separate CDN:** Requires Cloudflare CDN setup

**Why Not Chosen:** R2 offers the same no-egress-to-Cloudflare benefit with better performance, more features, and tighter Cloudflare integration.

---

## Consequences

### Positive

1. **No Egress Fees:** Zero-cost downloads to Cloudflare CDN
2. **Global CDN:** Fast access worldwide via Cloudflare's network
3. **S3-Compatible:** Easy integration with existing tools and libraries
4. **Cost Predictability:** Simple pricing ($0.015/GB/month storage, $0/GB egress to CF)
5. **Tight Integration:** Works seamlessly with Cloudflare Workers, Functions
6. **Vercel Integration:** Easy to use with Vercel deployments
7. **Supabase Integration:** Works well with Supabase Edge Functions
8. **Instant Access:** Files available immediately via Cloudflare CDN

### Negative

1. **Cold Storage Cost:** No built-in archival tier (must manage lifecycle manually)
2. **Limited Regions:** Fewer regional options than S3
3. **No Versioning:** Versioning must be implemented at application level
4. **Cloudflare Lock-in:** Tight integration with Cloudflare ecosystem
5. **Feature Maturity:** Some features still catching up to S3

### Mitigations

1. **Lifecycle Management:** Implement custom lifecycle via metadata and cleanup jobs
2. **Multi-Region:** Use Cloudflare's global network for distribution
3. **Application Versioning:** Implement file versioning in application code
4. **Abstraction Layer:** Storage service abstraction allows future migration
5. **Feature Monitoring:** Track R2 feature development and adopt as available

---

## References

- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [R2 Pricing](https://developers.cloudflare.com/r2/platform/pricing/)
- [CLAUDE_R2_PHASE2_REPORT.md](../CLAUDE_R2_PHASE2_REPORT.md) - R2 migration details
- [05 - Service Architecture](../05-SERVICE_ARCHITECTURE.md) - Storage service details
- [07 - Deployment Architecture](../07-DEPLOYMENT_ARCHITECTURE.md) - Infrastructure overview

---

## Appendix: Implementation Notes

### R2 Integration Code

```javascript
// src/integrations/storage/r2.ts
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
})

export async function uploadToR2(bucket, key, body, contentType) {
  await r2.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  }))
}

export async function getR2SignedUrl(bucket, key, expiresIn = 3600) {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key })
  const url = await getSignedUrl(r2, command, { expiresIn })
  return url
}
```

### Supabase Edge Function Integration

```typescript
// supabase/functions/get-storage-url/index.ts
import { createClient } from '@supabase/supabase-js'
import { getR2SignedUrl } from '../../_shared/storage.ts'

Deno.serve(async (req) => {
  const { bucket, path, expiresInSec = 3600 } = await req.json()
  
  // Validate request
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  await validateAccess(supabase, req, bucket, path)
  
  // Generate signed URL
  const url = await getR2SignedUrl(bucket, path, expiresInSec)
  
  return new Response(JSON.stringify({ url }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

### Frontend Usage

```typescript
// src/hooks/useStorage.ts
import { useQuery } from '@tanstack/react-query'

export function useStorageSignedUrl(bucket, path, options = {}) {
  const { expiresInSec = 3600 } = options
  
  return useQuery({
    queryKey: ['storage-url', bucket, path, expiresInSec],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-storage-url', {
        body: { bucket, path, expiresInSec },
      })
      if (error) throw error
      return data.url
    },
    staleTime: expiresInSec * 1000 - 60000, // Refresh 1 minute before expiry
  })
}
```

### Migration from Supabase Storage to R2

The migration involved:
1. Creating R2 buckets matching Supabase Storage buckets
2. Copying all existing files to R2
3. Updating all storage references to use R2
4. Implementing edge functions for R2 signed URL generation
5. Testing all upload/download paths

See [CLAUDE_R2_PHASE2_REPORT.md](../CLAUDE_R2_PHASE2_REPORT.md) for detailed migration notes.

### Current Bucket Usage

| Bucket | Purpose | Size (Aug 2026) | Notes |
|--------|---------|----------------|-------|
| trakalog-tracks | Original audio | ~200GB | WAV and MP3 masters |
| trakalog-watermarked | Watermarked audio | ~50GB | Per-visitor watermarked copies |
| trakalog-stems | Stem files | ~50GB | Individual track stems |
| trakalog-covers | Cover art | ~1GB | JPEG/PNG images |
| trakalog-documents | PDFs, contracts | ~100MB | Generated documents |

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

*This ADR is a living document and may be updated as our storage needs evolve.*
