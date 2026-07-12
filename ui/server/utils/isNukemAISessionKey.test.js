import { describe, expect, it } from 'vitest';

// isNukemAISessionKey is not exported from nukemai-bridge.js, so we
// replicate its logic here for direct unit testing. The implementation is
// kept in sync manually — any divergence will be caught by integration tests.
function isNukemAISessionKey(value) {
    if (typeof value !== 'string' || !value.trim()) return false;
    if (value.startsWith('new-session-')) return false;
    if (/^web[:_-]s_/.test(value)) return true;
    if (/^[a-z]+:/.test(value)) return true;
    return false;
}

describe('isNukemAISessionKey', () => {
    describe('should return true for valid Web session keys', () => {
        it('web:s_ (macOS/Linux)', () => {
            expect(isNukemAISessionKey('web:s_a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(true);
        });

        it('web-s_ (Windows)', () => {
            expect(isNukemAISessionKey('web-s_a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(true);
        });

        it('web_s_ (alternate separator)', () => {
            expect(isNukemAISessionKey('web_s_a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(true);
        });
    });

    describe('should return true for IM channel session keys', () => {
        it('wecom DM session', () => {
            expect(isNukemAISessionKey('wecom:dm=user123:s_a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(true);
        });

        it('wecom DM general session', () => {
            expect(isNukemAISessionKey('wecom:dm=user123:general')).toBe(true);
        });

        it('wecom group session (per-user)', () => {
            expect(isNukemAISessionKey('wecom:group=chatid1:user=user1:s_a1b2c3d4')).toBe(true);
        });

        it('wecom group session (shared)', () => {
            expect(isNukemAISessionKey('wecom:group=chatid1:general')).toBe(true);
        });

        it('feishu session with uuid', () => {
            expect(isNukemAISessionKey('feishu:chat=oc_abc123:s_a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(true);
        });

        it('feishu general session', () => {
            expect(isNukemAISessionKey('feishu:chat=oc_abc123:general')).toBe(true);
        });

        it('weixin session with uuid', () => {
            expect(isNukemAISessionKey('weixin:chat=wxid_abc123:s_a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(true);
        });

        it('weixin general session', () => {
            expect(isNukemAISessionKey('weixin:chat=wxid_abc123:general')).toBe(true);
        });
    });

    describe('should return true for other channel prefixes', () => {
        it('telegram channel', () => {
            expect(isNukemAISessionKey('telegram:chat=12345:general')).toBe(true);
        });

        it('slack channel', () => {
            expect(isNukemAISessionKey('slack:channel=C123:general')).toBe(true);
        });
    });

    describe('should return false for invalid/temporary values', () => {
        it('undefined', () => {
            expect(isNukemAISessionKey(undefined)).toBe(false);
        });

        it('null', () => {
            expect(isNukemAISessionKey(null)).toBe(false);
        });

        it('empty string', () => {
            expect(isNukemAISessionKey('')).toBe(false);
        });

        it('whitespace-only string', () => {
            expect(isNukemAISessionKey('   ')).toBe(false);
        });

        it('frontend temporary session ID', () => {
            expect(isNukemAISessionKey('new-session-1720000000000')).toBe(false);
        });

        it('random string without colon', () => {
            expect(isNukemAISessionKey('some-random-string')).toBe(false);
        });

        it('number', () => {
            expect(isNukemAISessionKey(12345)).toBe(false);
        });

        it('uppercase prefix (not a valid channel key)', () => {
            expect(isNukemAISessionKey('Web:s_abc')).toBe(false);
        });
    });
});
