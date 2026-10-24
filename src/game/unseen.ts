/** Lines already in the game. No buying, no hints, no rescue. "kiddo" lines are left out. */

export interface UnseenLine {
  id: string
  text: string
  when: 'win' | 'loss' | 'slow' | 'hunt'
}

export const UNSEEN_LINES: UnseenLine[] = [
  { id: 'old_win_eventually', when: 'win', text: 'You won. Eventually. I’ll allow it.' },
  { id: 'old_win_ugly', when: 'win', text: 'A win’s a win. Even an ugly one.' },
  { id: 'old_win_paint', when: 'win', text: 'That was like watching paint dry. But with a happy ending.' },
  { id: 'old_win_gaveup', when: 'win', text: 'Well, look at that. The board gave up before you did.' },
  { id: 'old_win_frame', when: 'win', text: 'Frame it. It might not happen again.' },
  { id: 'old_win_napped', when: 'win', text: 'Congratulations. I only napped twice.' },
  { id: 'old_win_twothree', when: 'win', text: 'Messy. Slow. Victorious. I’ll take one out of three.' },
  { id: 'old_lose_tape', when: 'loss', text: 'Out of hearts. I’d lend you one, but mine runs on duct tape.' },
  { id: 'old_lose_goldfish', when: 'loss', text: 'Game over. Even my goldfish saw that coming.' },
  { id: 'old_lose_popcorn', when: 'loss', text: 'And that’s the ballgame. Rematch? I’ll get my popcorn.' },
  { id: 'old_lose_called', when: 'loss', text: 'Called it. I called it at the first square.' },
  { id: 'old_lose_sandwich', when: 'loss', text: 'Hearts gone. Go have a sandwich and think about what you did.' },
  { id: 'old_idle_crossword', when: 'slow', text: 'I started a crossword while I wait. It’s going better.' },
  { id: 'old_idle_kettle', when: 'slow', text: 'Should I put the kettle on? Feels like a two-kettle puzzle.' },
  { id: 'old_idle_glacier', when: 'slow', text: 'I’ve seen glaciers with more hustle.' },
  { id: 'old_idle_gossip', when: 'slow', text: 'Still thinking? The squares are starting to gossip.' },
  { id: 'old_idle_mail', when: 'slow', text: 'The mail came faster than your next move.' },
  { id: 'old_win_squirrel', when: 'hunt', text: 'A blindfolded squirrel would’ve been quicker. But fine, you won.' },
]

const heard = new Set<string>()

export function pickUnseen(when: UnseenLine['when'], slow: boolean): UnseenLine {
  const pool = UNSEEN_LINES.filter((line) => (slow ? line.when === 'slow' || line.when === when : line.when === when))
  const fresh = pool.filter((line) => !heard.has(line.id))
  const choices = fresh.length ? fresh : pool
  const line = choices[Math.floor(Math.random() * choices.length)]
  heard.add(line.id)
  if (heard.size > UNSEEN_LINES.length - 2) heard.clear()
  return line
}
