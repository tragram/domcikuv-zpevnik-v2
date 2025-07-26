import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { user } from "src/lib/db/schema";
import { z } from "zod/v4";
import { buildApp } from "./utils";

// Zod schemas for validation
const UpdateUserProfileSchema = z.object({
  name: z
    .string()
    .min(1, "Display name is required")
    .max(100, "Display name too long"),
  nickname: z.string().optional(),
  isFavoritesPublic: z.boolean(),
});

export type UserProfileData =
  | {
      loggedIn: false;
      profile?: undefined;
    }
  | {
      loggedIn: true;
      profile: {
        id: string;
        name: string;
        nickname: string | null;
        email: string;
        image: string | null;
        isFavoritesPublic: boolean;
        isAdmin: boolean;
        createdAt: Date;
        updatedAt: Date;
      };
    };

const profileApp = buildApp()
  .get("/", async (c) => {
    try {
      const userData = c.get("USER");
      if (!userData) {
        return c.json({
          status: "success",
          data: { loggedIn: false, profile: undefined } as UserProfileData,
        });
      }

      const db = drizzle(c.env.DB);
      const result = await db
        .select({
          id: user.id,
          name: user.name,
          nickname: user.nickname,
          email: user.email,
          image: user.image,
          isFavoritesPublic: user.isFavoritesPublic,
          isAdmin: user.isAdmin,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        })
        .from(user)
        .where(eq(user.id, userData.id))
        .limit(1);

      return c.json({
        status: "success",
        data: { loggedIn: true, profile: result[0] } as UserProfileData,
      });
    } catch (error) {
      console.error(error);
      return c.json(
        {
          status: "error",
          message: "Failed to user profile",
          code: "FETCH_ERROR",
        },
        500
      );
    }
  })
  .put("/", async (c) => {
    try {
      const userData = c.get("USER");
      if (!userData) {
        return c.json({ success: false, error: "User not authenticated" }, 401);
      }

      const formData = await c.req.formData();

      // Debug logging
      console.log("FormData entries:");
      for (const [key, value] of formData.entries()) {
        console.log(
          `${key}:`,
          value instanceof File
            ? `File(${value.name}, ${value.size} bytes)`
            : value
        );
      }

      const name = formData.get("name") as string;
      const nickname = formData.get("nickname") as string;
      const isFavoritesPublic = formData.get("isFavoritesPublic") === "true";

      // Validate required fields
      if (!name?.trim()) {
        return c.json({ success: false, error: "Name is required" }, 400);
      }

      // Validate input with Zod
      const validated = UpdateUserProfileSchema.parse({
        name: name.trim(),
        nickname: nickname?.trim() || undefined,
        isFavoritesPublic,
      });

      const db = drizzle(c.env.DB);

      let newImageUrl: string | null = null;
      let imageChanged = false;

      // Handle avatar operations
      const avatarFile = formData.get("avatarFile") as File | null;
      const shouldDeleteAvatar = formData.get("deleteAvatar") === "true";

      console.log("Avatar processing:", {
        hasAvatarFile: !!avatarFile,
        avatarFileSize: avatarFile?.size || 0,
        avatarFileName: avatarFile?.name || "none",
        shouldDeleteAvatar,
      });

      // Handle avatar upload
      if (avatarFile && avatarFile.size > 0) {
        // Validate file
        if (!avatarFile.type.startsWith("image/")) {
          return c.json(
            { success: false, error: "File must be an image" },
            400
          );
        }

        if (avatarFile.size > 5 * 1024 * 1024) {
          return c.json(
            { success: false, error: "File size must be less than 5MB" },
            400
          );
        }

        // Get current user data to check for existing avatar
        const currentUserProfile = await db
          .select({ image: user.image })
          .from(user)
          .where(eq(user.id, userData.id))
          .limit(1);

        const currentImage = currentUserProfile[0]?.image;

        // Generate unique filename
        const fileExtension =
          avatarFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const fileName = `avatars/${
          userData.id
        }-${Date.now()}.${fileExtension}`;

        try {
          // Convert file to ArrayBuffer for R2
          const arrayBuffer = await avatarFile.arrayBuffer();

          // Upload new avatar to R2
          const r2Response = await c.env.R2_BUCKET.put(fileName, arrayBuffer, {
            httpMetadata: {
              contentType: avatarFile.type,
            },
          });

          if (!r2Response) {
            console.error("R2 upload failed - no response");
            return c.json(
              { success: false, error: "Failed to upload image" },
              500
            );
          }

          // Generate the public URL
          newImageUrl = `${c.env.CLOUDFLARE_R2_URL}/${fileName}`;
          imageChanged = true;

          console.log("New image uploaded:", newImageUrl);

          // Delete old avatar if it exists (after successful upload)
          if (currentImage) {
            try {
              const oldFileName = currentImage.split("/").pop();
              if (oldFileName?.startsWith("avatars/")) {
                await c.env.R2_BUCKET.delete(oldFileName);
                console.log("Deleted old avatar:", oldFileName);
              }
            } catch (error) {
              console.error("Failed to delete old avatar:", error);
              // Continue even if old avatar deletion fails
            }
          }
        } catch (uploadError) {
          console.error("Avatar upload error:", uploadError);
          return c.json(
            { success: false, error: "Failed to upload image" },
            500
          );
        }
      }
      // Handle avatar deletion (only if no new file is being uploaded)
      else if (shouldDeleteAvatar) {
        const currentUserProfile = await db
          .select({ image: user.image })
          .from(user)
          .where(eq(user.id, userData.id))
          .limit(1);

        const currentImage = currentUserProfile[0]?.image;

        if (currentImage) {
          try {
            const fileName = currentImage.split("/").pop();
            if (fileName?.startsWith("avatars/")) {
              await c.env.R2_BUCKET.delete(fileName);
              console.log("Deleted avatar:", fileName);
            }
          } catch (r2Error) {
            console.error("R2 deletion error:", r2Error);
          }
        }

        newImageUrl = null;
        imageChanged = true;
      }

      // Update user profile in database
      const updateData: any = {
        name: validated.name,
        nickname: validated.nickname || null,
        isFavoritesPublic: validated.isFavoritesPublic,
        updatedAt: new Date(),
      };

      // Only update image if it changed
      if (imageChanged) {
        updateData.image = newImageUrl;
        console.log("Updating database with image:", newImageUrl);
      }

      await db.update(user).set(updateData).where(eq(user.id, userData.id));

      console.log("Profile update successful");

      return c.json({
        success: true,
        imageUrl: imageChanged ? newImageUrl : undefined,
      });
    } catch (error) {
      console.error("Profile update error:", error);

      // Handle Zod validation errors
      if (error.name === "ZodError") {
        return c.json(
          {
            success: false,
            error: error.errors?.[0]?.message || "Validation error",
          },
          400
        );
      }

      return c.json(
        {
          success: false,
          error:
            error instanceof Error ? error.message : "Internal server error",
        },
        500
      );
    }
  })
  .post("/avatar", async (c) => {
    try {
      const userData = c.get("USER");
      if (!userData) {
        return c.json({ success: false, error: "User not authenticated" }, 401);
      }

      const formData = await c.req.formData();
      const file = formData.get("file") as File;

      if (!file) {
        return c.json({ success: false, error: "No file provided" }, 400);
      }

      // Validate file
      if (!file.type.startsWith("image/")) {
        return c.json({ success: false, error: "File must be an image" }, 400);
      }

      if (file.size > 5 * 1024 * 1024) {
        return c.json(
          { success: false, error: "File size must be less than 5MB" },
          400
        );
      }

      // Generate unique filename
      const fileExtension = file.name.split(".").pop() || "jpg";
      const fileName = `avatars/${userData.id}-${Date.now()}.${fileExtension}`;

      // Convert file to ArrayBuffer for R2
      const arrayBuffer = await file.arrayBuffer();

      // Upload to R2
      const r2Response = await c.env.R2_BUCKET.put(fileName, arrayBuffer, {
        httpMetadata: {
          contentType: file.type,
        },
      });

      if (!r2Response) {
        return c.json({ success: false, error: "Failed to upload image" }, 500);
      }

      // Generate the public URL
      const imageUrl = `${c.env.CLOUDFLARE_R2_URL}/${fileName}`;

      // Update user's image URL in database
      const db = drizzle(c.env.DB);
      await db
        .update(user)
        .set({
          image: imageUrl,
          updatedAt: new Date(),
        })
        .where(eq(user.id, userData.id));

      return c.json({ success: true, imageUrl });
    } catch (error) {
      console.error("Avatar upload error:", error);
      return c.json(
        {
          success: false,
          error: (error as Error).message,
        },
        500
      );
    }
  })
  .delete("/avatar", async (c) => {
    try {
      const userData = c.get("USER");
      if (!userData) {
        return c.json({ success: false, error: "User not authenticated" }, 401);
      }

      const db = drizzle(c.env.DB);

      // Get current image URL to delete from R2
      const currentUserProfile = await db
        .select({ image: user.image })
        .from(user)
        .where(eq(user.id, userData.id))
        .limit(1);

      const currentImage = currentUserProfile[0]?.image;

      // Delete from R2 if exists
      if (currentImage) {
        try {
          // Extract filename from URL
          const fileName = currentImage.split("/").pop();
          if (fileName && fileName.startsWith("avatars/")) {
            await c.env.R2_BUCKET.delete(fileName);
          }
        } catch (r2Error) {
          console.error("R2 deletion error:", r2Error);
          // Continue even if R2 deletion fails
        }
      }

      // Update database to remove image URL
      await db
        .update(user)
        .set({
          image: null,
          updatedAt: new Date(),
        })
        .where(eq(user.id, userData.id));

      return c.json({
        status: "success",
        data: null,
      });
    } catch (error) {
      console.error("Avatar deletion error:", error);
      return c.json(
        {
          success: false,
          error: (error as Error).message,
        },
        500
      );
    }
  });

export default profileApp;
