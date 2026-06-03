import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const GATEWAY = 'https://connector-gateway.lovable.dev/linkedin';

interface ShareBody {
  text: string;
  linkUrl?: string;
  imageBase64?: string; // data URL or raw base64
  imageContentType?: string; // e.g. image/jpeg
  imageAltText?: string;
}

function gatewayHeaders() {
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');
  const linkedInKey = Deno.env.get('LINKEDIN_API_KEY');
  if (!lovableKey) throw new Error('LOVABLE_API_KEY missing');
  if (!linkedInKey) throw new Error('LINKEDIN_API_KEY missing');
  return {
    Authorization: `Bearer ${lovableKey}`,
    'X-Connection-Api-Key': linkedInKey,
  };
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(',') ? b64.split(',')[1] : b64;
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function getPersonUrn(): Promise<string> {
  const r = await fetch(`${GATEWAY}/v2/userinfo`, { headers: gatewayHeaders() });
  if (!r.ok) throw new Error(`userinfo ${r.status}: ${await r.text()}`);
  const j = await r.json();
  if (!j.sub) throw new Error('userinfo missing sub');
  return `urn:li:person:${j.sub}`;
}

async function registerImageUpload(ownerUrn: string) {
  const body = {
    registerUploadRequest: {
      recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
      owner: ownerUrn,
      serviceRelationships: [
        { relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' },
      ],
    },
  };
  const r = await fetch(`${GATEWAY}/v2/assets?action=registerUpload`, {
    method: 'POST',
    headers: { ...gatewayHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`registerUpload ${r.status}: ${await r.text()}`);
  const j = await r.json();
  const uploadUrl: string = j?.value?.uploadMechanism?.[
    'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
  ]?.uploadUrl;
  const asset: string = j?.value?.asset;
  if (!uploadUrl || !asset) throw new Error('registerUpload missing uploadUrl/asset');
  return { uploadUrl, asset };
}

async function uploadImageBytes(uploadUrl: string, bytes: Uint8Array, contentType: string) {
  // LinkedIn upload URL is signed; do NOT route through the gateway.
  const r = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: bytes,
  });
  if (!r.ok && r.status !== 201) {
    throw new Error(`image upload ${r.status}: ${await r.text()}`);
  }
}

async function createPost(ownerUrn: string, text: string, asset?: string, altText?: string) {
  const media = asset
    ? [
        {
          status: 'READY',
          description: { text: altText || '' },
          media: asset,
          title: { text: altText || '' },
        },
      ]
    : [];
  const body = {
    author: ownerUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: asset ? 'IMAGE' : 'NONE',
        media,
      },
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
  };
  const r = await fetch(`${GATEWAY}/v2/ugcPosts`, {
    method: 'POST',
    headers: {
      ...gatewayHeaders(),
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`ugcPosts ${r.status}: ${await r.text()}`);
  const id = r.headers.get('x-restli-id') || (await r.json().then((j) => j.id).catch(() => null));
  return id;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey);
  let userId: string | null = null;
  let logId: string | null = null;

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace('Bearer ', '');
    if (jwt) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
      });
      const { data: u } = await userClient.auth.getUser();
      userId = u?.user?.id ?? null;
    }

    const body = (await req.json()) as ShareBody;
    if (!body?.text || typeof body.text !== 'string' || body.text.length < 1 || body.text.length > 3000) {
      return new Response(JSON.stringify({ error: 'text must be 1-3000 chars' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let finalText = body.text;
    if (body.linkUrl && !finalText.includes(body.linkUrl)) {
      finalText = `${finalText}\n\n${body.linkUrl}`;
    }

    // Insert queued log
    if (userId) {
      const { data: ins } = await admin.from('linkedin_posts').insert({
        user_id: userId,
        status: 'queued',
        text_snippet: finalText.slice(0, 500),
        link_url: body.linkUrl ?? null,
        has_image: !!body.imageBase64,
      }).select('id').single();
      logId = ins?.id ?? null;
    }

    const ownerUrn = await getPersonUrn();

    let assetUrn: string | undefined;
    if (body.imageBase64) {
      const contentType = body.imageContentType || 'image/jpeg';
      const bytes = base64ToBytes(body.imageBase64);
      const reg = await registerImageUpload(ownerUrn);
      await uploadImageBytes(reg.uploadUrl, bytes, contentType);
      assetUrn = reg.asset;
    }

    const postId = await createPost(ownerUrn, finalText, assetUrn, body.imageAltText);

    const urn = postId || '';
    const activityId = urn.includes(':') ? urn.split(':').pop() : urn;
    const postUrl = activityId
      ? `https://www.linkedin.com/feed/update/${urn}`
      : 'https://www.linkedin.com/feed/';

    if (logId) {
      await admin.from('linkedin_posts').update({
        status: 'published',
        post_id: postId,
        post_url: postUrl,
        published_at: new Date().toISOString(),
      }).eq('id', logId);
    }

    return new Response(JSON.stringify({ ok: true, postId, postUrl }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = String((e as any)?.message || e);
    if (logId) {
      await admin.from('linkedin_posts').update({
        status: 'failed',
        error_message: msg.slice(0, 2000),
        failed_at: new Date().toISOString(),
      }).eq('id', logId);
    }
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});