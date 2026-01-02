import { drizzle } from "drizzle-orm/d1";
import { z } from "zod/v4";
import {
  deleteAvatar,
  getUserProfile,
  updateAvatar,
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
      // TODO: ensure nickname does not use "/"
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
      const currentUserProfile = await getUserProfile(db, userData.id);
      const currentImage = currentUserProfile?.image;

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
            "IMAGE_TOO_LARGE"
          );
        }

        // Get current user data to check for existing avatar

        try {
          // Generate the public URL
          newImageUrl = await updateAvatar(
            db,
            c.env.R2_BUCKET,
            c.env.CLOUDFLARE_R2_URL,
            currentUserProfile,
            avatarFile
          );
          imageChanged = true;

          // Delete old avatar if it exists (after successful upload)
          if (currentImage) {
            try {
              deleteAvatar(
                db,
                currentUserProfile.id,
                c.env.R2_BUCKET,
                c.env.CLOUDFLARE_R2_URL,
                currentImage
              );
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
      else if (shouldDeleteAvatar && currentImage) {
        try {
          await deleteAvatar(
            db,
            currentUserProfile.id,
            c.env.R2_BUCKET,
            c.env.CLOUDFLARE_R2_URL,
            currentImage
          );
        } catch (r2Error) {
          console.error("R2 deletion error:", r2Error);
        }

        newImageUrl = null;
        imageChanged = true;
      }

      return successJSend(c, {
        imageUrl: imageChanged ? newImageUrl : undefined,
      } as ProfileUpdateData);
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
  // .post("/avatar", async (c) => {
  //   try {
  //     const userData = c.get("USER");
  //     if (!userData) {
  //       return errorJSend(c, "User not authenticated", 401);
  //     }

  //     const formData = await c.req.formData();
  //     const file = formData.get("file") as File;

  //     // Update user's image URL in database
  //     return await updateAvatar(c, userData, file);
  //   } catch (error) {
  //     console.error("Avatar upload error:", error);
  //     return errorJSend(
  //       c,
  //       error instanceof Error ? error.message : "Internal server error",
  //       500
  //     );
  //   }
  // })
  .delete("/avatar", async (c) => {
    try {
      const userData = c.get("USER");
      if (!userData) {
        return errorJSend(c, "User not authenticated", 401);
      }

      const db = drizzle(c.env.DB);
      // Delete from R2 if exists
      try {
        await deleteAvatar(
          db,
          userData.id,
          c.env.R2_BUCKET,
          c.env.CLOUDFLARE_R2_URL
        );
        return successJSend(c, null);
      } catch (r2Error) {
        // Continue even if R2 deletion fails - could be in case of external
        console.error("R2 deletion error:", r2Error);
      }
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
