/*
# Worker Proxy Edge Function

This Edge Function acts as a secure proxy between the ViralClip AI frontend and
the external yt-dlp/ffmpeg backend worker. The frontend never talks to the worker
directly — all requests go through this function, which:

1. Authenticates the user via their Supabase JWT.
2. Creates/updates job records in Supabase.
3. Forwards the request to the external worker (configured via WORKER_URL secret).
4. Returns the worker response to the frontend with CORS headers.

## Worker API (expected by this proxy)
- POST /api/jobs — create a processing job
- GET /api/jobs/:id — get job status + clip results
- POST /api/jobs/:id/retry — retry a failed job
- GET /api/clips/:id/download — download a rendered MP4

## Required Secrets
- WORKER_URL: Base URL of the external worker (e.g. https://worker.example.com)
- WORKER_API_KEY: Shared secret for worker authentication

## Setup
1. Deploy this function.
2. Set WORKER_URL and WORKER_API_KEY in Supabase Edge Function secrets.
3. Point your external worker to read/write job status from Supabase directly
   (using the service role key), OR have the worker call back to this proxy.
*/

import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RouteMatch {
  handler: (req: Request, supabase: any, match: RegExpMatchArray, user: any) => Promise<Response>;
}

const routes: { method: string; pattern: RegExp; handler: RouteMatch["handler"] }[] = [
  // POST /worker-proxy/jobs — create job on worker
  {
    method: "POST",
    pattern: /^\/worker-proxy\/jobs\/?$/,
    handler: async (req, supabase, _match, user) => {
      const body = await req.json();
      const { job_id, project_id, youtube_url, settings } = body;

      // Verify ownership
      const { data: job } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", job_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!job) {
        return new Response(JSON.stringify({ error: "Job not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const workerUrl = Deno.env.get("WORKER_URL");
      const workerKey = Deno.env.get("WORKER_API_KEY");

      if (!workerUrl || !workerKey) {
        // Worker not configured — update job to failed with helpful message
        await supabase
          .from("jobs")
          .update({
            status: "failed",
            error_message: "Worker is not configured. Please set WORKER_URL and WORKER_API_KEY secrets.",
            error_code: "WORKER_NOT_CONFIGURED",
          })
          .eq("id", job_id);

        return new Response(
          JSON.stringify({ error: "Worker not configured" }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Forward to worker with timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      try {
        const workerRes = await fetch(`${workerUrl}/api/jobs`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${workerKey}`,
          },
          body: JSON.stringify({
            job_id,
            project_id,
            youtube_url,
            settings,
            supabase_url: Deno.env.get("SUPABASE_URL"),
            supabase_key: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
            user_id: user.id,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!workerRes.ok) {
          const errBody = await workerRes.text();
          await supabase
            .from("jobs")
            .update({
              status: "failed",
              error_message: `Worker rejected job: ${workerRes.status}`,
              error_code: "WORKER_REJECTED",
            })
            .eq("id", job_id);

          return new Response(
            JSON.stringify({ error: "Worker rejected job", details: errBody }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const workerData = await workerRes.json();

        // Store worker job ID
        if (workerData.worker_job_id) {
          await supabase
            .from("jobs")
            .update({ worker_job_id: workerData.worker_job_id, status: "fetching", progress: 5 })
            .eq("id", job_id);
        }

        return new Response(JSON.stringify(workerData), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err) {
        clearTimeout(timeout);
        const isTimeout = err instanceof DOMException && err.name === "AbortError";
        const message = isTimeout
          ? "Worker did not respond in time. The job will be retried automatically."
          : "Failed to reach the worker server.";

        await supabase
          .from("jobs")
          .update({
            status: "failed",
            error_message: message,
            error_code: isTimeout ? "WORKER_TIMEOUT" : "WORKER_UNREACHABLE",
          })
          .eq("id", job_id);

        return new Response(
          JSON.stringify({ error: message }),
          { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    },
  },

  // GET /worker-proxy/jobs/:id — get job status from worker
  {
    method: "GET",
    pattern: /^\/worker-proxy\/jobs\/([\w-]+)\/?$/,
    handler: async (_req, supabase, match, user) => {
      const jobId = match[1];

      const { data: job } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", jobId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!job) {
        return new Response(JSON.stringify({ error: "Job not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const workerUrl = Deno.env.get("WORKER_URL");
      const workerKey = Deno.env.get("WORKER_API_KEY");

      if (!workerUrl || !workerKey || !job.worker_job_id) {
        // Return local job state if worker not configured or no worker job ID
        return new Response(JSON.stringify(job), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        const workerRes = await fetch(`${workerUrl}/api/jobs/${job.worker_job_id}`, {
          headers: { "Authorization": `Bearer ${workerKey}` },
        });

        if (workerRes.ok) {
          const workerData = await workerRes.json();
          // Sync status back to Supabase
          await supabase
            .from("jobs")
            .update({
              status: workerData.status,
              progress: workerData.progress ?? job.progress,
              error_message: workerData.error_message ?? null,
            })
            .eq("id", jobId);

          return new Response(JSON.stringify(workerData), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch {
        // Fall through to return local state
      }

      return new Response(JSON.stringify(job), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    },
  },

  // POST /worker-proxy/jobs/:id/retry — retry a failed job
  {
    method: "POST",
    pattern: /^\/worker-proxy\/jobs\/([\w-]+)\/retry\/?$/,
    handler: async (req, supabase, match, user) => {
      const jobId = match[1];

      const { data: job } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", jobId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!job) {
        return new Response(JSON.stringify({ error: "Job not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Reset job status
      await supabase
        .from("jobs")
        .update({ status: "queued", progress: 0, error_message: null, error_code: null })
        .eq("id", jobId);

      const workerUrl = Deno.env.get("WORKER_URL");
      const workerKey = Deno.env.get("WORKER_API_KEY");

      if (!workerUrl || !workerKey) {
        return new Response(
          JSON.stringify({ error: "Worker not configured" }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        const workerRes = await fetch(`${workerUrl}/api/jobs/${job.worker_job_id ?? jobId}/retry`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${workerKey}`,
          },
        });

        const data = await workerRes.json();
        return new Response(JSON.stringify(data), {
          status: workerRes.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err) {
        return new Response(
          JSON.stringify({ error: "Failed to reach worker for retry" }),
          { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    },
  },

  // GET /worker-proxy/clips/:id/download — proxy MP4 download
  {
    method: "GET",
    pattern: /^\/worker-proxy\/clips\/([\w-]+)\/download\/?$/,
    handler: async (_req, supabase, match, user) => {
      const clipId = match[1];

      const { data: clip } = await supabase
        .from("clips")
        .select("*")
        .eq("id", clipId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!clip) {
        return new Response(JSON.stringify({ error: "Clip not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const workerUrl = Deno.env.get("WORKER_URL");
      const workerKey = Deno.env.get("WORKER_API_KEY");

      if (!workerUrl || !workerKey) {
        return new Response(
          JSON.stringify({ error: "Worker not configured" }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        const workerRes = await fetch(`${workerUrl}/api/clips/${clipId}/download`, {
          headers: { "Authorization": `Bearer ${workerKey}` },
        });

        if (!workerRes.ok) {
          return new Response(
            JSON.stringify({ error: "Download failed" }),
            { status: workerRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const videoBlob = await workerRes.blob();
        return new Response(videoBlob, {
          headers: {
            ...corsHeaders,
            "Content-Type": "video/mp4",
            "Content-Disposition": `attachment; filename="clip-${clipId}.mp4"`,
          },
        });
      } catch {
        return new Response(
          JSON.stringify({ error: "Failed to download clip from worker" }),
          { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    },
  },
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Service role client for DB writes
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Route matching
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/worker-proxy/, "/worker-proxy");
    const cleanedPath = path.startsWith("/worker-proxy") ? path : `/worker-proxy${path}`;

    for (const route of routes) {
      if (route.method !== req.method) continue;
      const match = cleanedPath.match(route.pattern);
      if (match) {
        return route.handler(req, serviceClient, match, user);
      }
    }

    return new Response(
      JSON.stringify({ error: "Not found", path: cleanedPath }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
