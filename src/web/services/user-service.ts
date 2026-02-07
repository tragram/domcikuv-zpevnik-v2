import { UserDB } from "src/lib/db/schema/auth.schema";
import client, { API } from "../../worker/api-client";
import { makeApiRequest } from "./api-service";
import {
  CreateUserSchema,
  UpdateUserSchema,
  UsersResponse,
} from "src/worker/helpers/user-service";
import { SessionsResponseData } from "src/worker/api/sessions";
import { UserProfileData } from "src/worker/api/userProfile";

export type UsersApi = typeof client.api.admin.users;

type UserFromAPI = Omit<UserDB, "createdAt" | "updatedAt" | "lastLogin"> & {
  createdAt: string;
  updatedAt: string;
  lastLogin: string;
};

const parseUserDates = (user: UserFromAPI): UserDB => ({
  ...user,
  createdAt: new Date(user.createdAt),
  updatedAt: new Date(user.updatedAt),
  lastLogin: new Date(user.lastLogin),
});

interface UserSearchParams {
  search?: string;
  limit?: number;
  offset?: number;
}

export async function fetchProfile(api: API) {
  try {
    const response = await makeApiRequest(api.profile.$get);
    return response;
  } catch (e) {
    console.error("Failed to fetch profile - returning empty...", e);
    return { loggedIn: false } as UserProfileData;
  }
}

export async function fetchActiveSessions(
  api: API
): Promise<SessionsResponseData> {
  const response = await makeApiRequest(api.session.$get);
  return response.map((item) => {
    return { ...item, timestamp: new Date(item.timestamp) };
  });
}

/**
 * Fetches all users with optional search and pagination
 * @param api - The users API client
 * @param params - Search and pagination parameters
 * @returns Promise with users and pagination info
 * @throws {ApiException} When the request fails
 */
export async function fetchUsersAdmin(
  api: UsersApi,
  params?: UserSearchParams
): Promise<UsersResponse> {
  const response = await makeApiRequest(() =>
    api.$get({
      query: {
        search: params?.search,
        limit: params?.limit?.toString(),
        offset: params?.offset?.toString(),
      },
    })
  );

  const users = response.users.map(parseUserDates);

  return {
    ...response,
    users,
  };
}

/**
 * Fetches a single user by ID
 * @param api - The users API client
 * @param userId - The ID of the user to fetch
 * @returns Promise containing the user data
 * @throws {ApiException} When the user cannot be found or request fails
 */
export async function fetchUserAdmin(
  api: UsersApi,
  userId: string
): Promise<UserDB> {
  const response = await makeApiRequest(() =>
    api[":id"].$get({
      param: { id: userId },
    })
  );
  return parseUserDates(response);
}

/**
 * Creates a new user
 * @param api - The users API client
 * @param userData - The user data to create
 * @returns Promise containing the created user data
 * @throws {ApiException} When user creation fails (e.g., email already exists)
 */
export async function createUserAdmin(
  api: UsersApi,
  userData: CreateUserSchema
): Promise<UserDB> {
  const createdUser = await makeApiRequest(() =>
    api.$post({
      json: userData,
    })
  );
  return parseUserDates(createdUser);
}

/**
 * Updates an existing user (PATCH)
 * @param api - The users API client
 * @param userId - The ID of the user to update
 * @param userData - The user data to update (partial)
 * @returns Promise containing the updated user data
 * @throws {ApiException} When user update fails or user not found
 */
export async function updateUserAdmin(
  api: UsersApi,
  userId: string,
  userData: UpdateUserSchema
): Promise<UserDB> {
  const updatedUser = await makeApiRequest(() =>
    api[":id"].$patch({
      param: { id: userId },
      json: userData,
    })
  );
  return parseUserDates(updatedUser);
}

/**
 * Deletes a user
 * @param api - The users API client
 * @param userId - The ID of the user to delete
 * @returns Promise containing the deleted user data
 * @throws {ApiException} When user deletion fails or user not found
 */
export async function deleteUserAdmin(
  api: UsersApi,
  userId: string
): Promise<UserDB> {
  const deletedUser = await makeApiRequest(() =>
    api[":id"].$delete({
      param: { id: userId },
    })
  );
  return parseUserDates(deletedUser);
}