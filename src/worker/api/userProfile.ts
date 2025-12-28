import { drizzle } from "drizzle-orm/d1";
import { z } from "zod/v4";
import {
  deleteAvatar,
  getUserProfile,
  updateAvatar,
  updateUserProfile,
} from "../services/user-service";
import { errorJSend, failJSend, successJSend } from "./responses";
import { buildApp } from "./utils";

// Zod schemas for validation
const updateUserProfileSchema = z.object({
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
        isTrusted: boolean;
        createdAt: Date;
        updatedAt: Date;
      };
    };

export type ProfileUpdateData = {
  imageUrl?: string | null;
};

const profileApp = buildApp()
  .get("/", async (c) => {
    try {
      const userData = c.get("USER");
      if (!userData) {
        return successJSend(c, {
          loggedIn: false,
          profile: undefined,
        } as UserProfileData);
      }

      const db = drizzle(c.env.DB);
      const profile = await getUserProfile(db, userData.id);

      return successJSend(c, {
        loggedIn: true,
        profile,
      } as UserProfileData);
    } catch (error) {
      console.error(error);
      return errorJSend(c, "Failed to user profile", 500, "FETCH_ERROR");
    }
  })
  .put("/", async (c) => {
    try {
      const userData = c.get("USER");
      if (!userData) {
        return errorJSend(c, "User not authenticated", 401);
      }

      const formData = await c.req.formData();

      const name = formData.get("name") as string;
      const nickname = formData.get("nickname") as string;

      const isFavoritesPublic = formData.get("isFavoritesPublic") === "true";

      // TODO: gracefully manage nickname uniqueness (also in the frontend)
      // Validate input with Zod
      const validated = updateUserProfileSchema.parse({
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

      // Handle avatar upload
      if (avatarFile && avatarFile.size > 0) {
        // Validate file
        if (!avatarFile.type.startsWith("image/")) {
          return failJSend(c, "File must be an image!", 400, "FILE_NOT_IMAGE");
        }

        if (avatarFile.size > 5 * 1024 * 1024) {
          return failJSend(
            c,
            "File size must be less than 5MB",
            400,
            "Image too large!"
          );
        }

        // Get current user data to check for existing avatar
        const currentUserProfile = await getUserProfile(db, userData.id);

        const currentImage = currentUserProfile?.image;

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
          await c.env.R2_BUCKET.put(fileName, arrayBuffer, {
            httpMetadata: {
              contentType: avatarFile.type,
            },
          });

          // Generate the public URL
          newImageUrl = `${c.env.CLOUDFLARE_R2_URL}/${fileName}`;
          imageChanged = true;

          // Delete old avatar if it exists (after successful upload)
          if (currentImage) {
            try {
              const oldFileName = currentImage.split("/").pop();
              if (oldFileName?.startsWith("avatars/")) {
                await c.env.R2_BUCKET.delete(oldFileName);
              }
            } catch (error) {
              console.error("Failed to delete old avatar:", error);
              // Continue even if old avatar deletion fails
            }
          }
        } catch (uploadError) {
          console.error("Avatar upload error:", uploadError);
          return errorJSend(c, "Failed to upload image", 500);
        }
      }
      // Handle avatar deletion (only if no new file is being uploaded)
      else if (shouldDeleteAvatar) {
        const currentUserProfile = await getUserProfile(db, userData.id);

        const currentImage = currentUserProfile?.image;

        if (currentImage) {
          try {
            const fileName = currentImage.split("/").pop();
            if (fileName?.startsWith("avatars/")) {
              await c.env.R2_BUCKET.delete(fileName);
            }
          } catch (r2Error) {
            console.error("R2 deletion error:", r2Error);
          }
        }

        newImageUrl = null;
        imageChanged = true;
      }

      // Update user profile in database
      await updateUserProfile(
        db,
        userData.id,
        validated,
        imageChanged,
        newImageUrl
      );

      return successJSend(c, {
        imageUrl: imageChanged ? newImageUrl : undefined,
      } as ProfileUpdateResponse);
    } catch (error) {
      console.error("Profile update error:", error);

      // Handle Zod validation errors
      if (error instanceof z.ZodError) {
        return failJSend(
          c,
          error.flatten().formErrors[0] || "Validation error",
          400
        );
      }

      return errorJSend(
        c,
        error instanceof Error ? error.message : "Internal server error",
        500
      );
    }
  })
  .post("/avatar", async (c) => {
    try {
      const userData = c.get("USER");
      if (!userData) {
        return errorJSend(c, "User not authenticated", 401);
      }

      const formData = await c.req.formData();
      const file = formData.get("file") as File;

      if (!file) {
        return failJSend(c, "No file provided", 400, "MISSING_FILE");
      }

      // Validate file
      if (!file.type.startsWith("image/")) {
        return failJSend(c, "File must be an image", 400, "FILE_NOT_IMAGE");
      }

      if (file.size > 5 * 1024 * 1024) {
        return failJSend(
          c,
          "File size must be less than 5MB",
          400,
          "IMAEG_TOO_LARGE"
        );
      }

      // Generate unique filename
      const fileExtension = file.name.split(".").pop() || "jpg";
      const fileName = `avatars/${userData.id}-${Date.now()}.${fileExtension}`;

      // Convert file to ArrayBuffer for R2
      const arrayBuffer = await file.arrayBuffer();

      // Upload to R2
      await c.env.R2_BUCKET.put(fileName, arrayBuffer, {
        httpMetadata: {
          contentType: file.type,
        },
      });

      // Generate the public URL
      const imageUrl = `${c.env.CLOUDFLARE_R2_URL}/${fileName}`;

      // Update user's image URL in database
      const db = drizzle(c.env.DB);
      await updateAvatar(db, userData.id, imageUrl);

      return successJSend(c, { imageUrl });
    } catch (error) {
      console.error("Avatar upload error:", error);
      return errorJSend(
        c,
        error instanceof Error ? error.message : "Internal server error",
        500
      );
    }
  })
  .delete("/avatar", async (c) => {
    try {
      const userData = c.get("USER");
      if (!userData) {
        return errorJSend(c, "User not authenticated", 401);
      }

      const db = drizzle(c.env.DB);

      // Get current image URL to delete from R2
      const currentUserProfile = await getUserProfile(db, userData.id);

      const currentImage = currentUserProfile?.image;

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
      await deleteAvatar(db, userData.id);

      return successJSend(c, null);
    } catch (error) {
      console.error("Avatar deletion error:", error);
      return errorJSend(
        c,
        error instanceof Error ? error.message : "Internal server error",
        500
      );
    }
  });

export default profileApp;
