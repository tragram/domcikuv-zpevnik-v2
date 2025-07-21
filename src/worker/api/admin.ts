import { z } from "zod/v4";
import { drizzle } from "drizzle-orm/d1";
import { song, user, userFavoriteSongs, songIllustration, songChange } from "../../lib/db/schema";
import { eq, desc, like, or, sql } from "drizzle-orm"; 
import { buildApp } from "./utils";
import { createInsertSchema } from "drizzle-zod";
import { zValidator } from "@hono/zod-validator";

// User schema for validation
const userSchema = createInsertSchema(user);
const createUserSchema = userSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
const updateUserSchema = userSchema.partial();

// Search schema
const userSearchSchema = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

const adminApp = buildApp()
  .use(async (c, next) => {
    const db = drizzle(c.env.DB);
    const userId = c.get("USER")?.id;
    if (!userId) {
      return c.json(
        { error: "You need to be logged in as admin to visit this page" },
        401
      );
    }
    const isAdminResult = await db
      .select({ isAdmin: user.isAdmin })
      .from(user)
      .where(eq(user.id, userId));
    if (isAdminResult.length > 1) {
      console.error(
        "Found multiple users with the same userID!",
        isAdminResult
      );
    }

    const isAdmin = isAdminResult[0]?.isAdmin;
    if (import.meta.env.DEV || isAdmin) {
      return next();
    }
    return c.json({ error: "You need to be an admin to visit this page" }, 401);
  })
  .get("/songDB", async (c) => {
    const db = drizzle(c.env.DB);
    const songDB = await db.select().from(song);
    return c.json(songDB);
  })
  .get("/illustrations", async (c) => {
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
      .orderBy(songIllustration.createdAt);
    
    return c.json(illustrations);
  })
  .post(
    "/illustration/create",
    zValidator(
      "json",
      createInsertSchema(songIllustration).omit({ id: true, createdAt: true })
    ),
    async (c) => {
      const illustrationData = c.req.valid("json");
      const db = drizzle(c.env.DB);
      
      const newId = crypto.randomUUID();
      await db.insert(songIllustration).values({
        id: newId,
        ...illustrationData,
        createdAt: new Date(),
      });
      
      return c.json({ success: true, id: newId });
    }
  )
  .post(
    "/illustration/modify",
    zValidator(
      "json",
      createInsertSchema(songIllustration).partial().required({ id: true })
    ),
    async (c) => {
      const modifiedIllustration = c.req.valid("json");
      const db = drizzle(c.env.DB);
      
      await db
        .update(songIllustration)
        .set(modifiedIllustration)
        .where(eq(songIllustration.id, modifiedIllustration.id));
      
      return c.json({ success: true });
    }
  )
  .get("/changes", async (c) => {
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
    
    return c.json(changes);
  })
  .post(
    "/change/verify",
    zValidator("json", z.object({ id: z.string(), verified: z.boolean() })),
    async (c) => {
      const { id, verified } = c.req.valid("json");
      const db = drizzle(c.env.DB);
      
      await db
        .update(songChange)
        .set({ verified })
        .where(eq(songChange.id, id));
      
      return c.json({ success: true });
    }
  )
  .post(
    "/song/modify",
    zValidator(
      "json",
      createInsertSchema(song).partial().required({ id: true })
    ),
    async (c) => {
      const modifiedSong = c.req.valid("json");
      console.log(modifiedSong);
      const db = drizzle(c.env.DB);
      await db
        .update(song)
        .set({ ...modifiedSong, dateModified: new Date() })
        .where(eq(song.id, modifiedSong.id));
      return c.json({ success: true });
    }
  )
  // Users endpoints
  .get("/users", zValidator("query", userSearchSchema), async (c) => {
    const { search, limit, offset } = c.req.valid("query");
    const db = drizzle(c.env.DB);
    
    let query = db.select().from(user);
    let countQuery = db.select({ count: sql`count(*)` }).from(user);
    
    // Add search filter if provided
    if (search) {
      const searchCondition = or(
        like(user.name, `%${search}%`),
        like(user.email, `%${search}%`),
        like(user.nickname, `%${search}%`)
      );
      query = query.where(searchCondition);
      countQuery = countQuery.where(searchCondition);
    }
    
    // Add pagination and ordering
    const users = await query
      .orderBy(desc(user.createdAt))
      .limit(limit)
      .offset(offset);
    
    // Get total count for pagination
    const totalCountResult = await countQuery;
    const totalCount = Number(totalCountResult[0]?.count || 0);
    
    return c.json({
      users,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    });
  })
  
  .post(
    "/users",
    zValidator("json", createUserSchema),
    async (c) => {
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
          { error: "A user with this email already exists" },
          400
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
      
      // Return the created user
      const createdUser = await db
        .select()
        .from(user)
        .where(eq(user.id, newId))
        .limit(1);
      
      return c.json({ 
        success: true, 
        user: createdUser[0] 
      });
    }
  )
  
  .get("/users/:id", async (c) => {
    const userId = c.req.param("id");
    const db = drizzle(c.env.DB);
    
    const userData = await db
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
      
    if (userData.length === 0) {
      return c.json(
        { error: "User not found" },
        404
      );
    }
    
    return c.json(userData[0]);
  })
  
  .put(
    "/users/:id",
    zValidator("json", updateUserSchema),
    async (c) => {
      const userId = c.req.param("id");
      const userData = c.req.valid("json");
      const db = drizzle(c.env.DB);
      
      // Check if user exists
      const existingUser = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);
        
      if (existingUser.length === 0) {
        return c.json(
          { error: "User not found" },
          404
        );
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
            { error: "A user with this email already exists" },
            400
          );
        }
      }
      
      await db
        .update(user)
        .set({ 
          ...userData, 
          updatedAt: new Date() 
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
        user: updatedUser[0] 
      });
    }
  )
  
  .delete("/users/:id", async (c) => {
    const userId = c.req.param("id");
    const db = drizzle(c.env.DB);
    const currentUserId = c.get("USER")?.id;
    
    // Prevent self-deletion
    if (userId === currentUserId) {
      return c.json(
        { error: "You cannot delete your own account" },
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
      return c.json(
        { error: "User not found" },
        404
      );
    }
    
    await db
      .delete(user)
      .where(eq(user.id, userId));
    
    return c.json({ success: true });
  });

export default adminApp;