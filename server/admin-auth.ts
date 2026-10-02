import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Request } from 'express'

type AdminCredential = { username: string; phone: string; salt: string; passwordHash: string }
type AdminSession = { username: string; expiresAt: number }
type StoredAdmins = { admins: AdminCredential[] }

const moduleDirectory = dirname(fileURLToPath(import.meta.url))
const authFile = join(moduleDirectory, 'data', 'admin-auth.json')
const sessions = new Map<string, AdminSession>()
const sessionLifetimeMs = 1000 * 60 * 60 * 24

function readCredentials(): AdminCredential[] {
  if (!existsSync(authFile)) return []
  try {
    const value = JSON.parse(readFileSync(authFile, 'utf8')) as StoredAdmins | AdminCredential
    if ('admins' in value && Array.isArray(value.admins)) return value.admins.filter((item) => item.username && item.salt && item.passwordHash)
    const credential = value as AdminCredential
    return credential.username && credential.salt && credential.passwordHash ? [{ ...credential, phone: credential.phone ?? '' }] : []
  } catch { return [] }
}

function saveCredentials(admins: AdminCredential[]) {
  mkdirSync(dirname(authFile), { recursive: true })
  writeFileSync(authFile, JSON.stringify({ admins }, null, 2), 'utf8')
}

function hashPassword(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString('hex')
}

function parseCookies(request: Request) {
  return Object.fromEntries((request.headers.cookie ?? '').split(';').map((item) => item.trim().split('=').map(decodeURIComponent)).filter(([key]) => key))
}

export function hasAdminAccount() { return readCredentials().length > 0 }

export function registerAdmin(username: string, password: string, phone: string) {
  const admins = readCredentials()
  if (admins.length > 0) throw new Error('管理员账号已初始化。')
  if (admins.some((item) => item.username === username)) throw new Error('该管理员用户名已存在，请更换后再试。')
  const salt = randomBytes(16).toString('hex')
  admins.push({ username, phone, salt, passwordHash: hashPassword(password, salt) })
  saveCredentials(admins)
}

export function verifyAdmin(username: string, password: string) {
  const credential = readCredentials().find((item) => item.username === username)
  if (!credential || credential.username !== username) return false
  const provided = Buffer.from(hashPassword(password, credential.salt), 'hex')
  const expected = Buffer.from(credential.passwordHash, 'hex')
  return provided.length === expected.length && timingSafeEqual(provided, expected)
}

export function createAdminSession(username: string) {
  const token = randomBytes(32).toString('base64url')
  sessions.set(token, { username, expiresAt: Date.now() + sessionLifetimeMs })
  return token
}

export function isAdminSession(request: Request) {
  const token = parseCookies(request).admin_session
  if (!token) return false
  const session = sessions.get(token)
  if (!session || session.expiresAt < Date.now()) { sessions.delete(token); return false }
  if (!readCredentials().some((item) => item.username === session.username)) { sessions.delete(token); return false }
  return true
}

export function endAdminSession(request: Request) {
  const token = parseCookies(request).admin_session
  if (token) sessions.delete(token)
}
