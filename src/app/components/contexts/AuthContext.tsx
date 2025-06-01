import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { toast } from 'sonner';

interface LoggedUser {
    id: string;
    name: string;
    email: string;
}

interface AuthContextType {
    user: LoggedUser | null;
    token: string | null;
    favorites: string[];
    loggedIn: boolean;
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

// Helper function to check for auth status cookie
const hasAuthCookie = (): boolean => {
    return document.cookie.includes('auth_status=authenticated');
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<LoggedUser | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [favorites, setFavorites] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const loggedIn = user != null;
    
    const clearAuth = () => {
        setUser(null);
        setToken(null);
        setFavorites([]);
    };

    const refreshAccessToken = useCallback(async (): Promise<boolean> => {
        // Don't attempt refresh if no auth cookie is present
        if (!hasAuthCookie()) {
            console.debug('No auth cookie found, skipping token refresh');
            clearAuth();
            return false;
        }

        try {
            const response = await fetch('/api/refresh', {
                method: 'POST',
                credentials: 'include',
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

        const headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`,
        };

        const response = await fetch(url, {
            ...options,
            headers,
            credentials: 'include',
        });

        // If token expired, try to refresh and retry only if auth cookie exists
        if (response.status === 401 && hasAuthCookie()) {
            const refreshed = await refreshAccessToken();
            if (refreshed && token) {
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

    const loadFavorites = useCallback(async () => {
        // Only load favorites if we have a token AND auth cookie
        if (!token || !hasAuthCookie()) {
            console.log('No token or auth cookie, skipping favorites load');
            return;
        }

        try {
            const response = await makeAuthenticatedRequest('/api/favorites');

            if (response.ok) {
                const data = await response.json();
                setFavorites(data.favorites);
            }
        } catch (error) {
            console.error('Error loading favorites:', error);
        }
    }, [makeAuthenticatedRequest, token]);

    // Initialize auth only if cookies suggest we might be authenticated
    useEffect(() => {
        const initializeAuth = async () => {
            try {
                // Only attempt refresh if auth cookie is present
                if (hasAuthCookie()) {
                    console.log('Auth cookie found, attempting to restore session');
                    const refreshed = await refreshAccessToken();
                    if (refreshed) {
                        await loadFavorites();
                    }
                } else {
                    console.log('No auth cookie found, skipping session restore');
                }
            } catch (error) {
                console.error('Error initializing auth:', error);
            } finally {
                setIsLoading(false);
            }
        };

        initializeAuth();
    }, [loadFavorites, refreshAccessToken]);

    // Set up automatic token refresh only when we have both token and auth cookie
    useEffect(() => {
        if (!token || !hasAuthCookie()) return;

        const refreshInterval = 13 * 60 * 1000; // 13 minutes

        const intervalId = setInterval(() => {
            // Double-check auth cookie still exists before refreshing
            if (hasAuthCookie()) {
                refreshAccessToken();
            } else {
                console.log('Auth cookie no longer present, clearing auth state');
                clearAuth();
            }
        }, refreshInterval);

        return () => clearInterval(intervalId);
    }, [refreshAccessToken, token]);

    const login = async (email: string, password: string): Promise<boolean> => {
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (response.ok) {
                setUser(data.user);
                setToken(data.accessToken);
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
            // Only call logout API if we have auth cookie
            if (hasAuthCookie()) {
                await fetch('/api/logout', {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });
            }
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            clearAuth();
        }
    };

    const addToFavorites = async (songId: string): Promise<boolean> => {
        if (!token || !hasAuthCookie()) {
            toast.error('Please log in to add favorites');
            return false;
        }

        try {
            const response = await makeAuthenticatedRequest(`/api/favorites/${songId}`, {
                method: 'POST',
            });

            if (response.ok) {
                setFavorites(prev => [...prev, songId]);
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
        if (!token || !hasAuthCookie()) {
            toast.error('Please log in to manage favorites');
            return false;
        }

        try {
            const response = await makeAuthenticatedRequest(`/api/favorites/${songId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setFavorites(prev => prev.filter(id => id !== songId));
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
        loggedIn,
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