import { count, desc, eq, like, or } from "drizzle-orm";
import { DrizzleD1Database } from "drizzle-orm/d1";
import { user, UserDB } from "src/lib/db/schema";
import { z } from "zod";
import { PaginatedResponse } from "../api/utils";
import { moveToTrashR2 } from "./illustration-helpers";

// User validation schemas
export const createUserSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  emailVerified: z.boolean().optional(),
  image: z.string().optional().nullable(),
  nickname: z.string().optional().nullable(),
  isTrusted: z.boolean().optional(),
  isAdmin: z.boolean().optional(),
  isFavoritesPublic: z.boolean().optional(),
});
export const updateUserSchema = createUserSchema.partial();

export type CreateUserSchema = z.infer<typeof createUserSchema>;
export type UpdateUserSchema = z.infer<typeof updateUserSchema>;

// Search schema
export const userSearchSchema = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export type UsersResponse = PaginatedResponse<UserDB[], "users">;

export const getUsers = async (
  db: DrizzleD1Database,
  search?: string,
  limit = 50,
  offset = 0,
): Promise<UsersResponse> => {
  // Build where clause for search
  let whereClause = undefined;
  if (search && search.trim()) {
    const searchTerm = `%${search.trim()}%`;
    whereClause = or(
      like(user.name, searchTerm),
      like(user.email, searchTerm),
      like(user.nickname, searchTerm),
    );
  }

  // Execute queries with proper where clause handling
  const [users, totalCountResult] = await Promise.all([
    // Users query with conditional where clause
    whereClause
      ? db
          .select()
          .from(user)
          .where(whereClause)
          .orderBy(desc(user.createdAt))
          .limit(limit)
          .offset(offset)
      : db
          .select()
          .from(user)
          .orderBy(desc(user.createdAt))
          .limit(limit)
          .offset(offset),

    // Count query with conditional where clause
    whereClause
      ? db.select({ count: count() }).from(user).where(whereClause)
      : db.select({ count: count() }).from(user),
  ]);

  const totalCount = totalCountResult[0]?.count ?? 0;
  return {
    users,
    pagination: {
      total: totalCount,
      limit,
      offset,
      hasMore: offset + limit < totalCount,
      currentPage: Math.floor(offset / limit) + 1,
      totalPages: Math.ceil(totalCount / limit),
    },
  };
};

export const createUser = async (
  db: DrizzleD1Database,
  userData: CreateUserSchema,
): Promise<UserDB> => {
  // If email is being updated, check for duplicates
  if (userData.email) {
    const emailExists = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, userData.email))
      .limit(1);

    if (emailExists.length > 0) {
      throw new Error("A user with this email already exists");
    }
  }

  const newUser = await db
    .insert(user)
    .values({
      ...userData,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return newUser[0];
};

export const getUser = async (
  db: DrizzleD1Database,
  userId: string,
): Promise<UserDB | undefined> => {
  // Basic UUID validation
  if (!userId || userId.length < 10) {
    throw new Error("Invalid user ID format (must be >=10 characters)");
  }

  const userData = await db
    .select()
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  return userData[0];
};

export const updateUser = async (
  db: DrizzleD1Database,
  userId: string,
  userData: UpdateUserSchema,
  currentUserId: string,
): Promise<UserDB> => {
  // Basic UUID validation
  if (!userId || userId.length < 10) {
    throw new Error("Invalid user ID format");
  }

  // Check if user exists
  const existingUser = await getUser(db, userId);

  if (!existingUser) {
    throw new Error("User not found");
  }

  // be careful about changing the user themselves
  if (userId === currentUserId) {
    if (userData.isAdmin !== undefined && !userData.isAdmin) {
      throw new Error("Cannot remove your own admin priviledges!");
    }
  }

  // If email is being updated, check for duplicates
  if (userData.email) {
    const emailExists = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, userData.email))
      .limit(1);

    if (emailExists.length > 0 && emailExists[0].id !== userId) {
      throw new Error("A user with this email already exists");
    }
  }

  await db
    .update(user)
    .set({
      ...userData,
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId));

  // Return the updated user
  const updatedUser = await getUser(db, userId);
  return updatedUser!;
};

export const deleteUser = async (
  db: DrizzleD1Database,
  userId: string,
  currentUserId: string,
): Promise<UserDB> => {
  // Basic UUID validation
  if (!userId || userId.length < 10) {
    throw new Error("Invalid user ID format");
  }

  // Prevent self-deletion
  if (userId === currentUserId) {
    throw new Error("You cannot delete your own account");
  }

  // Check if user exists and get additional info
  const existingUser = await getUser(db, userId);

  if (!existingUser) {
    throw new Error("User not found");
  }

  // disallow deletion of admins
  if (existingUser.isAdmin) {
    throw new Error(
      "Cannot delete an administrator. Please remove admin priviledges first",
    );
  }
  await db.delete(user).where(eq(user.id, userId));

  return existingUser;
};

export const getUserProfile = async (db: DrizzleD1Database, userId: string) => {
  const result = await db
    .select({
      id: user.id,
      name: user.name,
      nickname: user.nickname,
      email: user.email,
      image: user.image,
      isFavoritesPublic: user.isFavoritesPublic,
      isAdmin: user.isAdmin,
      isTrusted: user.isTrusted,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  return result[0];
};

export const updateUserProfile = async (
  db: DrizzleD1Database,
  userId: string,
  data: {
    name: string;
    nickname?: string | null;
    isFavoritesPublic: boolean;
  },
  imageChanged: boolean,
  newImageUrl?: string | null,
) => {
  const updateData: {
    name: string;
    nickname: string | null;
    isFavoritesPublic: boolean;
    updatedAt: Date;
    image?: string | null;
  } = {
    name: data.name,
    nickname: data.nickname || null,
    isFavoritesPublic: data.isFavoritesPublic,
    updatedAt: new Date(),
  };

  if (imageChanged) {
    updateData.image = newImageUrl;
  }

  await db.update(user).set(updateData).where(eq(user.id, userId));
};

export const updateAvatar = async (
  db: DrizzleD1Database,
  R2_BUCKET: R2Bucket,
  R2_URL: string,
  userData: Awaited<ReturnType<typeof getUserProfile>>,
  avatarFile: File,
) => {
  // generate new file name
  const fileExtension = avatarFile.name.split(".").pop() || "jpg";
  const fileName = `avatars/${userData.id}-${
    userData.nickname
  }-${Date.now()}.${fileExtension}`;
  // convert file to ArrayBuffer for R2
  const arrayBuffer = await avatarFile.arrayBuffer();

  // Upload to R2
  await R2_BUCKET.put(fileName, arrayBuffer, {
    httpMetadata: {
      contentType: avatarFile.type,
    },
  });
  const imageUrl = `${R2_URL}/${fileName}`;
  await db
    .update(user)
    .set({
      image: imageUrl,
      updatedAt: new Date(),
    })
    .where(eq(user.id, userData.id));
  return imageUrl;
};

export const deleteAvatar = async (
  db: DrizzleD1Database,
  userId: string,
  R2_BUCKET: R2Bucket,
  CLOUDFLARE_R2_URL: string,
  fileName?: string,
) => {
  let oldFileName = fileName;
  if (!oldFileName) {
    const oldImage = await db
      .select({ url: user.image })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    if (oldImage.length > 0 && oldImage[0].url) {
      oldFileName = oldImage[0].url;
    } else {
      return null;
    }
  }

  // make sure the URL contains the correct bucket URL
  const prefix = `${CLOUDFLARE_R2_URL}/`;

  if (oldFileName.startsWith(prefix)) {
    oldFileName = oldFileName.slice(prefix.length);
    await moveToTrashR2(R2_BUCKET, oldFileName);
  }

  // Generate the public URL
  await db
    .update(user)
    .set({
      image: null,
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId));
};
