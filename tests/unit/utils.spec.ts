import '../../alwaysload/utils.ts';

describe('utils', () => {
    it('CSV_Download creates csv blob and clicks anchor', () => {
        const orig_obj_url = URL.createObjectURL;
        const orig_create_el = document.createElement.bind(document);

        let obj_url_calls = 0;
        let blob_type = '';
        let clicked = false;

        URL.createObjectURL = ((blob: any) => {
            obj_url_calls += 1;
            blob_type = blob.type;
            return 'blob://test';
        }) as any;

        document.createElement = ((tag: any) => {
            const el = orig_create_el(tag);
            if (tag === 'a') (el as any).click = () => { clicked = true; };
            return el;
        }) as any;

        (window as any).$N.Utils.CSV_Download('a,b\n1,2', 'file');

        if (obj_url_calls !== 1) throw new Error('expected 1 createObjectURL call');
        if (blob_type !== 'text/csv') throw new Error('expected blob type text/csv');
        if (!clicked) throw new Error('expected anchor click');

        URL.createObjectURL = orig_obj_url;
        document.createElement = orig_create_el as any;
    });

    it('resolve_object_references resolves refs', () => {
        const list = [{ id: '1', parent: { __path: ['1:users', 'u1'] } }];
        const stores = new Map<string, any[]>([
            ['1:users', [{ id: 'u1', name: 'Alice' }, { id: 'u2', name: 'Bob' }]],
        ]);

        const out = (window as any).$N.Utils.resolve_object_references(list as any, stores as any);
        if (!out[0].parentref || out[0].parentref.name !== 'Alice') throw new Error('expected resolved parent');
    });
});
