import { z } from "zod/v4";
import { drizzle } from "drizzle-orm/d1";
import { song, user, songIllustration, songChange } from "../../lib/db/schema";
import { eq, desc, like, or, count } from "drizzle-orm";
import { buildApp } from "./utils";
import { createInsertSchema } from "drizzle-zod";
import { zValidator } from "@hono/zod-validator";
import { Context, Next } from "hono";

// User schema for validation
const userSchema = createInsertSchema(user);
const createUserSchema = userSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLogin: true,
});
const updateUserSchema = userSchema.partial().omit({
  id: true,
  createdAt: true, // Prevent updating creation date
});

// Search schema
const userSearchSchema = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

// Validation schemas for other entities
const songModificationSchema = createInsertSchema(song)
  .partial()
  .required({ id: true })
  .omit({ dateAdded: true }); // Prevent modifying creation date

const verifyChangeSchema = z.object({
  id: z.string().uuid("Invalid change ID format"),
  verified: z.boolean(),
});

const illustrationCreateSchema = createInsertSchema(songIllustration).omit({
  id: true,
  createdAt: true,
});

const illustrationModifySchema = createInsertSchema(songIllustration)
  .partial()
  .required({ id: true })
  .omit({ createdAt: true }); // Prevent modifying creation date

const adminMiddleware = async (c: Context, next: Next) => {
  try {
    const db = drizzle(c.env.DB);
    const userId = c.get("USER")?.id;

    if (!userId) {
      return c.json(
        { error: "Authentication required", code: "AUTH_REQUIRED" },
        401
      );
    }

    const adminCheckResult = await db
      .select({ isAdmin: user.isAdmin })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (adminCheckResult.length === 0) {
      return c.json({ error: "User not found", code: "USER_NOT_FOUND" }, 404);
    }

    if (adminCheckResult.length > 1) {
      console.error("Critical: Multiple users found with same ID:", userId);
      return c.json(
        { error: "Database integrity error", code: "DB_INTEGRITY_ERROR" },
        500
      );
    }

    const isAdmin = adminCheckResult[0].isAdmin;
    if (import.meta.env.DEV || isAdmin) {
      return next();
    }

    return c.json(
      { error: "Admin privileges required", code: "INSUFFICIENT_PRIVILEGES" },
      403
    );
  } catch (error) {
    console.error("Admin middleware error:", error);
    return c.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      500
    );
  }
};

const adminApp = buildApp()
  .use(adminMiddleware)

  // Song database endpoint
  .get("/songDB", async (c) => {
    try {
      const db = drizzle(c.env.DB);
      const songs = await db
        .select()
        .from(song)
        .orderBy(desc(song.dateModified));

      return c.json({ songs, count: songs.length });
    } catch (error) {
      console.error("Error fetching songs:", error);
      return c.json(
        { error: "Failed to fetch songs", code: "FETCH_ERROR" },
        500
      );
    }
  })

  .get("/illustrations", async (c) => {
    try {
      const db = drizzle(c.env.DB);
      const illustrations = await db
        .select({
          id: songIllustration.id,
          songId: songIllustration.songId,
          songTitle: song.title,
          promptId: songIllustration.promptId,
          promptModel: songIllustration.promptModel,
          imageModel: songIllustration.imageModel,
          imageURL: songIllustration.imageURL,
          thumbnailURL: songIllustration.thumbnailURL,
          isActive: songIllustration.isActive,
          createdAt: songIllustration.createdAt,
        })
        .from(songIllustration)
        .leftJoin(song, eq(songIllustration.songId, song.id))
        .orderBy(desc(songIllustration.createdAt));

      return c.json({ illustrations, count: illustrations.length });
    } catch (error) {
      console.error("Error fetching illustrations:", error);
      return c.json(
        { error: "Failed to fetch illustrations", code: "FETCH_ERROR" },
        500
      );
    }
  })

  .post(
    "/illustration/create",
    zValidator("json", illustrationCreateSchema),
    async (c) => {
      try {
        const illustrationData = c.req.valid("json");
        const db = drizzle(c.env.DB);

        // Verify the song exists
        const songExists = await db
          .select({ id: song.id })
          .from(song)
          .where(eq(song.id, illustrationData.songId))
          .limit(1);

        if (songExists.length === 0) {
          return c.json(
            { error: "Referenced song not found", code: "SONG_NOT_FOUND" },
            400
          );
        }

        const newId = crypto.randomUUID();
        await db.insert(songIllustration).values({
          id: newId,
          ...illustrationData,
          createdAt: new Date(),
        });

        return c.json({ success: true, id: newId }, 201);
      } catch (error) {
        console.error("Error creating illustration:", error);
        return c.json(
          { error: "Failed to create illustration", code: "CREATE_ERROR" },
          500
        );
      }
    }
  )

  .post(
    "/illustration/modify",
    zValidator("json", illustrationModifySchema),
    async (c) => {
      try {
        const modifiedIllustration = c.req.valid("json");
        const db = drizzle(c.env.DB);

        // Check if illustration exists
        const existingIllustration = await db
          .select({ id: songIllustration.id })
          .from(songIllustration)
          .where(eq(songIllustration.id, modifiedIllustration.id))
          .limit(1);

        if (existingIllustration.length === 0) {
          return c.json(
            { error: "Illustration not found", code: "ILLUSTRATION_NOT_FOUND" },
            404
          );
        }

        await db
          .update(songIllustration)
          .set(modifiedIllustration)
          .where(eq(songIllustration.id, modifiedIllustration.id));

        return c.json({ success: true });
      } catch (error) {
        console.error("Error modifying illustration:", error);
        return c.json(
          { error: "Failed to modify illustration", code: "UPDATE_ERROR" },
          500
        );
      }
    }
  )

  .get("/changes", async (c) => {
    try {
      const db = drizzle(c.env.DB);
      const changes = await db
        .select({
          id: songChange.id,
          songId: songChange.songId,
          songTitle: song.title,
          userId: songChange.userId,
          userName: user.name,
          timestamp: songChange.timestamp,
          chordproURL: songChange.chordproURL,
          verified: songChange.verified,
        })
        .from(songChange)
        .leftJoin(song, eq(songChange.songId, song.id))
        .leftJoin(user, eq(songChange.userId, user.id))
        .orderBy(desc(songChange.timestamp));

      return c.json({ changes, count: changes.length });
    } catch (error) {
      console.error("Error fetching changes:", error);
      return c.json(
        { error: "Failed to fetch changes", code: "FETCH_ERROR" },
        500
      );
    }
  })

  // Verify change with existence check
  .post("/change/verify", zValidator("json", verifyChangeSchema), async (c) => {
    try {
      const { id, verified } = c.req.valid("json");
      const db = drizzle(c.env.DB);

      // Check if change exists
      const existingChange = await db
        .select({ id: songChange.id })
        .from(songChange)
        .where(eq(songChange.id, id))
        .limit(1);

      if (existingChange.length === 0) {
        return c.json(
          { error: "Change not found", code: "CHANGE_NOT_FOUND" },
          404
        );
      }

      await db
        .update(songChange)
        .set({ verified })
        .where(eq(songChange.id, id));

      return c.json({ success: true });
    } catch (error) {
      console.error("Error verifying change:", error);
      return c.json(
        { error: "Failed to verify change", code: "UPDATE_ERROR" },
        500
      );
    }
  })

  .post(
    "/song/modify",
    zValidator("json", songModificationSchema),
    async (c) => {
      try {
        const modifiedSong = c.req.valid("json");
        const db = drizzle(c.env.DB);

        // Check if song exists
        const existingSong = await db
          .select({ id: song.id })
          .from(song)
          .where(eq(song.id, modifiedSong.id))
          .limit(1);

        if (existingSong.length === 0) {
          return c.json(
            { error: "Song not found", code: "SONG_NOT_FOUND" },
            404
          );
        }

        await db
          .update(song)
          .set({ ...modifiedSong, dateModified: new Date() })
          .where(eq(song.id, modifiedSong.id));

        return c.json({ success: true });
      } catch (error) {
        console.error("Error modifying song:", error);
        return c.json(
          { error: "Failed to modify song", code: "UPDATE_ERROR" },
          500
        );
      }
    }
  )

  .get("/users", zValidator("query", userSearchSchema), async (c) => {
    try {
      const { search, limit, offset } = c.req.valid("query");
      const db = drizzle(c.env.DB);

      const searchTerm = `%${search?.trim()}%`;

      // TODO: the where clause is ignored
      const whereClause = or(
        like(user.name, searchTerm),
        like(user.email, searchTerm),
        like(user.nickname, searchTerm)
      );

      const [users, totalCountResult] = await Promise.all([
        db
          .select()
          .from(user)
          // .where(whereClause)
          .orderBy(desc(user.createdAt))
          .limit(limit)
          .offset(offset),

        db.select({ count: count() }).from(user)//.where(whereClause),
      ]);

      const totalCount = totalCountResult[0]?.count ?? 0;

      return c.json({
        users,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + limit < totalCount,
          currentPage: Math.floor(offset / limit) + 1,
          totalPages: Math.ceil(totalCount / limit),
        },
      });
    } catch (error) {
      console.error("Error fetching users:", error);
      return c.json(
        { error: "Failed to fetch users", code: "FETCH_ERROR" },
        500
      );
    }
  })

  .post("/users", zValidator("json", createUserSchema), async (c) => {
    try {
      const userData = c.req.valid("json");
      const db = drizzle(c.env.DB);

      // Check if email already exists
      const existingUser = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, userData.email))
        .limit(1);

      if (existingUser.length > 0) {
        return c.json(
          {
            error: "A user with this email already exists",
            code: "EMAIL_EXISTS",
          },
          409
        );
      }

      const newId = crypto.randomUUID();
      const now = new Date();

      await db.insert(user).values({
        id: newId,
        ...userData,
        createdAt: now,
        updatedAt: now,
        lastLogin: now,
      });

      // Return the created user (without sensitive data if any)
      const createdUser = await db
        .select()
        .from(user)
        .where(eq(user.id, newId))
        .limit(1);

      return c.json(
        {
          success: true,
          user: createdUser[0],
        },
        201
      );
    } catch (error) {
      console.error("Error creating user:", error);
      return c.json(
        { error: "Failed to create user", code: "CREATE_ERROR" },
        500
      );
    }
  })

  // Get single user
  .get("/users/:id", async (c) => {
    try {
      const userId = c.req.param("id");

      // Basic UUID validation
      if (!userId || userId.length < 10) {
        return c.json(
          { error: "Invalid user ID format", code: "INVALID_ID" },
          400
        );
      }

      const db = drizzle(c.env.DB);
      const userData = await db
        .select()
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      if (userData.length === 0) {
        return c.json({ error: "User not found", code: "USER_NOT_FOUND" }, 404);
      }

      return c.json(userData[0]);
    } catch (error) {
      console.error("Error fetching user:", error);
      return c.json(
        { error: "Failed to fetch user", code: "FETCH_ERROR" },
        500
      );
    }
  })

  .put("/users/:id", zValidator("json", updateUserSchema), async (c) => {
    try {
      const userId = c.req.param("id");
      const userData = c.req.valid("json");
      const db = drizzle(c.env.DB);

      // Basic UUID validation
      if (!userId || userId.length < 10) {
        return c.json(
          { error: "Invalid user ID format", code: "INVALID_ID" },
          400
        );
      }

      // Check if user exists
      const existingUser = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      if (existingUser.length === 0) {
        return c.json({ error: "User not found", code: "USER_NOT_FOUND" }, 404);
      }

      // If email is being updated, check for duplicates
      if (userData.email) {
        const emailExists = await db
          .select({ id: user.id })
          .from(user)
          .where(eq(user.email, userData.email))
          .limit(1);

        if (emailExists.length > 0 && emailExists[0].id !== userId) {
          return c.json(
            {
              error: "A user with this email already exists",
              code: "EMAIL_EXISTS",
            },
            409
          );
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
      const updatedUser = await db
        .select()
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      return c.json({
        success: true,
        user: updatedUser[0],
      });
    } catch (error) {
      console.error("Error updating user:", error);
      return c.json(
        { error: "Failed to update user", code: "UPDATE_ERROR" },
        500
      );
    }
  })

  .delete("/users/:id", async (c) => {
    try {
      const userId = c.req.param("id");
      const db = drizzle(c.env.DB);
      const currentUserId = c.get("USER")?.id;

      // Basic UUID validation
      if (!userId || userId.length < 10) {
        return c.json(
          { error: "Invalid user ID format", code: "INVALID_ID" },
          400
        );
      }

      // Prevent self-deletion
      if (userId === currentUserId) {
        return c.json(
          {
            error: "You cannot delete your own account",
            code: "SELF_DELETE_FORBIDDEN",
          },
          400
        );
      }

      // Check if user exists and get additional info
      const existingUser = await db
        .select({
          id: user.id,
          isAdmin: user.isAdmin,
          name: user.name,
        })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      if (existingUser.length === 0) {
        return c.json({ error: "User not found", code: "USER_NOT_FOUND" }, 404);
      }

      await db.delete(user).where(eq(user.id, userId));

      return c.json({
        success: true,
        deletedUser: {
          id: userId,
          name: existingUser[0].name,
        },
      });
    } catch (error) {
      console.error("Error deleting user:", error);
      return c.json(
        { error: "Failed to delete user", code: "DELETE_ERROR" },
        500
      );
    }
  });

export default adminApp;
