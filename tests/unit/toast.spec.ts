import '../../lazy/components/toast/toast.ts';

describe('c-toast', () => {
    it('shows message, applies level class, and closes on transitionend', async () => {
        const toast = document.createElement('c-toast') as HTMLElement;
        document.body.appendChild(toast);

        toast.setAttribute('msg', 'Hello');
        toast.setAttribute('level', '4'); // ERROR
        toast.setAttribute('duration', '0');

        const done_p = new Promise<void>(res => toast.addEventListener('done', () => res()));
        toast.setAttribute('action', 'run');

        setTimeout(() => toast.dispatchEvent(new Event('transitionend')), 1);
        await done_p;

        if (!toast.classList.contains('level_error')) throw new Error('expected level_error class');
        if (toast.style.display !== 'none') throw new Error('expected toast hidden');
    });
});
