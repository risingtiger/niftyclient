import '../../alwaysload/engagementlisten.ts';

describe('engagementlisten', () => {
    it('visible listener is called after visibilitychange', async () => {
        const el = document.createElement('div');
        let called = 0;

        (window as any).$N.EngagementListen.Init();
        (window as any).$N.EngagementListen.Add_Listener(el, 't1', 'visible', 0, () => { called += 1; });

        document.dispatchEvent(new Event('visibilitychange'));
        await new Promise(r => setTimeout(r, 600));

        if (called !== 1) throw new Error('expected 1 callback call');

        (window as any).$N.EngagementListen.Remove_Listener(el, 't1', 'visible');
    });
});
