import { UserDB } from "src/lib/db/schema/auth.schema";
import client from "../../worker/api-client";
import { handleApiResponse } from "./apiHelpers";

export type UsersApi = typeof client.api.admin.users;

interface UserSearchParams {
  search?: string;
  limit?: number;
  offset?: number;
}

interface UsersResponse {
  users: UserDB[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface CreateUserData {
  name: string;
  email: string;
  emailVerified?: boolean;
  image?: string;
  nickname?: string;
  isTrusted?: boolean;
  isAdmin?: boolean;
  isFavoritesPublic?: boolean;
}

type UpdateUserData = Partial<CreateUserData>

/**
 * Fetches all users with optional search and pagination
 * @param api - The users API client
 * @param params - Search and pagination parameters
 * @returns Promise with users and pagination info
 * @throws {ApiError} When the request fails
 */
export async function fetchUsersAdmin(
  api: UsersApi,
  params?: UserSearchParams
): Promise<UsersResponse> {
  const response = await api.$get({
    query: {
      search: params?.search,
      limit: params?.limit?.toString(),
      offset: params?.offset?.toString(),
    },
  });
  
  await handleApiResponse(response);
  return response.json();
}

/**
 * Fetches a single user by ID
 * @param api - The users API client
 * @param userId - The ID of the user to fetch
 * @returns Promise containing the user data
 * @throws {ApiError} When the user cannot be found or request fails
 */
export async function fetchUserAdmin(
  api: UsersApi,
  userId: string
): Promise<UserDB> {
  const response = await api[':id'].$get({
    param: { id: userId },
  });
  await handleApiResponse(response);
  return response.json();
}

/**
 * Creates a new user
 * @param api - The users API client
 * @param userData - The user data to create
 * @returns Promise containing the creation result and user data
 * @throws {ApiError} When user creation fails (e.g., email already exists)
 */
export async function createUserAdmin(
  api: UsersApi,
  userData: CreateUserData
): Promise<{ success: boolean; user: UserDB }> {
  const response = await api.$post({
    json: userData,
  });
  await handleApiResponse(response);
  return response.json();
}

/**
 * Updates an existing user
 * @param api - The users API client
 * @param userId - The ID of the user to update
 * @param userData - The user data to update
 * @returns Promise containing the update result and user data
 * @throws {ApiError} When user update fails or user not found
 */
export async function updateUserAdmin(
  api: UsersApi,
  userId: string,
  userData: UpdateUserData
): Promise<{ success: boolean; user: UserDB }> {
  const response = await api[':id'].$put({
    param: { id: userId },
    json: userData,
  });
  await handleApiResponse(response);
  return response.json();
}

/**
 * Deletes a user
 * @param api - The users API client
 * @param userId - The ID of the user to delete
 * @returns Promise containing the deletion result
 * @throws {ApiError} When user deletion fails or user not found
 */
export async function deleteUserAdmin(
  api: UsersApi,
  userId: string
): Promise<{ success: boolean }> {
  const response = await api[':id'].$delete({
    param: { id: userId },
  });
  await handleApiResponse(response);
  return response.json();
}