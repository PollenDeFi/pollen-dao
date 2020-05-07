import { init } from './units/init';
import { submit } from './units/submit';
import { vote } from './units/vote';
import { execute } from './units/execute';
import { redeem } from './units/redeem';

describe('DAO contract', function () {
    init();
    submit();
    vote();
    execute();
    redeem();
});
