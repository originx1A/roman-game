import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isProfane } from '../src/cloud/profanity.ts'

test('9.32: name filter matches the server rules (supabase/schema.sql is_profane)', () => {
  for (const ok of ['Roman', 'Cassidy Smith', 'Dickson', 'José', 'Sam the Great', 'Ana']) assert.equal(isProfane(ok), false, ok)
  for (const bad of ['f.u.c.k', 'xXsh1tXx', 'Big Ass', 'B1tch Queen', 'Shithead Bob', 'kys']) assert.equal(isProfane(bad), true, bad)
})
