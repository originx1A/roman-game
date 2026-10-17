/**
 * Player-name profanity check. Mirrors public.is_profane() in supabase/schema.sql (the server is
 * the source of truth and always sets players.is_flagged itself; this copy rejects on the spot).
 */
const SUBSTRING = [
  'fuck', 'fuk', 'fck', 'shit', 'sht', 'bitch', 'btch', 'cunt', 'pussy', 'asshole', 'bastard', 'slut', 'whore',
  'faggot', 'nigger', 'nigga', 'retard', 'rape', 'rapist', 'penis', 'vagina', 'boob', 'titty', 'porn', 'nazi',
  'hitler', 'kkk', 'wank', 'twat', 'prick', 'douche', 'jizz', 'dildo', 'chink', 'kike', 'dyke', 'tranny', 'pedo',
  'molest', 'killyourself', 'suicide', 'bollocks', 'bugger', 'shag', 'stfu', 'milf', 'horny',
]
/** Short words that only count as a whole word ("Cassidy", "Dickson" stay clean) */
const EXACT = ['ass', 'cum', 'sex', 'anal', 'anus', 'dick', 'cock', 'damn', 'crap', 'piss', 'kys', 'wtf', 'fag', 'spic', 'tits']

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's', '!': 'i', '|': 'i' }

export function isProfane(name: string): boolean {
  const norm = (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[013457@$!|]/g, (c) => LEET[c] ?? c)
  const words = norm.replace(/[^a-z ]/g, ' ').split(/\s+/)
  if (words.some((w) => EXACT.includes(w))) return true
  const squashed = norm.replace(/[^a-z]/g, '')
  return SUBSTRING.some((w) => squashed.includes(w))
}

/** The only part of a name ever shown publicly */
export function firstWord(name: string): string {
  return (name || '').trim().replace(/\s+/g, ' ').split(' ')[0].slice(0, 20)
}
