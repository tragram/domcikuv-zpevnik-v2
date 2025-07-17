import { z } from "zod/v4";
import { drizzle } from "drizzle-orm/d1";
import { userFavoriteSongs } from "../../lib/db/schema";

import { buildApp } from "./utils";
import { SongData } from "../../web/types/songData";

const editorApp = buildApp().post("/submit", async (c) => {
  const body = await c.req.json();
  const { title, artist, content } = body;
  const userData = c.get("USER");

  if (!title || !artist || !content) {
    return c.json({ error: "Missing title, artist, or content" }, 400);
  }

  const filename = `songs/chordpro/${SongData.id(title, artist)}.pro`;
  const branch = `submission/${Date.now()}`;
  const githubToken = c.env.GITHUB_TOKEN;
  const githubRepo = c.env.GITHUB_REPO;
  const [owner, repo] = githubRepo.split("/");

  const headers = {
    Authorization: `Bearer ${githubToken}`,
    "Content-Type": "application/json",
    "User-Agent": "hono-cloudflare",
  };

  try {
    // 1. Get latest SHA from main
    const refRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/main`,
      { headers }
    );
    if (!refRes.ok) return c.json({ error: "Failed to get main branch" }, 500);
    const ref = await refRes.json();
    const latestSha = ref.object.sha;

    // 2. Check if file already exists
    let existingFile = null;
    let isUpdate = false;
    
    const fileCheckRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${filename}?ref=main`,
      { headers }
    );
    
    if (fileCheckRes.ok) {
      existingFile = await fileCheckRes.json();
      isUpdate = true;
    } else if (fileCheckRes.status !== 404) {
      // If it's not a 404 (file not found), something else went wrong
      return c.json({ error: "Failed to check file existence" }, 500);
    }

    // 3. Create a new branch
    const createRefRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          ref: `refs/heads/${branch}`,
          sha: latestSha,
        }),
      }
    );
    
    if (!createRefRes.ok) {
      const errorData = await createRefRes.json();
      console.log(errorData);
      return c.json({ error: "Failed to create branch", detail: errorData }, 500);
    }

    // 4. Add or update file
    const commitMessage = isUpdate 
      ? `Update song: ${title} by ${artist}` 
      : `Add song: ${title} by ${artist}`;
    
    const filePayload: any = {
      message: commitMessage,
      content: Buffer.from(content, "utf-8").toString("base64"),
      branch,
    };

    // If updating, include the SHA of the existing file
    if (isUpdate && existingFile) {
      filePayload.sha = existingFile.sha;
    }

    const fileRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${filename}`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify(filePayload),
      }
    );
    
    if (!fileRes.ok) {
      const errorData = await fileRes.json();
      console.log("File operation error:", errorData);
      return c.json({ error: `Failed to ${isUpdate ? 'update' : 'add'} file`, detail: errorData }, 500);
    }

    // 5. Create pull request
    const prTitle = isUpdate 
      ? `Song update: ${artist}: ${title} by ${userData?.name}`
      : `Song submission: ${artist}: ${title} by ${userData?.name}`;
    
    const prBody = isUpdate
      ? `A song update from the site:\n\n**Title**: ${title}\n**Artist**: ${artist}\n\n**User**: ${userData?.name}\n\n**Action**: Updated existing song`
      : `A new song submission from the site:\n\n**Title**: ${title}\n**Artist**: ${artist}\n\n**User**: ${userData?.name}\n\n**Action**: New song submission`;

    const prRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: prTitle,
          head: branch,
          base: "main",
          body: prBody,
        }),
      }
    );

    const pr = await prRes.json();
    if (!prRes.ok) {
      console.log("PR creation error:", pr);
      return c.json({ error: "Failed to create PR", detail: pr }, 500);
    }

    // 6. Automatically add song to user's favorites if user is logged in
    if (userData) {
      try {
        const db = drizzle(c.env.DB);
        const songId = SongData.id(title, artist);
        
        // Insert into favorites, but ignore if it already exists (ON CONFLICT IGNORE equivalent)
        await db.insert(userFavoriteSongs).values({
          userId: userData.id,
          songId,
        }).onConflictDoNothing();
        
        console.log(`Added song ${songId} to favorites for user ${userData.id}`);
      } catch (favoriteError) {
        // Don't fail the entire request if adding to favorites fails
        console.error("Failed to add song to favorites:", favoriteError);
      }
    }

    return c.json({ 
      success: true, 
      prUrl: pr.html_url,
      action: isUpdate ? 'updated' : 'created',
      message: `Song ${isUpdate ? 'updated' : 'submitted'} successfully${userData ? ' and added to your favorites' : ''}`
    });

  } catch (error) {
    console.error("Unexpected error:", error);
    return c.json({ error: "An unexpected error occurred" }, 500);
  }
});

export default editorApp;