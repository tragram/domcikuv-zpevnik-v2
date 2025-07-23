import { z } from "zod/v4";
import { drizzle, DrizzleD1Database } from "drizzle-orm/d1";
import { user } from "../../../lib/db/schema";
import { eq, desc, like, or, count } from "drizzle-orm";
import { buildApp } from "../utils";
import { createInsertSchema } from "drizzle-zod";
import { zValidator } from "@hono/zod-validator";

// User validation schemas
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
  updatedAt: true,
});

export type CreateUserSchema = z.infer<typeof createUserSchema>;
export type UpdateUserSchema = z.infer<typeof updateUserSchema>;

// Search schema
const userSearchSchema = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export const userRoutes = buildApp()
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

        db.select({ count: count() }).from(user), //.where(whereClause),
      ]);

      const totalCount = totalCountResult[0]?.count ?? 0;
      return c.json({
        status: "success",
        data: {
          users,
          pagination: {
            total: totalCount,
            limit,
            offset,
            hasMore: offset + limit < totalCount,
            currentPage: Math.floor(offset / limit) + 1,
            totalPages: Math.ceil(totalCount / limit),
          },
        },
      });
    } catch (error) {
      console.error("Error fetching users:", error);
      return c.json(
        {
          status: "error",
          message: "Failed to fetch users",
          code: "FETCH_ERROR",
        },
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
            status: "error",
            message: "A user with this email already exists",
            code: "EMAIL_EXISTS",
          },
          409
        );
      }

      const newId = crypto.randomUUID();
      const now = new Date();

      const newUser = await db
        .insert(user)
        .values({
          id: newId,
          ...userData,
          createdAt: now,
          updatedAt: now,
          lastLogin: now,
        })
        .returning();

      return c.json(
        {
          success: true,
          user: newUser,
        },
        201
      );
    } catch (error) {
      console.error("Error creating user:", error);
      return c.json(
        {
          status: "error",
          message: "Failed to create user",
          code: "CREATE_ERROR",
        },
        500
      );
    }
  })

  .get("/users/:id", async (c) => {
    try {
      const userId = c.req.param("id");

      // Basic UUID validation
      if (!userId || userId.length < 10) {
        return c.json(
          {
            status: "fail",
            failData: {
              "user.id": "Invalid user ID format (must be >=10 characters)",
            },
          },
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
        return c.json(
          {
            status: "fail",
            failData: {
              illustrationId: "User not found",
              code: "USER_NOT_FOUND",
            },
          },
          404
        );
      }

      return c.json(userData[0]);
    } catch (error) {
      console.error("Error fetching user:", error);
      return c.json(
        {
          status: "error",
          message: "Failed to fetch user",
          code: "FETCH_ERROR",
        },
        500
      );
    }
  })

  .put("/users/:id", zValidator("json", updateUserSchema), async (c) => {
    try {
      const userId = c.req.param("id");
      const userData = c.req.valid("json");
      const currentUserId = c.get("USER")?.id;
      const db = drizzle(c.env.DB);

      // Basic UUID validation
      if (!userId || userId.length < 10) {
        return c.json(
          {
            status: "fail",
            failData: { "user.id": "Invalid user ID format", code: "INVALID_ID" },
          },
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
          {
            status: "error",
            message: "User not found",
            code: "USER_NOT_FOUND",
          },
          404
        );
      }

      // be careful about changing the user themselves
      if (userId === currentUserId) {
        if (userData.isAdmin !== undefined && !userData.isAdmin) {
          return c.json(
            {
              status: "fail",
              failData: {
                "user.isAdmin": "Cannot remove your own admin priviledges!",
                code: "REMOVE_SELF_ADMIN_FORBIDDEN",
              },
            },
            400
          );
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
          return c.json(
            {
              status: "fail",
              failData: {
                "user.email": "A user with this email already exists",
                code: "EMAIL_EXISTS",
              },
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
        {
          status: "error",
          message: "Failed to update user",
          code: "UPDATE_ERROR",
        },
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
          {
            status: "fail",
            failData: {
              "user.id": "Invalid user ID format",
              code: "INVALID_ID",
            },
          },
          400
        );
      }

      // Prevent self-deletion
      if (userId === currentUserId) {
        return c.json(
          {
            status: "fail",
            failData: {
              "user.id": "You cannot delete your own account",
              code: "SELF_DELETE_FORBIDDEN",
            },
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
        return c.json(
          {
            status: "fail",
            failData: {
              "user.id": "User not found",
              code: "USER_NOT_FOUND",
            },
          },
          404
        );
      }

      // disallow deletion of admins
      if (existingUser[0].isAdmin) {
        return c.json(
          {
            status: "fail",
            failData: {
              "user.isAdmin":
                "Cannot delete an administrator. Please remove admin priviledges first",
              code: "CANNOT_DELETE_ADMIN",
            },
          },
          404
        );
      }

      await db.delete(user).where(eq(user.id, userId));

      return c.json({
        status: "success",
        data: {
          id: userId,
          name: existingUser[0].name,
        },
      });
    } catch (error) {
      console.error("Error deleting user:", error);
      return c.json(
        {
          status: "error",
          message: "Failed to delete user",
          code: "DELETE_ERROR",
        },
        500
      );
    }
  });
