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

function setRefreshToken(c: Context) {
    const refreshToken = generateRefreshToken();
    // Set refresh token as HttpOnly cookie
    setCookie(c, 'refreshToken', refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: isProduction(c) ? 'Strict' : 'Lax',
        maxAge: 30 * 24 * 60 * 60,
        path: '/api',
    })
    return refreshToken;
}

type Bindings = {
    DB: D1Database
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
            'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)'
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

        // Generate refresh token
        const refreshToken = setRefreshToken(c)
        console.log("saving refreshToken on login", refreshToken)
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
                name: user.name,
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
        console.log("on refresh, found refreshtoken:", refreshToken)
        if (!refreshToken) {
            return c.json({ error: 'Refresh token not found' }, 401)
        }

        // Find and validate refresh token
        const tokenRecord = await c.env.DB.prepare(
            'SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > datetime("now")'
        ).bind(refreshToken).first() as any
        console.log("on refresh, tokenRecord is", tokenRecord)
        if (!tokenRecord) {
            // Delete invalid cookie
            deleteCookie(c, 'refreshToken', { path: '/api' })
            return c.json({ error: 'Invalid or expired refresh token' }, 401)
        }

        // Get user info
        const user = await c.env.DB.prepare(
            'SELECT id, name, email FROM users WHERE id = ?'
        ).bind(tokenRecord.user_id).first() as any

        if (!user) {
            return c.json({ error: 'User not found' }, 404)
        }

        // Generate new access token (15 minutes)
        const accessTokenPayload = {
            id: user.id,
            email: user.email,
            exp: Math.floor(Date.now() / 1000) + (15 * 60) // 15 minutes
        }

        const newAccessToken = await sign(accessTokenPayload, c.env.JWT_SECRET)

        // Generate new refresh token for rotation
        const newRefreshToken = setRefreshToken(c);

        console.log("saving new refreshToken on refresh", newRefreshToken)
        const newRefreshTokenExpiry = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)) // 30 days

        // Update refresh token in database (token rotation)
        await c.env.DB.prepare(
            'UPDATE refresh_tokens SET token = ?, expires_at = ? WHERE id = ?'
        ).bind(newRefreshToken, newRefreshTokenExpiry.toISOString(), tokenRecord.id).run()
        console.log("saving new accestoken on refresh", newAccessToken)
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

        // Delete the cookie
        deleteCookie(c, 'refreshToken', { path: '/api' })

        return c.json({ message: 'Logged out successfully' })

    } catch (error) {
        console.error('Logout error:', error)
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
            'SELECT id, name, email, created_at, updated_at FROM users WHERE id = ?'
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
        const { name } = await c.req.json()

        if (!name) {
            return c.json({ error: 'Name is required' }, 400)
        }

        await c.env.DB.prepare(
            'UPDATE users SET name = ? WHERE id = ?'
        ).bind(name, payload.id).run()

        return c.json({ message: 'Profile updated successfully' })

    } catch (error) {
        console.error('Update profile error:', error)
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
        console.log(existing)
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