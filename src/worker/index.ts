// src/index.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { jwt } from 'hono/jwt'
import { sign } from 'hono/jwt'
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

type Bindings = {
    DB: D1Database
    JWT_SECRET: string
}

type Variables = {
    user: {
        id: string
        email: string
    }
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// CORS middleware
app.use('*', cors({
    origin: ['http://localhost:5173', 'https://domcikuv-zpevnik-v2.domho108.workers.dev/'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowHeaders: ['Content-Type', 'Authorization'],
}))

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
        // Generate JWT token
        const payload = {
            id: user.id,
            email: user.email,
            exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) // 7 days
        }
        
        const token = await sign(payload, c.env.JWT_SECRET)

        return c.json({
            message: 'Login successful',
            token,
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

// Protected route middleware
const authMiddleware = jwt({
    secret: async (c) => c.env.JWT_SECRET,
})

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

// Health check
app.get('/api/health', (c) => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

export default app