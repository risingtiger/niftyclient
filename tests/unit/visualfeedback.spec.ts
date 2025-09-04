import { promise_a, promise_b } from '../../visualfeedback.ts';

describe('visualfeedback', () => {
    it('promise_a resolves on Monday', async () => {
        const orig_get_day = Date.prototype.getDay;
        Date.prototype.getDay = () => 1;
        const ok = await promise_a();
        if (!ok) throw new Error('expected resolve on Monday');
        Date.prototype.getDay = orig_get_day;
    });

    it('promise_a rejects on Sunday', async () => {
        const orig_get_day = Date.prototype.getDay;
        Date.prototype.getDay = () => 0;
        let rejected = false;
        try { await promise_a(); } catch { rejected = true; }
        if (!rejected) throw new Error('expected reject on Sunday');
        Date.prototype.getDay = orig_get_day;
    });

    it('promise_b resolves to Monday', async () => {
        const orig_get_day = Date.prototype.getDay;
        Date.prototype.getDay = () => 1;
        const day = await promise_b();
        if (day !== 'Monday') throw new Error('expected Monday');
        Date.prototype.getDay = orig_get_day;
    });
});
