import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { toast } from 'sonner';

interface User {
    id: string;
    name: string;
    email: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    favorites: string[];
    login: (email: string, password: string) => Promise<boolean>;
    logout: () => void;
    addToFavorites: (songId: string) => Promise<boolean>;
    removeFromFavorites: (songId: string) => Promise<boolean>;
    isFavorite: (songId: string) => boolean;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null); // Stored in memory only
    const [favorites, setFavorites] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const clearAuth = () => {
        setUser(null);
        setToken(null);
        setFavorites([]);
    };

    const refreshAccessToken = useCallback(async (): Promise<boolean> => {
        try {
            const response = await fetch('/api/refresh', {
                method: 'POST',
                credentials: 'include', // Include cookies
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();

            if (response.ok) {
                setToken(data.accessToken);
                setUser(data.user);
                return true;
            } else {
                console.error('Token refresh failed:', data.error);
                clearAuth();
                return false;
            }
        } catch (error) {
            console.error('Token refresh error:', error);
            clearAuth();
            return false;
        }
    }, []);

    const makeAuthenticatedRequest = useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
        if (!token) {
            throw new Error('No access token available');
        }

        // Add authorization header
        const headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`,
        };

        const response = await fetch(url, {
            ...options,
            headers,
            credentials: 'include', // Include cookies for potential refresh
        });

        console.log(response)

        // If token expired, try to refresh and retry
        if (response.status === 401) {
            const refreshed = await refreshAccessToken();
            console.log(refreshed)
            if (refreshed && token) {
                // Retry the request with new token
                return fetch(url, {
                    ...options,
                    headers: {
                        ...options.headers,
                        'Authorization': `Bearer ${token}`,
                    },
                    credentials: 'include',
                });
            }
        }

        return response;
    }, [refreshAccessToken, token]);

    /* FAVORITES */
    const loadFavorites = useCallback(async () => {
        console.log(token)
        if (!token) return;

        try {
            const response = await makeAuthenticatedRequest('/api/favorites');

            if (response.ok) {
                const data = await response.json();
                console.log(data.favorites)
                setFavorites(data.favorites);
            }
        } catch (error) {
            console.error('Error loading favorites:', error);
        }
    }, [makeAuthenticatedRequest, token]);


    // Try to restore session on mount by checking if refresh token exists
    useEffect(() => {
        const initializeAuth = async () => {
            try {
                // Try to refresh token on app start
                const refreshed = await refreshAccessToken();
                if (refreshed) {
                    await loadFavorites();
                }
            } catch (error) {
                console.error('Error initializing auth:', error);
            } finally {
                setIsLoading(false);
            }
        };

        initializeAuth();
    }, [loadFavorites, refreshAccessToken]);

    // Set up automatic token refresh
    useEffect(() => {
        if (!token) return;

        // Calculate time until token expires (tokens expire in 15 minutes)
        // We'll refresh 2 minutes before expiry
        const refreshInterval = 13 * 60 * 1000; // 13 minutes in milliseconds

        const intervalId = setInterval(() => {
            refreshAccessToken();
        }, refreshInterval);

        return () => clearInterval(intervalId);
    }, [refreshAccessToken, token]);


    const login = async (email: string, password: string): Promise<boolean> => {
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                credentials: 'include', // Include cookies
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (response.ok) {
                setUser(data.user);
                setToken(data.accessToken); // Store in memory only

                await loadFavorites();
                return true;
            } else {
                toast.error(data.error || 'Login failed');
                return false;
            }
        } catch (error) {
            toast.error('Login failed. Please try again.');
            return false;
        }
    };

    const logout = async () => {
        try {
            // Notify server to invalidate refresh token and clear cookie
            await fetch('/api/logout', {
                method: 'POST',
                credentials: 'include', // Include cookies
                headers: {
                    'Content-Type': 'application/json',
                },
            });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            clearAuth();
        }
    };

    const addToFavorites = async (songId: string): Promise<boolean> => {
        if (!token) return false;

        try {
            const response = await makeAuthenticatedRequest(`/api/favorites/${songId}`, {
                method: 'POST',
            });

            if (response.ok) {
                setFavorites(prev => [...prev, songId]);
                toast.success('Song added to favorites');
                return true;
            } else {
                const data = await response.json();
                toast.error(data.error || 'Failed to add to favorites');
                return false;
            }
        } catch (error) {
            toast.error('Failed to add to favorites');
            return false;
        }
    };

    const removeFromFavorites = async (songId: string): Promise<boolean> => {
        if (!token) return false;

        try {
            const response = await makeAuthenticatedRequest(`/api/favorites/${songId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setFavorites(prev => prev.filter(id => id !== songId));
                toast.success('Song removed from favorites');
                return true;
            } else {
                const data = await response.json();
                toast.error(data.error || 'Failed to remove from favorites');
                return false;
            }
        } catch (error) {
            toast.error('Failed to remove from favorites');
            return false;
        }
    };

    const isFavorite = (songId: string): boolean => {
        return favorites.includes(songId);
    };

    const value: AuthContextType = {
        user,
        token,
        favorites,
        login,
        logout,
        addToFavorites,
        removeFromFavorites,
        isFavorite,
        isLoading,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};