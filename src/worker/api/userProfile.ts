import { and, eq, ne } from "drizzle-orm";
import { user, userFavoriteSongs } from "src/lib/db/schema";
import { z } from "zod";
import {
  deleteAvatar,
  getUserProfile,
  updateAvatar,
} from "../helpers/user-helpers";
import { failJSend, successJSend } from "./responses";
import { buildApp } from "./utils";

const updateUserProfileSchema = z.object({
  name: z
    .string()
    .min(1, "Display name is required")
    .max(100, "Display name too long"),
  nickname: z
    .string()
    .regex(/^[^\/]*$/, "Nickname cannot contain the '/' character")
    .max(30, "Nickname is too long")
    .optional(),
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
        favoriteSongIds: string[];
      };
    };

export type ProfileUpdateData = {
  imageUrl?: string | null;
};

const profileApp = buildApp()
  .get("/", async (c) => {
    const userData = c.var.USER;
    if (!userData) {
      return successJSend(c, { loggedIn: false } as UserProfileData);
    }

    const db = c.var.db;
    const profile = await getUserProfile(db, userData.id);

    const favorites = await db
      .select({ songId: userFavoriteSongs.songId })
      .from(userFavoriteSongs)
      .where(eq(userFavoriteSongs.userId, userData.id));

    const favoriteSongIds = favorites.map((f) => f.songId);

    return successJSend(c, {
      loggedIn: true,
      profile: { ...profile, favoriteSongIds },
    } as UserProfileData);
  })
  .put("/", async (c) => {
    const userData = c.var.USER;
    if (!userData) {
      return failJSend(c, "User not authenticated", 401);
    }

    const formData = await c.req.formData();

    // Zod throws automatically if this fails; our global handler catches it
    const validated = updateUserProfileSchema.parse({
      name: (formData.get("name") as string).trim(),
      nickname: (formData.get("nickname") as string)?.trim() || undefined,
      isFavoritesPublic: formData.get("isFavoritesPublic") === "true",
    });

    const db = c.var.db;

    // Handle Nickname Uniqueness
    if (validated.nickname) {
      // Check if ANY user exists with this nickname AND it is NOT the current user
      const existingUser = await db
        .select({ id: user.id })
        .from(user)
        .where(
          and(eq(user.nickname, validated.nickname), ne(user.id, userData.id)),
        )
        .get();

      if (existingUser) {
        return failJSend(
          c,
          "This nickname is already taken. Please choose another.",
          409, // Conflict status code
          "NICKNAME_TAKEN",
        );
      }
    }

    let newImageUrl: string | null = null;
    let imageChanged = false;

    // Handle avatar operations
    const avatarFile = formData.get("avatarFile") as File | null;
    const shouldDeleteAvatar = formData.get("deleteAvatar") === "true";
    const currentUserProfile = await getUserProfile(db, userData.id);
    const currentImage = currentUserProfile?.image;

    if (avatarFile && avatarFile.size > 0) {
      if (!avatarFile.type.startsWith("image/")) {
        return failJSend(c, "File must be an image!", 400, "FILE_NOT_IMAGE");
      }
      if (avatarFile.size > 5 * 1024 * 1024) {
        return failJSend(
          c,
          "File size must be less than 5MB",
          400,
          "IMAGE_TOO_LARGE",
        );
      }

      newImageUrl = await updateAvatar(
        db,
        c.env.R2_BUCKET,
        c.env.CLOUDFLARE_R2_URL,
        currentUserProfile,
        avatarFile,
      );
      imageChanged = true;

      if (currentImage) {
        // Localized try/catch: we don't want to fail the whole profile update
        // just because the old avatar deletion from R2 failed
        try {
          await deleteAvatar(
            db,
            currentUserProfile.id,
            c.env.R2_BUCKET,
            c.env.CLOUDFLARE_R2_URL,
            currentImage,
          );
        } catch (error) {
          console.error("Failed to delete old avatar:", error);
        }
      }
    } else if (shouldDeleteAvatar && currentImage) {
      try {
        await deleteAvatar(
          db,
          currentUserProfile.id,
          c.env.R2_BUCKET,
          c.env.CLOUDFLARE_R2_URL,
          currentImage,
        );
      } catch (r2Error) {
        console.error("R2 deletion error:", r2Error);
      }
      newImageUrl = null;
      imageChanged = true;
    }

    const updateData: any = {
      name: validated.name,
      nickname: validated.nickname || null,
      isFavoritesPublic: validated.isFavoritesPublic,
      updatedAt: new Date(),
    };

    if (imageChanged) {
      updateData.image = newImageUrl;
    }

    await db
      .update(user)
      .set(updateData)
      .where(eq(user.id, userData.id))
      .execute();

    return successJSend(c, {
      imageUrl: imageChanged ? newImageUrl : undefined,
    } as ProfileUpdateData);
  })
  .delete("/avatar", async (c) => {
    const userData = c.var.USER;
    if (!userData) {
      return failJSend(c, "User not authenticated", 401);
    }

    const db = c.var.db;

    // We let global handler catch generic errors, but specifically catch R2 failures
    // to still return success if the DB update happens
    try {
      await deleteAvatar(
        db,
        userData.id,
        c.env.R2_BUCKET,
        c.env.CLOUDFLARE_R2_URL,
      );
    } catch (r2Error) {
      console.error("R2 deletion error:", r2Error);
    }

    return successJSend(c, null);
  });

export default profileApp;
