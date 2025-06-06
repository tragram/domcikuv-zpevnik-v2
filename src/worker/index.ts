import { Context, Hono } from 'hono'
// import { cors } from 'hono/cors'
import { jwt } from 'hono/jwt'
import { sign } from 'hono/jwt'
import { setCookie, deleteCookie } from 'hono/cookie'

// Password hashing utilities using Web Crypto API
async function hashPassword(password: string, saltHex?: string): Promise<{ saltHex: string, hashHex: string }> {
    const encoder = new TextEncoder()
    let salt: Uint8Array

    if (!saltHex) {
        salt = crypto.getRandomValues(new Uint8Array(16))
    } else {
        const matchResult = saltHex.match(/.{1,2}/g)
        if (!matchResult) {
            throw new Error("Invalid salt hex format")
        }
        salt = new Uint8Array(matchResult.map((byte) => parseInt(byte, 16)))
    }

    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveBits", "deriveKey"]
    )

    const key = await crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256",
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    )

    const exportedKey = (await crypto.subtle.exportKey("raw", key)) as ArrayBuffer
    const hashBuffer = new Uint8Array(exportedKey)
    const hashArray = Array.from(hashBuffer)
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
    const saltHexOut = Array.from(salt).map((b) => b.toString(16).padStart(2, "0")).join("")

    return { saltHex: saltHexOut, hashHex }
}

async function verifyPassword(storedHash: string, passwordAttempt: string): Promise<boolean> {
    const [saltHex, originalHash] = storedHash.split(":")
    const { hashHex: attemptHash } = await hashPassword(passwordAttempt, saltHex)
    return attemptHash === originalHash
}

// Generate a secure random refresh token
function generateRefreshToken(): string {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

const isProduction = (c: Context) => { return !(c.env.IS_LOCAL_MODE && c.env.IS_LOCAL_MODE === "1") }

function setAuthCookies(c: Context) {
    const refreshToken = generateRefreshToken();
    
    // Set HttpOnly refresh token cookie
    setCookie(c, 'refreshToken', refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: isProduction(c) ? 'Strict' : 'Lax',
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: '/api',
    })
    
    // Set visible auth indicator cookie (no sensitive data)
    setCookie(c, 'auth_status', 'authenticated', {
        httpOnly: false, // Client can read this
        secure: true,
        sameSite: isProduction(c) ? 'Strict' : 'Lax',
        maxAge: 30 * 24 * 60 * 60, // Same expiry as refresh token
        path: '/', // Available to entire app
    })
    
    return refreshToken;
}

function clearAuthCookies(c: Context) {
    // Clear both cookies
    deleteCookie(c, 'refreshToken', { path: '/api' })
    deleteCookie(c, 'auth_status', { path: '/' })
}

type Bindings = {
    DB: D1Database
    R2_BUCKET: R2Bucket
    JWT_SECRET: string
    IS_LOCAL_MODE: string
}

type Variables = {
    user: {
        id: string
        email: string
    }
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// CORS middleware with credentials support
// app.use('*', cors({
//     origin: ['http://localhost:5173', 'https://domcikuv-zpevnik-v2.domho108.workers.dev'],
//     allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
//     allowHeaders: ['Content-Type', 'Authorization'],
//     credentials: true, // Allow cookies
// }))

// User registration
app.post('/api/register', async (c) => {
    try {
        const { name, email, password } = await c.req.json()

        // Validation
        if (!name || !email || !password) {
            return c.json({ error: 'All fields are required' }, 400)
        }

        if (password.length < 6) {
            return c.json({ error: 'Password must be at least 6 characters' }, 400)
        }

        // Check if user already exists
        const existingUser = await c.env.DB.prepare(
            'SELECT id FROM users WHERE email = ?'
        ).bind(email).first()

        if (existingUser) {
            return c.json({ error: 'Email already exists' }, 409)
        }

        // Hash password
        const { saltHex, hashHex } = await hashPassword(password)

        // Create user
        await c.env.DB.prepare(
            'INSERT INTO users (nickname, email, password_hash) VALUES (?, ?, ?)'
        ).bind(name, email, `${saltHex}:${hashHex}`).run()

        return c.json({
            message: 'User created successfully',
            user: { name, email }
        }, 201)

    } catch (error) {
        console.error('Registration error:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// User login
app.post('/api/login', async (c) => {
    try {
        const { email, password } = await c.req.json()

        // Validation
        if (!email || !password) {
            return c.json({ error: 'Email and password are required' }, 400)
        }

        // Find user
        const user = await c.env.DB.prepare(
            'SELECT * FROM users WHERE email = ?'
        ).bind(email).first() as any

        if (!user) {
            return c.json({ error: 'Invalid credentials' }, 401)
        }

        // Verify password
        const isValid = await verifyPassword(user.password_hash, password)
        if (!isValid) {
            return c.json({ error: 'Invalid credentials' }, 401)
        }

        // Generate JWT token (15 minutes)
        const accessTokenPayload = {
            id: user.id,
            email: user.email,
            exp: Math.floor(Date.now() / 1000) + (15 * 60) // 15 minutes
        }

        const accessToken = await sign(accessTokenPayload, c.env.JWT_SECRET)

        // Set both auth cookies
        const refreshToken = setAuthCookies(c)
        const refreshTokenExpiry = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)) // 30 days

        // Store refresh token in database
        await c.env.DB.prepare(
            'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)'
        ).bind(user.id, refreshToken, refreshTokenExpiry.toISOString()).run()

        return c.json({
            message: 'Login successful',
            accessToken,
            user: {
                id: user.id,
                nickname: user.nickname,
                email: user.email
            }
        })

    } catch (error) {
        console.error('Login error:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Refresh token endpoint
app.post('/api/refresh', async (c) => {
    try {
        // Get refresh token from cookie
        const refreshToken = c.req.header('cookie')?.match(/refreshToken=([^;]+)/)?.[1]
        if (!refreshToken) {
            // Clear auth status cookie if refresh token is missing
            clearAuthCookies(c)
            return c.json({ error: 'Refresh token not found' }, 401)
        }

        // Find and validate refresh token
        const tokenRecord = await c.env.DB.prepare(
            'SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > datetime("now")'
        ).bind(refreshToken).first() as any
        
        if (!tokenRecord) {
            // Clear both cookies if token is invalid
            clearAuthCookies(c)
            return c.json({ error: 'Invalid or expired refresh token' }, 401)
        }

        // Get user info
        const user = await c.env.DB.prepare(
            'SELECT id, nickname, email FROM users WHERE id = ?'
        ).bind(tokenRecord.user_id).first() as any

        if (!user) {
            clearAuthCookies(c)
            return c.json({ error: 'User not found' }, 404)
        }

        // Generate new access token (15 minutes)
        const accessTokenPayload = {
            id: user.id,
            email: user.email,
            exp: Math.floor(Date.now() / 1000) + (15 * 60) // 15 minutes
        }

        const newAccessToken = await sign(accessTokenPayload, c.env.JWT_SECRET)

        // Generate new refresh token for rotation and update auth cookies
        const newRefreshToken = setAuthCookies(c)
        const newRefreshTokenExpiry = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)) // 30 days

        // Update refresh token in database (token rotation)
        await c.env.DB.prepare(
            'UPDATE refresh_tokens SET token = ?, expires_at = ? WHERE id = ?'
        ).bind(newRefreshToken, newRefreshTokenExpiry.toISOString(), tokenRecord.id).run()
        
        return c.json({
            accessToken: newAccessToken,
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        })

    } catch (error) {
        console.error('Refresh token error:', error)
        clearAuthCookies(c)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Logout endpoint (invalidate refresh token)
app.post('/api/logout', async (c) => {
    try {
        // Get refresh token from cookie
        const refreshToken = c.req.header('cookie')?.match(/refreshToken=([^;]+)/)?.[1]

        if (refreshToken) {
            // Remove refresh token from database
            await c.env.DB.prepare(
                'DELETE FROM refresh_tokens WHERE token = ?'
            ).bind(refreshToken).run()
        }

        // Clear both cookies
        clearAuthCookies(c)

        return c.json({ message: 'Logged out successfully' })

    } catch (error) {
        console.error('Logout error:', error)
        // Still clear cookies even if there's an error
        clearAuthCookies(c)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Protected route middleware
const authMiddleware = (c, next) => {
    const jwtMiddleware = jwt({
        secret: c.env.JWT_SECRET,
    })
    return jwtMiddleware(c, next)
}

// Get user profile (protected)
app.get('/api/profile', authMiddleware, async (c) => {
    try {
        const payload = c.get('jwtPayload')

        const user = await c.env.DB.prepare(
            'SELECT id, nickname, email, avatar, is_favorites_public FROM users WHERE id = ?'
        ).bind(payload.id).first()

        if (!user) {
            return c.json({ error: 'User not found' }, 404)
        }

        return c.json({ user })

    } catch (error) {
        console.error('Profile error:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Update user profile (protected)
app.put('/api/profile', authMiddleware, async (c) => {
    try {
        const payload = c.get('jwtPayload')
        const { nickname, is_favorites_public } = await c.req.json()

        if (!nickname || nickname.trim() === '') {
            return c.json({ error: 'Nickname is required' }, 400)
        }

        // Update both nickname and favorites privacy setting
        await c.env.DB.prepare(
            'UPDATE users SET nickname = ?, is_favorites_public = ? WHERE id = ?'
        ).bind(nickname.trim(), is_favorites_public || false, payload.id).run()

        return c.json({ message: 'Profile updated successfully' })
    } catch (error) {
        console.error('Update profile error:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Upload avatar (protected)
app.put('/api/profile/avatar', authMiddleware, async (c) => {
    try {
        const payload = c.get('jwtPayload')
        const formData = await c.req.formData()
        const avatarFile = formData.get('avatar') as File

        if (!avatarFile) {
            return c.json({ error: 'No avatar file provided' }, 400)
        }

        // Validate file type
        if (!avatarFile.type.startsWith('image/')) {
            return c.json({ error: 'File must be an image' }, 400)
        }

        // Validate file size (5MB max)
        if (avatarFile.size > 5 * 1024 * 1024) {
            return c.json({ error: 'File size must be less than 5MB' }, 400)
        }

        // Here you'd typically:
        // 1. Upload to cloud storage (Cloudflare R2, AWS S3, etc.)
        // 2. Or save to local storage if using traditional hosting
        // 3. Get the URL of the uploaded file
        
        // Example for Cloudflare R2:
        const fileName = `avatars/${payload.id}-${Date.now()}.${avatarFile.name.split('.').pop()}`
        await c.env.R2_BUCKET.put(fileName, avatarFile.stream())
        const avatarUrl = `https://your-domain.com/${fileName}`

        // Update user's avatar URL in database
        await c.env.DB.prepare(
            'UPDATE users SET avatar = ? WHERE id = ?'
        ).bind(avatarUrl, payload.id).run()

        return c.json({ 
            message: 'Avatar updated successfully',
            avatar: avatarUrl 
        })
    } catch (error) {
        console.error('Avatar upload error:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

app.delete('/api/profile/avatar', authMiddleware, async (c) => {
    try {
        const payload = c.get('jwtPayload')
        
        // Get current avatar to delete from storage
        const user = await c.env.DB.prepare(
            'SELECT avatar FROM users WHERE id = ?'
        ).bind(payload.id).first()

        if (user?.avatar) {
            // Delete from cloud storage
            const fileName = user.avatar.split('/').pop()
            await c.env.R2_BUCKET.delete(`avatars/${fileName}`)
        }

        // Remove avatar URL from database
        await c.env.DB.prepare(
            'UPDATE users SET avatar = NULL WHERE id = ?'
        ).bind(payload.id).run()

        return c.json({ message: 'Avatar deleted successfully' })
    } catch (error) {
        console.error('Avatar deletion error:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Get user's favorite songs (protected)
app.get('/api/favorites', authMiddleware, async (c) => {
    try {
        const payload = c.get('jwtPayload')

        const favorites = await c.env.DB.prepare(
            'SELECT song_id FROM user_favorites WHERE user_id = ?'
        ).bind(payload.id).all()

        const songIds = favorites.results.map((fav: any) => fav.song_id)

        return c.json({ favorites: songIds })

    } catch (error) {
        console.error('Get favorites error:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Add song to favorites (protected)
app.post('/api/favorites/:songId', authMiddleware, async (c) => {
    try {
        const payload = c.get('jwtPayload')
        const songId = c.req.param('songId')

        if (!songId) {
            return c.json({ error: 'Song ID is required' }, 400)
        }

        // Check if already favorited
        const existing = await c.env.DB.prepare(
            'SELECT song_id FROM user_favorites WHERE user_id = ? AND song_id = ?'
        ).bind(payload.id, songId).first()
        if (existing) {
            return c.json({ error: 'Song is already in favorites' }, 409)
        }

        // Add to favorites
        await c.env.DB.prepare(
            'INSERT INTO user_favorites (user_id, song_id) VALUES (?, ?)'
        ).bind(payload.id, songId).run()

        return c.json({ message: 'Song added to favorites' }, 201)

    } catch (error) {
        console.error('Add favorite error:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Remove song from favorites (protected)
app.delete('/api/favorites/:songId', authMiddleware, async (c) => {
    try {
        const payload = c.get('jwtPayload')
        const songId = c.req.param('songId')

        if (!songId) {
            return c.json({ error: 'Song ID is required' }, 400)
        }

        // Remove from favorites
        const result = await c.env.DB.prepare(
            'DELETE FROM user_favorites WHERE user_id = ? AND song_id = ?'
        ).bind(payload.id, songId).run()

        if (result.changes === 0) {
            return c.json({ error: 'Song not found in favorites' }, 404)
        }

        return c.json({ message: 'Song removed from favorites' })

    } catch (error) {
        console.error('Remove favorite error:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Clean up expired refresh tokens (utility endpoint)
app.post('/api/cleanup-tokens', async (c) => {
    try {
        await c.env.DB.prepare(
            'DELETE FROM refresh_tokens WHERE expires_at < datetime("now")'
        ).run()

        return c.json({ message: 'Expired tokens cleaned up' })

    } catch (error) {
        console.error('Token cleanup error:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Health check
app.get('/api/health', (c) => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

export default app