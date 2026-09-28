export const redisKeys = {
  code: (shortCode: string) => `code:${shortCode}`,
  meta: (pollId: string) => `poll:${pollId}:meta`,
  counts: (pollId: string) => `poll:${pollId}:counts`,
  total: (pollId: string) => `poll:${pollId}:total`,
  appliedSeq: (pollId: string) => `poll:${pollId}:applied`,
  warm: (pollId: string) => `poll:${pollId}:warm`,
  rebuildLock: (pollId: string) => `poll:${pollId}:rebuild`,
  ballot: (pollId: string, voterKey: string) => `ballot:${pollId}:${voterKey}`,
};
